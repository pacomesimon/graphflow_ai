import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sliders, 
  Check, 
  Trash2, 
  Copy, 
  Cpu, 
  Database, 
  Zap, 
  Box, 
  GitBranch, 
  Network, 
  AlertTriangle 
} from 'lucide-react';
import { ModularBlock, RuntimeDimensions, PrecisionType, HardwareSpec } from '../../types';
import { calculateBlockMetrics } from '../../engine/modularMath';
import { useTheme } from '../../context/ThemeContext';

interface BlockInspectorModalProps {
  block: ModularBlock | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateBlock: (updatedBlock: ModularBlock) => void;
  onDeleteBlock?: (blockId: string) => void;
  onDuplicateBlock?: (blockId: string) => void;
  runtime: RuntimeDimensions;
  precision: PrecisionType;
  hardware: HardwareSpec;
  groupInfo?: {
    groupId: string;
    groupName: string;
    repetitions: number;
  } | null;
  onUpdateGroupRepetitions?: (groupId: string, newReps: number) => void;
}

export const BlockInspectorModal: React.FC<BlockInspectorModalProps> = ({
  block,
  isOpen,
  onClose,
  onUpdateBlock,
  onDeleteBlock,
  onDuplicateBlock,
  runtime,
  precision,
  hardware,
  groupInfo,
  onUpdateGroupRepetitions
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [name, setName] = useState('');
  const [repeatLayers, setRepeatLayers] = useState(1);
  const [params, setParams] = useState<Record<string, any>>({});
  const [assignedGPU, setAssignedGPU] = useState(0);
  const [assignedNode, setAssignedNode] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (block) {
      setName(block.name);
      setRepeatLayers(block.repeatLayers || 1);
      setParams({ ...(block.parameters || {}) });
      setAssignedGPU(block.assignedGPU ?? 0);
      setAssignedNode(block.assignedNode ?? 0);
      setNotes(block.notes || '');
    }
  }, [block]);

  if (!isOpen || !block) return null;

  const effectiveMultiplier = groupInfo ? groupInfo.repetitions : repeatLayers;

  // Live recalculate preview metrics with current edited params
  const previewMetrics = calculateBlockMetrics(
    {
      id: block.id,
      name,
      moduleType: block.moduleType,
      category: block.category,
      parameters: params,
      repeatLayers: groupInfo ? 1 : repeatLayers,
      assignedGPU,
      assignedNode
    },
    block.inputShape,
    runtime,
    precision,
    hardware,
    effectiveMultiplier
  );

  const handleParamChange = (key: string, value: any) => {
    setParams(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: ModularBlock = {
      ...block,
      name,
      repeatLayers,
      parameters: params,
      inputShape: previewMetrics.inputShape,
      outputShape: previewMetrics.outputShape,
      stats: previewMetrics.stats,
      assignedGPU,
      assignedNode,
      notes
    };
    onUpdateBlock(updated);
    onClose();
  };

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(0)}k`;
    return `${num}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div 
        className={`w-full max-w-xl max-h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all ${
          isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
          isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl border ${
              isDark ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-sky-50 border-sky-200 text-sky-600'
            }`}>
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">{block.name}</h3>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                  isDark ? 'bg-slate-800 text-sky-400 border-slate-700' : 'bg-sky-50 text-sky-700 border-sky-200'
                }`}>
                  {block.moduleType}
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Configure layer hyperparameters and observe analytical scaling in real time
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Metrics Header Bar */}
        <div className={`grid grid-cols-4 gap-2 p-3 border-b text-center font-mono text-xs ${
          isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-100 border-slate-200'
        }`}>
          <div className="p-1.5 rounded bg-transparent">
            <span className={`text-[9px] uppercase block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Parameters</span>
            <span className={`font-bold ${isDark ? 'text-sky-300' : 'text-sky-600'}`}>
              {formatNumber(previewMetrics.stats.params)}
            </span>
          </div>
          <div className="p-1.5 rounded bg-transparent">
            <span className={`text-[9px] uppercase block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Intensity</span>
            <span className={`font-bold ${previewMetrics.stats.memoryBound ? 'text-amber-500' : 'text-emerald-500'}`}>
              {previewMetrics.stats.arithmeticIntensity} FLOP/B
            </span>
          </div>
          <div className="p-1.5 rounded bg-transparent">
            <span className={`text-[9px] uppercase block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Output Dim</span>
            <span className="font-bold truncate text-[11px]">
              {previewMetrics.outputShape.label}
            </span>
          </div>
          <div className="p-1.5 rounded bg-transparent">
            <span className={`text-[9px] uppercase block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Hardware Regime</span>
            <span className={`font-bold text-[10px] ${
              previewMetrics.stats.memoryBound ? 'text-amber-500' : 'text-emerald-500'
            }`}>
              {previewMetrics.stats.memoryBound ? 'Bandwidth-Bound' : 'Compute-Bound'}
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* General Block Settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Block Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">
                  {groupInfo ? 'Group Repetitions (N × Box)' : 'Backbone Layer Repetitions'}
                </label>
                {groupInfo && (
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    {groupInfo.groupName}
                  </span>
                )}
              </div>
              {groupInfo ? (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="1"
                      max="1024"
                      value={groupInfo.repetitions}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        if (onUpdateGroupRepetitions) {
                          onUpdateGroupRepetitions(groupInfo.groupId, val);
                        }
                      }}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono font-semibold border focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                        isDark ? 'bg-slate-800 border-rose-500/40 text-rose-400' : 'bg-rose-50/50 border-rose-300 text-rose-700'
                      }`}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-rose-500">×</span>
                  </div>
                  <span className="text-[11px] text-slate-400 shrink-0">repeats container</span>
                </div>
              ) : (
                <input
                  type="number"
                  min="1"
                  max="256"
                  value={repeatLayers}
                  onChange={(e) => setRepeatLayers(Math.max(1, parseInt(e.target.value) || 1))}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                  }`}
                />
              )}
            </div>
          </div>

          {/* Module-Specific Hyperparameters */}
          <div className={`p-3 rounded-xl border space-y-3 ${
            isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {block.moduleType} Parameters
            </h4>

            {/* Embedding Inputs */}
            {block.moduleType === 'nn.Embedding' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Vocabulary Size (vocab_size)</label>
                  <input
                    type="number"
                    value={params.vocabSize || 128256}
                    onChange={(e) => handleParamChange('vocabSize', parseInt(e.target.value) || 0)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Embedding Dimension (d_model)</label>
                  <input
                    type="number"
                    value={params.embeddingDim || 8192}
                    onChange={(e) => handleParamChange('embeddingDim', parseInt(e.target.value) || 0)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Conv2d Inputs */}
            {block.moduleType === 'nn.Conv2d' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Input Channels (C_in)</label>
                    <input
                      type="number"
                      value={params.inChannels ?? 3}
                      onChange={(e) => handleParamChange('inChannels', parseInt(e.target.value) || 1)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Output Channels (C_out)</label>
                    <input
                      type="number"
                      value={params.outChannels ?? 64}
                      onChange={(e) => handleParamChange('outChannels', parseInt(e.target.value) || 1)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Kernel Size (K)</label>
                    <input
                      type="number"
                      value={params.kernelSize ?? 7}
                      onChange={(e) => handleParamChange('kernelSize', parseInt(e.target.value) || 1)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Stride</label>
                    <input
                      type="number"
                      value={params.stride ?? 2}
                      onChange={(e) => handleParamChange('stride', parseInt(e.target.value) || 1)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Padding</label>
                    <input
                      type="number"
                      value={params.padding ?? 3}
                      onChange={(e) => handleParamChange('padding', parseInt(e.target.value) || 0)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Attention Inputs */}
            {block.moduleType === 'nn.MultiheadAttention' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Hidden Dim (d_model)</label>
                    <input
                      type="number"
                      value={params.dModel || 8192}
                      onChange={(e) => handleParamChange('dModel', parseInt(e.target.value) || 0)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Head Dim (d_head)</label>
                    <input
                      type="number"
                      value={params.headDim || 128}
                      onChange={(e) => handleParamChange('headDim', parseInt(e.target.value) || 0)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Query Heads (num_heads)</label>
                    <input
                      type="number"
                      value={params.numHeads || 64}
                      onChange={(e) => handleParamChange('numHeads', parseInt(e.target.value) || 1)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">KV Heads (GQA/MQA compression)</label>
                    <input
                      type="number"
                      value={params.numKVHeads || 8}
                      onChange={(e) => handleParamChange('numKVHeads', parseInt(e.target.value) || 1)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SwiGLU / FFN Inputs */}
            {block.moduleType === 'nn.SwiGLUFFN' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Input Features (in_features)</label>
                  <input
                    type="number"
                    value={params.inFeatures || 8192}
                    onChange={(e) => handleParamChange('inFeatures', parseInt(e.target.value) || 0)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Intermediate Dim (8/3 × d)</label>
                  <input
                    type="number"
                    value={params.intermediateDim || 28672}
                    onChange={(e) => handleParamChange('intermediateDim', parseInt(e.target.value) || 0)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* MoE Inputs */}
            {block.moduleType === 'nn.MoEBlock' && (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Hidden Dim (d_model)</label>
                    <input
                      type="number"
                      value={params.dModel || 8192}
                      onChange={(e) => handleParamChange('dModel', parseInt(e.target.value) || 0)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Expert Hidden Dim</label>
                    <input
                      type="number"
                      value={params.intermediateDim || 28672}
                      onChange={(e) => handleParamChange('intermediateDim', parseInt(e.target.value) || 0)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Total Routed Experts (E)</label>
                    <input
                      type="number"
                      value={params.numExperts || 64}
                      onChange={(e) => handleParamChange('numExperts', parseInt(e.target.value) || 1)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Top-K Active Experts</label>
                    <input
                      type="number"
                      value={params.topK || 8}
                      onChange={(e) => handleParamChange('topK', parseInt(e.target.value) || 1)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Norm Inputs */}
            {(block.moduleType === 'nn.RMSNorm' || block.moduleType === 'nn.LayerNorm') && (
              <div>
                <label className="text-xs font-medium block mb-1">Normalized Shape</label>
                <input
                  type="number"
                  value={params.normalizedShape || 8192}
                  onChange={(e) => handleParamChange('normalizedShape', parseInt(e.target.value) || 0)}
                  className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                  }`}
                />
              </div>
            )}

            {/* Linear Inputs */}
            {block.moduleType === 'nn.Linear' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">In Features</label>
                  <input
                    type="number"
                    value={params.inFeatures || 8192}
                    onChange={(e) => handleParamChange('inFeatures', parseInt(e.target.value) || 0)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Out Features</label>
                  <input
                    type="number"
                    value={params.outFeatures || 8192}
                    onChange={(e) => handleParamChange('outFeatures', parseInt(e.target.value) || 0)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* LM Head Inputs */}
            {block.moduleType === 'nn.CrossEntropyHead' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Hidden Dim</label>
                  <input
                    type="number"
                    value={params.dModel || 8192}
                    onChange={(e) => handleParamChange('dModel', parseInt(e.target.value) || 0)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Vocab Size</label>
                  <input
                    type="number"
                    value={params.vocabSize || 128256}
                    onChange={(e) => handleParamChange('vocabSize', parseInt(e.target.value) || 0)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Elementwise Add Inputs */}
            {block.moduleType === 'op.Add' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Channel Dim (d_model)</label>
                    <input
                      type="number"
                      value={params.dModel || 8192}
                      onChange={(e) => handleParamChange('dModel', parseInt(e.target.value) || 0)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Residual Scale (Alpha)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={params.alpha ?? 1.0}
                      onChange={(e) => handleParamChange('alpha', parseFloat(e.target.value) || 1.0)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                      }`}
                    />
                  </div>
                </div>
                <div className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  <span className="font-semibold">Residual Skip Sum:</span> Computes elementwise in-place or out-of-place vector accumulation <code className="font-mono font-bold">y = x + f(x)</code> with zero trainable parameters and memory bandwidth-dominated execution.
                </div>
              </div>
            )}

            {/* Residual Origin Inputs */}
            {block.moduleType === 'op.ResidualOrigin' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Stream Dimension (d_model)</label>
                  <input
                    type="number"
                    value={params.dModel || 8192}
                    onChange={(e) => handleParamChange('dModel', parseInt(e.target.value) || 0)}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  />
                </div>
                <div className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                  <span className="font-semibold">Residual Stream Origin:</span> Serves as the identity bifurcation point <code className="font-mono font-bold">x → [x_residual, x_main]</code> positioned at the layer entrance inside repetition groups to guarantee local, per-iteration residual scoping.
                </div>
              </div>
            )}
          </div>

          {/* Cluster Placement */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium block mb-1">Assigned Accelerator (GPU #)</label>
              <input
                type="number"
                min="0"
                max="63"
                value={assignedGPU}
                onChange={(e) => setAssignedGPU(parseInt(e.target.value) || 0)}
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Assigned Node (#)</label>
              <input
                type="number"
                min="0"
                max="63"
                value={assignedNode}
                onChange={(e) => setAssignedNode(parseInt(e.target.value) || 0)}
                className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                }`}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {onDuplicateBlock && (
                <button
                  type="button"
                  onClick={() => {
                    onDuplicateBlock(block.id);
                    onClose();
                  }}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <Copy className="w-3.5 h-3.5" />
                  Duplicate
                </button>
              )}

              {onDeleteBlock && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteBlock(block.id);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Block
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  isDark ? 'border-slate-700 hover:bg-slate-800 text-slate-300' : 'border-slate-300 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                Apply Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
