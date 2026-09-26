import React, { useState } from 'react';
import { 
  ModelDimensions, 
  RuntimeDimensions, 
  PrecisionType, 
  DistributedConfig 
} from '../../types';
import { PRESET_ARCHITECTURES, ModelPreset } from '../../engine/presetArchitectures';
import { calculateModelParameters } from '../../engine/scalingMath';
import { 
  Sliders, 
  Clock, 
  Zap, 
  Boxes,
  PanelLeftClose,
  ChevronDown,
  MoveVertical
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ParameterConfiguratorProps {
  dim: ModelDimensions;
  onUpdateDim?: (dim: ModelDimensions) => void;
  runtime: RuntimeDimensions;
  onUpdateRuntime: (runtime: RuntimeDimensions) => void;
  precision: PrecisionType;
  onUpdatePrecision: (prec: PrecisionType) => void;
  onApplyPreset: (preset: ModelPreset) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  minEdgeHeight: number;
  onUpdateMinEdgeHeight: (height: number) => void;
}

export const ParameterConfigurator: React.FC<ParameterConfiguratorProps> = ({
  dim,
  onUpdateDim,
  runtime,
  onUpdateRuntime,
  precision,
  onUpdatePrecision,
  onApplyPreset,
  isCollapsed = false,
  onToggleCollapse,
  minEdgeHeight,
  onUpdateMinEdgeHeight
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { totalParams, activeParams } = calculateModelParameters(dim);

  // Find matching preset if any
  const currentPreset = PRESET_ARCHITECTURES.find(
    p => p.dimensions.dModel === dim.dModel && 
         p.dimensions.numLayers === dim.numLayers &&
         p.dimensions.isMoE === dim.isMoE
  );

  const formatParamDisplay = (num: number) => {
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)} Trillion (${(num / 1e9).toFixed(0)}B)`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)} Billion`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)} Million`;
    return num.toLocaleString();
  };

  if (isCollapsed) {
    return null;
  }

  return (
    <aside 
      className={`w-80 lg:w-96 shrink-0 flex flex-col h-full overflow-y-auto z-20 transition-all duration-300 select-none border-r ${
        isDark 
          ? 'bg-slate-900/95 border-slate-800 text-slate-200 shadow-2xl' 
          : 'bg-white/95 border-slate-200 text-slate-800 shadow-lg'
      }`}
    >
      {/* Top Header */}
      <div className={`p-4 border-b sticky top-0 z-10 backdrop-blur-md transition-colors ${
        isDark ? 'border-slate-800 bg-slate-950/80' : 'border-slate-200 bg-slate-50/90'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border ${
              isDark ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-sky-50 border-sky-200 text-sky-600'
            }`}>
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className={`text-sm font-semibold tracking-wide ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                What-If Configurator
              </h2>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Real-Time Analytical Parametric Controls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono border ${
              isDark ? 'bg-sky-950/80 text-sky-400 border-sky-800' : 'bg-sky-50 text-sky-700 border-sky-200'
            }`}>
              Live Sync
            </span>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                title="Collapse sidebar panel"
                className={`p-1.5 rounded-lg transition-colors border ${
                  isDark 
                    ? 'border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800' 
                    : 'border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                }`}
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Live Parameter Count Badge */}
        <div className={`mt-3 p-2.5 rounded-xl border ${
          isDark 
            ? 'bg-gradient-to-r from-sky-950/50 via-slate-900 to-indigo-950/50 border-sky-900/40' 
            : 'bg-gradient-to-r from-sky-50 via-slate-50 to-indigo-50 border-sky-200'
        }`}>
          <div className={`text-[10px] flex items-center justify-between font-mono ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <span>Total Model Scale</span>
            {dim.isMoE && <span className="text-purple-500 font-semibold">MoE Enabled</span>}
          </div>
          <div className={`text-base font-bold font-mono tracking-tight mt-0.5 ${
            isDark ? 'text-sky-300' : 'text-sky-600'
          }`}>
            {formatParamDisplay(totalParams)}
          </div>
          {dim.isMoE && (
            <div className={`text-[10px] font-mono mt-0.5 ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
              Active per token: {formatParamDisplay(activeParams)}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Preset Archetypes Dropdown Menu (Replacing the stacked buttons) */}
        <div>
          <label className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-1.5 ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}>
            <Boxes className={`w-3.5 h-3.5 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
            Architecture Preset
          </label>
          
          <div className="relative">
            <select
              value={currentPreset?.id || 'custom'}
              onChange={(e) => {
                const selected = PRESET_ARCHITECTURES.find(p => p.id === e.target.value);
                if (selected) {
                  onApplyPreset(selected);
                }
              }}
              className={`w-full p-2.5 pr-8 rounded-lg text-xs font-medium border appearance-none transition-all cursor-pointer focus:outline-none focus:ring-1 ${
                isDark
                  ? 'bg-slate-800/90 border-slate-700 text-slate-200 hover:border-sky-500 focus:ring-sky-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 hover:border-sky-500 focus:ring-sky-500'
              }`}
            >
              {!currentPreset && <option value="custom">Custom Configuration</option>}
              {PRESET_ARCHITECTURES.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} [{preset.tag}]
                </option>
              ))}
            </select>
            <ChevronDown className={`w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`} />
          </div>

          {currentPreset && (
            <div className={`mt-1.5 text-[11px] p-2 rounded-lg border ${
              isDark ? 'bg-slate-800/40 border-slate-800/80 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <span className="font-semibold text-sky-500 mr-1">[{currentPreset.tag}]</span>
              {currentPreset.description}
            </div>
          )}
        </div>

        {/* Precision Quantization */}
        <div>
          <label className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-2 ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}>
            <Zap className={`w-3.5 h-3.5 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} />
            Precision & Quantization
          </label>
          <div className="grid grid-cols-5 gap-1">
            {(['FP32', 'FP16', 'BF16', 'INT8', 'FP4'] as PrecisionType[]).map((prec) => (
              <button
                key={prec}
                onClick={() => onUpdatePrecision(prec)}
                className={`py-1.5 rounded-lg text-xs font-mono font-medium border transition-all ${
                  precision === prec
                    ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-600/30'
                    : isDark
                    ? 'bg-slate-800/60 hover:bg-slate-700 text-slate-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                {prec}
              </button>
            ))}
          </div>
          <div className={`text-[10px] font-mono mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Storage: {precision === 'FP4' ? '0.5' : precision === 'INT8' ? '1' : precision === 'FP32' ? '4' : '2'} bytes / param
          </div>
        </div>

        {/* Diagram Spacing & Edge Height Slider */}
        <div className={`space-y-3 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <label className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}>
              <MoveVertical className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
              Diagram Spacing & Edge Height
            </label>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
              isDark ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {minEdgeHeight}px
            </span>
          </div>

          <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Stretches the architecture diagram vertically to provide ample clearance for all tensor links and residual skip curves.
          </p>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Min Edge Height</span>
              <span className={`font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>
                {minEdgeHeight} px
              </span>
            </div>
            <input
              type="range"
              min="35"
              max="220"
              step="5"
              value={minEdgeHeight}
              onChange={(e) => onUpdateMinEdgeHeight(parseInt(e.target.value, 10))}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-500 ${
                isDark ? 'bg-slate-700' : 'bg-slate-200'
              }`}
            />
            <div className={`flex justify-between text-[9px] font-mono ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <span>35px (Min)</span>
              <span>85px (Std)</span>
              <span>140px</span>
              <span>220px (Ultra)</span>
            </div>
          </div>

          {/* Quick Stretch Presets */}
          <div className="grid grid-cols-4 gap-1 pt-0.5">
            {[
              { label: 'Compact', value: 45 },
              { label: 'Default', value: 95 },
              { label: 'Relaxed', value: 140 },
              { label: 'Expanded', value: 190 }
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => onUpdateMinEdgeHeight(p.value)}
                className={`py-1 rounded text-[10px] font-mono font-medium border transition-all ${
                  minEdgeHeight === p.value
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                    : isDark
                    ? 'bg-slate-800/60 hover:bg-slate-700 text-slate-300 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className={`text-[10px] font-mono flex items-center gap-1.5 pt-1 ${
            isDark ? 'text-emerald-400/90' : 'text-emerald-700'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span>Guaranteed &ge; annotation text height (32px)</span>
          </div>
        </div>

        {/* Runtime Dimensions */}
        <div className={`space-y-4 pt-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <label className={`text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
            isDark ? 'text-slate-300' : 'text-slate-700'
          }`}>
            <Clock className={`w-3.5 h-3.5 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
            Runtime Dimensions (B, S)
          </label>

          {/* Phase Selector */}
          <div className="grid grid-cols-3 gap-1">
            {[
              { id: 'prefill', label: 'Prefill' },
              { id: 'decode', label: 'Decode' },
              { id: 'training', label: 'Training' }
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => onUpdateRuntime({ ...runtime, phase: p.id as any })}
                className={`py-1 text-xs font-mono rounded border transition-all ${
                  runtime.phase === p.id
                    ? 'bg-cyan-600 text-white border-cyan-400 shadow'
                    : isDark
                    ? 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Batch Size B */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Batch Size (B)</span>
              <span className={`font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>
                {runtime.batchSize}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="256"
              step="1"
              value={runtime.batchSize}
              onChange={(e) => onUpdateRuntime({ ...runtime, batchSize: parseInt(e.target.value, 10) })}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-cyan-500 ${
                isDark ? 'bg-slate-700' : 'bg-slate-200'
              }`}
            />
          </div>

          {/* Context Window Length S (Highlighting long context KV cache) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Context Length (S)</span>
              <span className={`font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>
                {runtime.contextLength.toLocaleString()} tokens
              </span>
            </div>
            <input
              type="range"
              min="2048"
              max="524288"
              step="4096"
              value={runtime.contextLength}
              onChange={(e) => onUpdateRuntime({ ...runtime, contextLength: parseInt(e.target.value, 10) })}
              className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-cyan-500 ${
                isDark ? 'bg-slate-700' : 'bg-slate-200'
              }`}
            />
            <div className={`flex justify-between text-[9px] font-mono ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              <span>2k</span>
              <span>32k</span>
              <span>128k</span>
              <span>512k</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
