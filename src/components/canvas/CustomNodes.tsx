import React, { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Cpu, 
  Layers, 
  Sliders, 
  AlertTriangle, 
  Zap, 
  Database, 
  GitBranch, 
  Binary, 
  Box, 
  Network,
  Copy,
  Trash2,
  Repeat,
  Edit2,
  Check,
  Plus,
  Minus,
  Split,
  HelpCircle
} from 'lucide-react';
import { ModularBlockNodeData, RepetitionGroupNodeData } from '../../types';
import { useTheme } from '../../context/ThemeContext';

export const ModularBlockNode = memo((props: any) => {
  const { data, selected } = props;
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const nodeData = data as ModularBlockNodeData;
  const block = nodeData.block;
  if (!block) return null;

  const isMismatch = nodeData.hasDimensionMismatch;
  const isCut = block.isCutBoundary;

  const getModuleBadgeColor = () => {
    switch (block.category) {
      case 'attention': return isDark ? 'bg-amber-950/80 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200';
      case 'ffn': return isDark ? 'bg-violet-950/80 text-violet-300 border-violet-800' : 'bg-violet-50 text-violet-700 border-violet-200';
      case 'moe': return isDark ? 'bg-purple-950/80 text-purple-300 border-purple-800' : 'bg-purple-50 text-purple-700 border-purple-200';
      case 'conv': return isDark ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'embedding': return isDark ? 'bg-blue-950/80 text-blue-300 border-blue-800' : 'bg-blue-50 text-blue-700 border-blue-200';
      case 'norm': return isDark ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800' : 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'head': return isDark ? 'bg-rose-950/80 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-700 border-rose-200';
      case 'ssm': return isDark ? 'bg-teal-950/80 text-teal-300 border-teal-800' : 'bg-teal-50 text-teal-700 border-teal-200';
      case 'operation': return isDark ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getIcon = () => {
    switch (block.category) {
      case 'attention': return <Zap className="w-4 h-4 text-amber-500" />;
      case 'ffn': return <Layers className="w-4 h-4 text-violet-500" />;
      case 'moe': return <GitBranch className="w-4 h-4 text-purple-500" />;
      case 'conv': return <Box className="w-4 h-4 text-emerald-500" />;
      case 'embedding': return <Database className="w-4 h-4 text-blue-500" />;
      case 'head': return <Binary className="w-4 h-4 text-rose-500" />;
      case 'norm': return <Network className="w-4 h-4 text-cyan-500" />;
      case 'ssm': return <Cpu className="w-4 h-4 text-teal-500" />;
      case 'operation': 
        if (block.moduleType === 'op.ResidualOrigin') {
          return <Split className="w-4 h-4 text-emerald-400 stroke-[2.5]" />;
        }
        return <Plus className="w-4 h-4 text-emerald-500 stroke-[2.5]" />;
      default: return <Cpu className="w-4 h-4 text-slate-500" />;
    }
  };

  const getBorderColor = () => {
    if (isMismatch) return 'border-rose-500 shadow-rose-500/20 shadow-lg';
    if (isCut) return isDark ? 'border-dashed border-rose-400 shadow-amber-500/10 shadow-md' : 'border-dashed border-rose-400 shadow-rose-100 shadow-md';
    if (selected) return isDark ? 'border-sky-400 shadow-sky-500/30 shadow-md ring-2 ring-sky-400/40' : 'border-sky-500 shadow-sky-100 shadow-md ring-2 ring-sky-400/40';
    return isDark ? 'border-slate-800 hover:border-slate-700' : 'border-slate-200 hover:border-slate-300 shadow-sm';
  };

  const formatParams = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(0)}k`;
    return `${num}`;
  };

  // Summary of specific block parameters
  const renderParamDigest = () => {
    const p = block.parameters || {};
    switch (block.moduleType) {
      case 'nn.Embedding':
        return `vocab: ${Number(p.vocabSize).toLocaleString()} | dim: ${p.embeddingDim}`;
      case 'nn.Conv2d':
        return `ch: ${p.inChannels}→${p.outChannels} | k: ${p.kernelSize}x${p.kernelSize} | s: ${p.stride}`;
      case 'nn.MultiheadAttention':
        return `d_model: ${p.dModel} | H_q: ${p.numHeads} | H_kv: ${p.numKVHeads}`;
      case 'nn.SwiGLUFFN':
        return `in: ${p.inFeatures || p.dModel} | inter: ${p.intermediateDim}`;
      case 'nn.MoEBlock':
        return `E: ${p.numExperts} experts | Top-${p.topK} | d_ffn: ${p.intermediateDim}`;
      case 'nn.RMSNorm':
      case 'nn.LayerNorm':
        return `shape: ${p.normalizedShape} | eps: ${p.eps || '1e-6'}`;
      case 'nn.Linear':
        return `in: ${p.inFeatures} → out: ${p.outFeatures}`;
      case 'nn.CrossEntropyHead':
        return `hidden: ${p.dModel} → vocab: ${Number(p.vocabSize).toLocaleString()}`;
      case 'op.Add':
        return `scale: ${p.alpha ?? 1.0} | residual add: x + F(x)`;
      case 'op.ResidualOrigin':
        return `residual origin | identity tap x → [x_main, x_skip]`;
      default:
        return Object.entries(p).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' | ');
    }
  };

  // Dedicated rendering for Residual Origin block (op.ResidualOrigin)
  if (block.moduleType === 'op.ResidualOrigin') {
    return (
      <div 
        className={`relative min-w-[300px] max-w-[340px] rounded-xl backdrop-blur-md border px-3.5 py-2.5 transition-all duration-200 ${
          isDark ? 'bg-slate-900/95 text-slate-100 shadow-xl' : 'bg-white/95 text-slate-800 shadow-md'
        } ${getBorderColor()}`}
      >
        {/* Top Input Handle for Layer Stream In (x) */}
        <Handle
          type="target"
          position={Position.Top}
          id="in"
          className={`w-3.5 h-3.5 border-2 rounded-full hover:scale-125 transition-transform ${
            isDark ? '!bg-slate-800 !border-sky-400' : '!bg-white !border-sky-500'
          }`}
          title="Layer Stream In (x)"
        />

        {/* Header & Operation Info */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border flex items-center justify-center ${
              isDark ? 'bg-emerald-950/80 border-emerald-600/60 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-700'
            }`}>
              <Split className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className={`text-xs font-bold tracking-wide ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {block.name}
                </h4>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono border ${
                  isDark ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  op.ResidualOrigin
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/90 mt-0.5">
                <span>Identity Tap: x → [x_main, x_residual]</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button 
              title="Inspect & Customize Parameters" 
              onClick={(e) => {
                e.stopPropagation();
                nodeData.onInspect?.(block.id);
              }}
              className={`p-1 rounded transition-colors ${
                isDark ? 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800' : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
            {nodeData.onDuplicate && (
              <button 
                title="Duplicate Block" 
                onClick={(e) => {
                  e.stopPropagation();
                  nodeData.onDuplicate?.(block.id);
                }}
                className={`p-1 rounded transition-colors ${
                  isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            {nodeData.onDelete && (
              <button 
                title="Delete Block" 
                onClick={(e) => {
                  e.stopPropagation();
                  nodeData.onDelete?.(block.id);
                }}
                className="p-1 rounded transition-colors text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Metrics Row */}
        <div className="mt-1.5 pt-1.5 border-t border-slate-700/40 flex items-center justify-between text-[9px] font-mono text-slate-400">
          <span>0 Params (Identity)</span>
          <span className="text-emerald-400 font-semibold">Zero FLOPs</span>
          <span className="text-emerald-300 font-medium">Residual Origin Tap</span>
        </div>

        {/* Left Residual Output Handle for skip connection */}
        <Handle
          type="source"
          position={Position.Left}
          id="residual-out"
          className={`w-3.5 h-3.5 border-2 rounded-full hover:scale-125 transition-transform ${
            isDark ? '!bg-emerald-950 !border-emerald-400' : '!bg-emerald-50 !border-emerald-600'
          }`}
          title="Residual Skip Connection Origin (x)"
        />

        {/* Bottom Output Handle for main transformation branch */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="out"
          className={`w-3.5 h-3.5 border-2 rounded-full hover:scale-125 transition-transform ${
            isDark ? '!bg-slate-800 !border-sky-400' : '!bg-white !border-sky-500'
          }`}
          title="Main Layer Stream Out to Pre-Norm (x)"
        />
      </div>
    );
  }

  // Dedicated compact rendering for operation blocks (Residual Add / op.Add)
  if (block.moduleType === 'op.Add' || block.category === 'operation') {
    return (
      <div 
        className={`relative min-w-[300px] max-w-[340px] rounded-xl backdrop-blur-md border px-3.5 py-2.5 transition-all duration-200 ${
          isDark ? 'bg-slate-900/95 text-slate-100 shadow-xl' : 'bg-white/95 text-slate-800 shadow-md'
        } ${getBorderColor()}`}
      >
        {/* Top Input Handle for Layer Output F(x) */}
        <Handle
          type="target"
          position={Position.Top}
          id="in"
          className={`w-3.5 h-3.5 border-2 rounded-full hover:scale-125 transition-transform ${
            isDark ? '!bg-slate-800 !border-sky-400' : '!bg-white !border-sky-500'
          }`}
          title="Layer Transformation Input F(x)"
        />

        {/* Left Residual Input Handle for Skip Stream x */}
        <Handle
          type="target"
          position={Position.Left}
          id="residual-in"
          className={`w-3.5 h-3.5 border-2 rounded-full hover:scale-125 transition-transform ${
            isDark ? '!bg-emerald-950 !border-emerald-400' : '!bg-emerald-50 !border-emerald-600'
          }`}
          title="Residual Skip Connection Input (x)"
        />

        {/* Header & Operation Info */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border flex items-center justify-center ${
              isDark ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-400' : 'bg-emerald-50 border-emerald-300 text-emerald-700'
            }`}>
              <Plus className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className={`text-xs font-bold tracking-wide ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                  {block.name}
                </h4>
                <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono border ${
                  isDark ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  op.Add
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/90 mt-0.5">
                <span>Residual Sum: x + F(x)</span>
                {block.parameters?.alpha !== undefined && block.parameters.alpha !== 1.0 && (
                  <span className="text-[9px] opacity-80">(α = {block.parameters.alpha})</span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button 
              title="Inspect & Customize Parameters" 
              onClick={(e) => {
                e.stopPropagation();
                nodeData.onInspect?.(block.id);
              }}
              className={`p-1 rounded transition-colors ${
                isDark ? 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800' : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
            {nodeData.onDuplicate && (
              <button 
                title="Duplicate Block" 
                onClick={(e) => {
                  e.stopPropagation();
                  nodeData.onDuplicate?.(block.id);
                }}
                className={`p-1 rounded transition-colors ${
                  isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            {nodeData.onDelete && (
              <button 
                title="Delete Block" 
                onClick={(e) => {
                  e.stopPropagation();
                  nodeData.onDelete?.(block.id);
                }}
                className="p-1 rounded transition-colors text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Metrics Row */}
        <div className="mt-1.5 pt-1.5 border-t border-slate-700/40 flex items-center justify-between text-[9px] font-mono text-slate-400">
          <span>0 Params (Elementwise)</span>
          <span className="text-emerald-400 font-semibold">{block.stats.arithmeticIntensity} FLOP/B</span>
          <span className="text-amber-400">Bandwidth Bound</span>
        </div>

        {/* Bottom Output Handle for combined stream */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="out"
          className={`w-3.5 h-3.5 border-2 rounded-full hover:scale-125 transition-transform ${
            isDark ? '!bg-slate-800 !border-sky-400' : '!bg-white !border-sky-500'
          }`}
          title="Merged Stream Out: x + F(x)"
        />
      </div>
    );
  }

  return (
    <div 
      className={`relative min-w-[280px] max-w-[340px] rounded-xl backdrop-blur-md border p-3.5 transition-all duration-200 ${
        isDark ? 'bg-slate-900/95 text-slate-100 shadow-xl' : 'bg-white/95 text-slate-800 shadow-md'
      } ${getBorderColor()}`}
    >
      {/* Top Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="in"
        className={`w-3.5 h-3.5 border-2 rounded-full hover:scale-125 transition-transform ${
          isDark ? '!bg-slate-800 !border-sky-400' : '!bg-white !border-sky-500'
        }`}
      />

      {/* Left Residual Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="residual-in"
        style={{ top: '35%' }}
        className={`w-3.5 h-3.5 border-2 rounded-full hover:scale-125 transition-transform ${
          isDark ? '!bg-emerald-950 !border-emerald-400' : '!bg-emerald-50 !border-emerald-600'
        }`}
        title="Residual Stream Input (x)"
      />

      {/* Left Residual Output Handle (for branching residual skip stream) */}
      <Handle
        type="source"
        position={Position.Left}
        id="residual-out"
        style={{ top: '65%' }}
        className={`w-3.5 h-3.5 border-2 rounded-full hover:scale-125 transition-transform ${
          isDark ? '!bg-emerald-950 !border-emerald-400' : '!bg-emerald-50 !border-emerald-600'
        }`}
        title="Residual Skip Branch (x)"
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${
            isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-100 border-slate-200'
          }`}>
            {getIcon()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className={`text-xs font-semibold tracking-wide ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {block.name}
              </h4>
              {!nodeData.isInRepetitionGroup && block.repeatLayers && block.repeatLayers > 1 && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono flex items-center gap-0.5 border ${
                  isDark ? 'bg-slate-800 text-sky-300 border-slate-700' : 'bg-sky-50 text-sky-700 border-sky-200'
                }`} title={`Repeats ${block.repeatLayers} times in the backbone`}>
                  <Repeat className="w-2.5 h-2.5" />
                  ×{block.repeatLayers}
                </span>
              )}
              {nodeData.isInRepetitionGroup && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono flex items-center gap-0.5 border ${
                  isDark ? 'bg-rose-950/60 text-rose-300 border-rose-800/60' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`} title="Part of repeated backbone layer block">
                  Sub-layer
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`text-[10px] font-mono px-1 py-0.2 rounded border ${getModuleBadgeColor()}`}>
                {block.moduleType}
              </span>
              <span className={`text-[10px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {renderParamDigest()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button 
            title="Inspect & Customize Block Parameters" 
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onInspect?.(block.id);
            }}
            className={`p-1 rounded transition-colors ${
              isDark ? 'text-slate-400 hover:text-sky-300 hover:bg-slate-800' : 'text-slate-400 hover:text-sky-600 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
          {nodeData.onDuplicate && (
            <button 
              title="Duplicate Block" 
              onClick={(e) => {
                e.stopPropagation();
                nodeData.onDuplicate?.(block.id);
              }}
              className={`p-1 rounded transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}
          {nodeData.onDelete && (
            <button 
              title="Delete Block" 
              onClick={(e) => {
                e.stopPropagation();
                nodeData.onDelete?.(block.id);
              }}
              className={`p-1 rounded transition-colors text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tensor Flow Dimensions */}
      <div className={`text-[10px] font-mono px-2 py-1 rounded border mb-2 flex items-center justify-between ${
        isDark ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
      }`}>
        <span>In: {block.inputShape?.label || 'Tokens'}</span>
        <span>→</span>
        <span>Out: {block.outputShape?.label || 'Tensor'}</span>
      </div>

      {/* Dimension Mismatch Alert */}
      {isMismatch && (
        <div className={`mb-2 p-1.5 rounded-lg border text-[10px] flex items-center gap-1.5 ${
          isDark ? 'bg-rose-950/80 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
        }`}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
          <span>{nodeData.mismatchDetail || 'Dimension mismatch with input tensor!'}</span>
        </div>
      )}

      {/* Numerical Metrics Cards */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono mb-2">
        <div className={`p-1.5 rounded border flex flex-col ${
          isDark ? 'bg-slate-800/50 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <span className={`text-[9px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Parameters</span>
          <span className="font-semibold mt-0.5">
            {formatParams(block.stats.params)}
            {block.category === 'moe' && (
              <span className="text-[8px] opacity-75 font-sans ml-1">
                ({formatParams(block.stats.activeParams)} act)
              </span>
            )}
          </span>
        </div>

        <div className={`p-1.5 rounded border flex flex-col ${
          isDark ? 'bg-slate-800/50 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <span className={`text-[9px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Intensity</span>
          <span className={`font-semibold mt-0.5 ${
            block.stats.memoryBound ? 'text-amber-500' : 'text-emerald-500'
          }`}>
            {block.stats.arithmeticIntensity} FLOP/B
          </span>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-[9px] font-mono pt-1">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${
            block.stats.memoryBound ? 'bg-amber-500' : 'bg-emerald-500'
          }`} />
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>
            {block.stats.memoryBound ? 'Bandwidth Bound' : 'Compute Bound'}
          </span>
        </div>

        <div className={`px-1.5 py-0.2 rounded border ${
          isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
        }`}>
          GPU #{block.assignedGPU ?? 0} [N{block.assignedNode ?? 0}]
        </div>
      </div>

      {/* Bottom Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        className={`w-3.5 h-3.5 border-2 rounded-full hover:scale-125 transition-transform ${
          isDark ? '!bg-slate-800 !border-sky-400' : '!bg-white !border-sky-500'
        }`}
      />
    </div>
  );
});

export const RepetitionGroupNode = memo((props: any) => {
  const { data } = props;
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const nodeData = data as RepetitionGroupNodeData;
  const group = nodeData?.group;
  if (!group) return null;

  const [isEditingReps, setIsEditingReps] = useState(false);
  const [repInput, setRepInput] = useState(String(group.repetitions));
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(group.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRepInput(String(group.repetitions));
  }, [group.repetitions]);

  useEffect(() => {
    if (isEditingReps) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingReps]);

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingName]);

  const handleSaveReps = () => {
    const val = parseInt(repInput, 10);
    if (!isNaN(val) && val > 0) {
      nodeData.onUpdateRepetitions?.(val);
    } else {
      setRepInput(String(group.repetitions));
    }
    setIsEditingReps(false);
  };

  const handleSaveName = () => {
    if (nameInput.trim()) {
      nodeData.onUpdateGroupName?.(nameInput.trim());
    } else {
      setNameInput(group.name);
    }
    setIsEditingName(false);
  };

  const handleIncrement = (delta: number) => {
    const nextVal = Math.max(1, group.repetitions + delta);
    nodeData.onUpdateRepetitions?.(nextVal);
  };

  const formatParams = (num: number) => {
    if (!num) return '0';
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(0)}k`;
    return `${num}`;
  };

  return (
    <div className="relative w-full h-full">
      {/* Background Container matching DeepSeek V3 / R1 diagram */}
      <div 
        className={`absolute inset-0 rounded-3xl transition-all duration-200 pointer-events-none ${
          isDark 
            ? 'bg-rose-500/[0.08] border-2 border-rose-500/40 shadow-2xl shadow-rose-950/30' 
            : 'bg-rose-500/[0.09] border-2 border-rose-400/60 shadow-xl shadow-rose-200/40'
        }`}
      />

      {/* Top Header Floating Bar */}
      <div className="absolute -top-5 left-6 right-6 flex items-center justify-between pointer-events-none z-10">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-lg backdrop-blur-md pointer-events-auto transition-colors ${
          isDark ? 'bg-slate-900/95 border-rose-500/40 text-rose-200' : 'bg-white/95 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded-md bg-rose-500/20 text-rose-500">
              <Repeat className="w-3.5 h-3.5" />
            </span>
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <input
                  ref={nameInputRef}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') {
                      setNameInput(group.name);
                      setIsEditingName(false);
                    }
                  }}
                  className="px-1.5 py-0.5 text-xs font-semibold rounded border bg-slate-800 text-slate-100 border-rose-500 focus:outline-none"
                />
                <button onClick={handleSaveName} className="p-0.5 hover:text-emerald-400 text-slate-400">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div 
                className="flex items-center gap-1.5 cursor-pointer group"
                onClick={() => setIsEditingName(true)}
                title="Click to rename repetition group"
              >
                <span className="text-xs font-bold tracking-wide">
                  {group.name}
                </span>
                <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-rose-400" />
              </div>
            )}
          </div>

          <div className="h-3 w-[1px] bg-rose-400/30" />

          {/* Per-layer & Total Params Badge */}
          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className={`px-1.5 py-0.5 rounded border ${
              isDark ? 'bg-rose-950/80 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              {formatParams(nodeData.perLayerParams)} / layer
            </span>
            <span className="text-rose-400 font-semibold">
              Total: {formatParams(nodeData.totalGroupParams)} ({group.repetitions}×)
            </span>
          </div>
        </div>

        {/* Ungroup Button */}
        {nodeData.onUngroup && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onUngroup?.();
            }}
            title="Ungroup this repeated stack back into standalone layers"
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono shadow-md backdrop-blur-md pointer-events-auto transition-all ${
              isDark 
                ? 'bg-slate-900/90 border-slate-700 text-slate-400 hover:text-rose-300 hover:border-rose-500/50' 
                : 'bg-white/95 border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-300'
            }`}
          >
            <Split className="w-3 h-3 text-rose-500" />
            <span>Ungroup</span>
          </button>
        )}
      </div>

      {/* BOTTOM-LEFT: Stylized Bracket & Multiplier "61 ×" */}
      {/* Exactly replicating the DeepSeek V3 / R1 diagram! */}
      <div className="absolute -bottom-6 -left-12 flex items-center gap-2 pointer-events-auto z-20">
        {/* Multiplier Widget ("61 ×") */}
        <div className="relative group">
          {isEditingReps ? (
            <div className={`flex items-center gap-1.5 p-1.5 px-2 rounded-xl border-2 shadow-2xl backdrop-blur-md animate-in fade-in ${
              isDark ? 'bg-slate-900 border-rose-500 text-slate-100 shadow-rose-950/50' : 'bg-white border-rose-500 text-slate-900 shadow-rose-200'
            }`}>
              <button 
                onClick={() => handleIncrement(-1)}
                className="p-1 rounded hover:bg-rose-500/20 text-rose-500 transition-colors"
                title="Decrement layer repetition"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <input
                ref={inputRef}
                type="number"
                min="1"
                max="512"
                value={repInput}
                onChange={(e) => setRepInput(e.target.value)}
                onBlur={handleSaveReps}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveReps();
                  if (e.key === 'Escape') {
                    setRepInput(String(group.repetitions));
                    setIsEditingReps(false);
                  }
                }}
                className={`w-14 px-1.5 py-0.5 text-sm font-mono font-bold text-center rounded border outline-none ${
                  isDark ? 'bg-slate-800 text-rose-400 border-rose-500/50' : 'bg-rose-50 text-rose-600 border-rose-300'
                }`}
              />

              <span className="font-bold text-rose-500 font-mono text-sm">×</span>

              <button 
                onClick={() => handleIncrement(1)}
                className="p-1 rounded hover:bg-rose-500/20 text-rose-500 transition-colors"
                title="Increment layer repetition"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleSaveReps}
                className="p-1 rounded bg-rose-500 hover:bg-rose-600 text-white ml-0.5"
                title="Apply changes"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div 
              onClick={() => setIsEditingReps(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 cursor-pointer shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-105 select-none ${
                isDark 
                  ? 'bg-slate-900/95 border-rose-500 text-rose-400 hover:border-rose-400 shadow-rose-950/50' 
                  : 'bg-white/95 border-rose-500 text-rose-600 hover:border-rose-600 shadow-rose-200/60'
              }`}
              title="Click to edit repetition multiplier (N×)"
            >
              <span className="text-base font-black font-mono tracking-tight text-rose-500">
                {group.repetitions} ×
              </span>
              <span className={`text-[10px] font-mono px-1 py-0.2 rounded border ${
                isDark ? 'bg-rose-950/70 border-rose-800 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-600'
              }`}>
                Layers
              </span>
              <Edit2 className="w-3 h-3 text-rose-400 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
            </div>
          )}

          {/* Quick Increment/Decrement Steppers on Hover */}
          {!isEditingReps && (
            <div className="absolute -top-7 left-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 dark:bg-slate-800/90 border border-slate-700 rounded-lg p-0.5 shadow-md">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleIncrement(-1);
                }}
                className="p-1 hover:bg-slate-700 rounded text-slate-200"
                title="Decrement (-1)"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleIncrement(1);
                }}
                className="p-1 hover:bg-slate-700 rounded text-slate-200"
                title="Increment (+1)"
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </div>

        {/* The Curly Bracket SVG matching the DeepSeek diagram */}
        <div className="flex items-center -ml-1 text-rose-500 select-none">
          <svg width="18" height="42" viewBox="0 0 18 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M 16 3 C 9 3 5 8 5 16 C 5 19 2 21 0 21 C 2 21 5 23 5 26 C 5 34 9 39 16 39" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              fill="none" 
            />
          </svg>
        </div>
      </div>
    </div>
  );
});
