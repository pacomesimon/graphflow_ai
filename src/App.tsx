import React, { useState, useEffect, useCallback } from 'react';
import { 
  ModelDimensions, 
  RuntimeDimensions, 
  PrecisionType, 
  DistributedConfig, 
  HardwareSpec,
  ModelArchitectureSpec,
  CustomBlockDefinition
} from './types';
import { DEFAULT_HARDWARE } from './engine/hardwareSpecs';
import { PRESET_ARCHITECTURES, ModelPreset } from './engine/presetArchitectures';
import { calculateMemoryProfile, calculateRooflineModel } from './engine/scalingMath';
import { computeModelArchitectureSummary, recomputeSpecMetrics } from './engine/modularMath';
import { RefreshCw } from 'lucide-react';

import { TopNavbar, ActiveViewMode } from './components/navbar/TopNavbar';
import { ParameterConfigurator } from './components/sidebar/ParameterConfigurator';
import { ArchitectureCanvas } from './components/canvas/ArchitectureCanvas';
import { MemoryProfileChart } from './components/profiler/MemoryProfileChart';
import { RooflineModelChart } from './components/profiler/RooflineModelChart';
import { FlopsEstimatorCard } from './components/profiler/FlopsEstimatorCard';
import { CommBottleneckCard } from './components/profiler/CommBottleneckCard';
import { useTheme } from './context/ThemeContext';

export default function App() {
  const initialPreset = PRESET_ARCHITECTURES[0]; // Example-1T Fictional MoE

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Single source of truth for the entire modular architecture specification
  const [spec, setSpec] = useState<ModelArchitectureSpec>(() => initialPreset.createSpec());

  // User-created reusable custom blocks (saved in localStorage)
  const [customBlocks, setCustomBlocks] = useState<CustomBlockDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('graphflow_custom_blocks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Hardware cluster specification
  const [hardware, setHardware] = useState<HardwareSpec>(DEFAULT_HARDWARE);
  const [viewMode, setViewMode] = useState<ActiveViewMode>('canvas');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // Dynamic edge height layout spacing (default: 95px, guaranteed >= 32px text annotation height)
  const [minEdgeHeight, setMinEdgeHeight] = useState<number>(95);

  // Sync custom blocks with localStorage
  const handleSaveCustomBlock = (newBlock: CustomBlockDefinition) => {
    setCustomBlocks(prev => {
      const updated = [...prev.filter(b => b.id !== newBlock.id), newBlock];
      try {
        localStorage.setItem('graphflow_custom_blocks', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save custom block to localStorage', e);
      }
      return updated;
    });
  };

  const hasBlocks = spec.blocks.length > 0;

  // Model dimensions synchronized with active spec
  const currentDim: ModelDimensions = {
    dModel: (() => {
      if (!hasBlocks) return 0;
      const attn = spec.blocks.find(b => b.moduleType === 'nn.MultiheadAttention');
      return attn?.parameters.dModel || 8192;
    })(),
    numLayers: (() => {
      if (!hasBlocks) return 0;
      if (spec.repetitionGroups && spec.repetitionGroups.length > 0) {
        return spec.repetitionGroups.reduce((acc, g) => acc + g.repetitions, 0);
      }
      const attn = spec.blocks.find(b => b.moduleType === 'nn.MultiheadAttention');
      return attn?.repeatLayers || 32;
    })(),
    numHeads: (() => {
      if (!hasBlocks) return 0;
      const attn = spec.blocks.find(b => b.moduleType === 'nn.MultiheadAttention');
      return attn?.parameters.numHeads || 64;
    })(),
    numKVHeads: (() => {
      if (!hasBlocks) return 0;
      const attn = spec.blocks.find(b => b.moduleType === 'nn.MultiheadAttention');
      return attn?.parameters.numKVHeads || 8;
    })(),
    intermediateDim: (() => {
      if (!hasBlocks) return 0;
      const ffn = spec.blocks.find(b => b.category === 'ffn' || b.category === 'moe');
      return ffn?.parameters.intermediateDim || 28672;
    })(),
    vocabSize: (() => {
      if (!hasBlocks) return 0;
      const emb = spec.blocks.find(b => b.moduleType === 'nn.Embedding');
      return emb?.parameters.vocabSize || 128256;
    })(),
    isMoE: hasBlocks && spec.blocks.some(b => b.category === 'moe'),
    numExperts: (() => {
      if (!hasBlocks) return 0;
      const moe = spec.blocks.find(b => b.category === 'moe');
      return moe?.parameters.numExperts || 64;
    })(),
    topKExperts: (() => {
      if (!hasBlocks) return 0;
      const moe = spec.blocks.find(b => b.category === 'moe');
      return moe?.parameters.topK || 8;
    })()
  };

  // Profiler calculations
  const memoryProfile = calculateMemoryProfile(currentDim, spec.runtime, spec.precision, spec.distributed, hardware);
  const rooflineData = calculateRooflineModel(currentDim, spec.runtime, spec.precision, hardware);

  // Sync confirmation badge for analytical profiler updates
  const [showSyncBadge, setShowSyncBadge] = useState(false);

  // Re-render and update the entire computational analysis pipeline
  const handleReRender = useCallback(() => {
    setSpec((prevSpec) => {
      const recomputed = recomputeSpecMetrics(prevSpec, hardware);
      return { ...recomputed };
    });
    setShowSyncBadge(true);
    const timer = setTimeout(() => setShowSyncBadge(false), 2800);
    return () => clearTimeout(timer);
  }, [hardware]);

  // Switch architecture preset
  const handleApplyPreset = (preset: ModelPreset) => {
    const newSpec = preset.createSpec();
    setSpec(newSpec);
  };

  // Import JSON specification
  const handleImportConfig = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.blocks && Array.isArray(parsed.blocks)) {
        const recomputed = recomputeSpecMetrics(parsed, hardware);
        setSpec(recomputed);
      }
    } catch (e) {
      console.error('Failed to parse architecture config', e);
    }
  };

  // Update What-If Configurator Dimensions
  const handleUpdateDim = (newDim: ModelDimensions) => {
    // Propagate dimension changes into primary blocks
    const updatedBlocks = spec.blocks.map(b => {
      if (b.moduleType === 'nn.MultiheadAttention') {
        return {
          ...b,
          parameters: {
            ...b.parameters,
            dModel: newDim.dModel,
            numHeads: newDim.numHeads,
            numKVHeads: newDim.numKVHeads
          },
          repeatLayers: newDim.numLayers
        };
      }
      if (b.category === 'ffn') {
        return {
          ...b,
          parameters: {
            ...b.parameters,
            inFeatures: newDim.dModel,
            intermediateDim: newDim.intermediateDim
          },
          repeatLayers: newDim.numLayers
        };
      }
      if (b.category === 'moe') {
        return {
          ...b,
          parameters: {
            ...b.parameters,
            dModel: newDim.dModel,
            intermediateDim: newDim.intermediateDim,
            numExperts: newDim.numExperts || 64,
            topK: newDim.topKExperts || 8
          },
          repeatLayers: newDim.numLayers
        };
      }
      if (b.moduleType === 'nn.Embedding') {
        return {
          ...b,
          parameters: {
            ...b.parameters,
            vocabSize: newDim.vocabSize,
            embeddingDim: newDim.dModel
          }
        };
      }
      if (b.category === 'norm') {
        return {
          ...b,
          parameters: {
            ...b.parameters,
            normalizedShape: newDim.dModel
          }
        };
      }
      return b;
    });

    // Also synchronize repetitionGroups if present
    const updatedGroups = (spec.repetitionGroups || []).map(g => ({
      ...g,
      repetitions: newDim.numLayers
    }));

    const updatedSpec = {
      ...spec,
      blocks: updatedBlocks,
      ...(spec.repetitionGroups ? { repetitionGroups: updatedGroups } : {})
    };
    const recomputed = recomputeSpecMetrics(updatedSpec, hardware);
    setSpec(recomputed);
  };

  const handleUpdateRuntime = (newRuntime: RuntimeDimensions) => {
    const updatedSpec = { ...spec, runtime: newRuntime };
    const recomputed = recomputeSpecMetrics(updatedSpec, hardware);
    setSpec(recomputed);
  };

  const handleUpdatePrecision = (newPrecision: PrecisionType) => {
    const updatedSpec = { ...spec, precision: newPrecision };
    const recomputed = recomputeSpecMetrics(updatedSpec, hardware);
    setSpec(recomputed);
  };

  const handleUpdateDist = (newDist: DistributedConfig) => {
    const updatedSpec = { ...spec, distributed: newDist };
    const recomputed = recomputeSpecMetrics(updatedSpec, hardware);
    setSpec(recomputed);
  };

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans transition-colors ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Top Navbar */}
      <TopNavbar
        viewMode={viewMode}
        onSetViewMode={setViewMode}
        spec={spec}
        onImportConfig={handleImportConfig}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Workspace Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sticky What-If Parameter Configurator Sidebar */}
        <ParameterConfigurator
          dim={currentDim}
          onUpdateDim={handleUpdateDim}
          runtime={spec.runtime}
          onUpdateRuntime={handleUpdateRuntime}
          precision={spec.precision}
          onUpdatePrecision={handleUpdatePrecision}
          onApplyPreset={handleApplyPreset}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(true)}
          minEdgeHeight={minEdgeHeight}
          onUpdateMinEdgeHeight={setMinEdgeHeight}
        />

        {/* View Switcher Container */}
        <main className={`flex-1 flex flex-col h-full overflow-hidden transition-colors ${
          isDark ? 'bg-slate-950' : 'bg-slate-100/60'
        }`}>
          {/* BENTO MODE: Split screen with canvas and active analytical outputs */}
          {viewMode === 'bento' && (
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 h-full overflow-y-auto xl:overflow-hidden p-3 gap-3">
              {/* Left Column: Interactive Hierarchical Canvas (7 cols on XL) */}
              <div className={`xl:col-span-7 h-[550px] xl:h-full rounded-2xl overflow-hidden border shadow-lg relative ${
                isDark ? 'border-slate-800' : 'border-slate-200 shadow-sm'
              }`}>
                <ArchitectureCanvas
                  spec={spec}
                  onUpdateSpec={setSpec}
                  customBlocks={customBlocks}
                  onSaveCustomBlock={handleSaveCustomBlock}
                  minEdgeHeight={minEdgeHeight}
                  onUpdateMinEdgeHeight={setMinEdgeHeight}
                  hardware={hardware}
                  onReRender={handleReRender}
                />
              </div>

              {/* Right Column: Real-Time Analytical Profiler Cards (5 cols on XL) */}
              <div className="xl:col-span-5 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1">
                {/* Sync Confirmation Banner */}
                {showSyncBadge && (
                  <div className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-mono shadow-md animate-in fade-in slide-in-from-top-2 duration-200 ${
                    isDark ? 'bg-sky-950/80 border-sky-800 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-700'
                  }`}>
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                      <span className="font-semibold">Profiler Updated</span>
                      <span className="opacity-75 text-[11px]">— VRAM, roofline & topology re-analyzed</span>
                    </div>
                  </div>
                )}

                {/* 1. Memory Footprint Tracker */}
                <MemoryProfileChart
                  memory={memoryProfile}
                  hardware={hardware}
                  runtime={spec.runtime}
                />

                {/* 2. Dynamic Operational Roofline Model */}
                <RooflineModelChart
                  points={rooflineData.points}
                  ridgePoint={rooflineData.ridgePoint}
                  peakCompute={rooflineData.peakCompute}
                  memoryBandwidth={rooflineData.memoryBandwidth}
                  hardware={hardware}
                  precision={spec.precision}
                  onSelectHardware={setHardware}
                />

                {/* 3. FLOPs Estimator */}
                <FlopsEstimatorCard
                  dim={currentDim}
                  runtime={spec.runtime}
                  precision={spec.precision}
                  dist={spec.distributed}
                  hardware={hardware}
                />

                {/* 4. Distributed Topology & Comm Latency */}
                <CommBottleneckCard
                  dist={spec.distributed}
                  onUpdateDist={handleUpdateDist}
                  hardware={hardware}
                  onUpdateHardware={setHardware}
                  dim={currentDim}
                  runtime={spec.runtime}
                  precision={spec.precision}
                />
              </div>
            </div>
          )}

          {/* FULL-SCREEN CANVAS MODE */}
          {viewMode === 'canvas' && (
            <div className="w-full h-full relative">
              <ArchitectureCanvas
                spec={spec}
                onUpdateSpec={setSpec}
                customBlocks={customBlocks}
                onSaveCustomBlock={handleSaveCustomBlock}
                minEdgeHeight={minEdgeHeight}
                onUpdateMinEdgeHeight={setMinEdgeHeight}
                hardware={hardware}
                onReRender={handleReRender}
              />
            </div>
          )}

          {/* FULL-SCREEN ROOFLINE & COMPUTE PROFILER */}
          {viewMode === 'roofline' && (
            <div className="w-full h-full overflow-y-auto p-4 space-y-4 max-w-6xl mx-auto custom-scrollbar">
              <RooflineModelChart
                points={rooflineData.points}
                ridgePoint={rooflineData.ridgePoint}
                peakCompute={rooflineData.peakCompute}
                memoryBandwidth={rooflineData.memoryBandwidth}
                hardware={hardware}
                precision={spec.precision}
                onSelectHardware={setHardware}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FlopsEstimatorCard
                  dim={currentDim}
                  runtime={spec.runtime}
                  precision={spec.precision}
                  dist={spec.distributed}
                  hardware={hardware}
                />
                <MemoryProfileChart
                  memory={memoryProfile}
                  hardware={hardware}
                  runtime={spec.runtime}
                />
              </div>
            </div>
          )}

          {/* FULL-SCREEN DISTRIBUTED TOPOLOGY & SHARDING MODE */}
          {viewMode === 'distributed' && (
            <div className="w-full h-full overflow-y-auto p-4 space-y-4 max-w-6xl mx-auto custom-scrollbar">
              <CommBottleneckCard
                dist={spec.distributed}
                onUpdateDist={handleUpdateDist}
                hardware={hardware}
                onUpdateHardware={setHardware}
                dim={currentDim}
                runtime={spec.runtime}
                precision={spec.precision}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <MemoryProfileChart
                  memory={memoryProfile}
                  hardware={hardware}
                  runtime={spec.runtime}
                />
                <FlopsEstimatorCard
                  dim={currentDim}
                  runtime={spec.runtime}
                  precision={spec.precision}
                  dist={spec.distributed}
                  hardware={hardware}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
