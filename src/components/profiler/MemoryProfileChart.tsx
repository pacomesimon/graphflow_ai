import React from 'react';
import { MemoryProfile, HardwareSpec, RuntimeDimensions } from '../../types';
import { Database, AlertOctagon, CheckCircle2, Server, HelpCircle } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface MemoryProfileChartProps {
  memory: MemoryProfile;
  hardware: HardwareSpec;
  runtime: RuntimeDimensions;
}

export const MemoryProfileChart: React.FC<MemoryProfileChartProps> = ({
  memory,
  hardware,
  runtime
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const formatBytes = (gb: number) => {
    if (gb >= 1000) return `${(gb / 1000).toFixed(2)} TB`;
    return `${gb.toFixed(2)} GB`;
  };

  const weightsPct = Math.min(100, (memory.weightsGB / hardware.vramGBPerGPU) * 100);
  const optPct = Math.min(100, (memory.optimizerGB / hardware.vramGBPerGPU) * 100);
  const actPct = Math.min(100, (memory.activationGB / hardware.vramGBPerGPU) * 100);
  const kvPct = Math.min(100, (memory.kvCacheGB / hardware.vramGBPerGPU) * 100);

  const isKvBottleneck = memory.kvCacheGB > hardware.vramGBPerGPU * 0.45;

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isDark 
        ? 'bg-slate-900/90 border-slate-800 text-slate-100 shadow-xl' 
        : 'bg-white border-slate-200 text-slate-800 shadow-md'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${
            isDark ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-indigo-50 border-indigo-200 text-indigo-600'
          }`}>
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`text-xs font-semibold tracking-wide flex items-center gap-1.5 ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              VRAM Footprint Allocator
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}>
                {hardware.name}
              </span>
            </h3>
            <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Theoretical breakdown across model parameters, optimizer, and KV context
            </p>
          </div>
        </div>

        {/* OOM / Status Indicator */}
        <div className="flex items-center gap-1">
          {memory.totalGB === 0 ? (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono border ${
              isDark ? 'bg-slate-800/90 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
              <span>0 GB (Canvas Cleared)</span>
            </div>
          ) : memory.isOOM ? (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono font-bold border animate-pulse ${
              isDark ? 'bg-rose-950/80 border-rose-700 text-rose-300' : 'bg-rose-50 border-rose-300 text-rose-700'
            }`}>
              <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
              <span>OOM ({(memory.perGpuGB - hardware.vramGBPerGPU).toFixed(1)} GB Deficit)</span>
            </div>
          ) : (
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono border ${
              isDark ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300' : 'bg-emerald-50 border-emerald-300 text-emerald-700'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Fits in VRAM ({((memory.perGpuGB / hardware.vramGBPerGPU) * 100).toFixed(0)}% utilized)</span>
            </div>
          )}
        </div>
      </div>

      {/* Stacked Memory Progress Bar */}
      <div className="space-y-2 mb-3">
        <div className="flex justify-between text-xs font-mono">
          <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Allocated VRAM</span>
          <span className={`font-semibold ${memory.isOOM ? 'text-rose-500' : isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {formatBytes(memory.perGpuGB)} / {hardware.vramGBPerGPU} GB
          </span>
        </div>

        <div className={`w-full h-4 rounded-md overflow-hidden flex p-0.5 border ${
          isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-slate-100 border-slate-200'
        }`}>
          {weightsPct > 0 && (
            <div
              style={{ width: `${weightsPct}%` }}
              className="h-full bg-indigo-500 hover:bg-indigo-400 transition-all rounded-sm relative group cursor-pointer"
              title={`Weights: ${formatBytes(memory.weightsGB)} (${weightsPct.toFixed(1)}%)`}
            >
              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 text-white border border-slate-700 text-[10px] font-mono rounded shadow-lg whitespace-nowrap z-30 transition-opacity">
                Weights: {formatBytes(memory.weightsGB)} ({weightsPct.toFixed(1)}%)
              </div>
            </div>
          )}
          {optPct > 0 && (
            <div
              style={{ width: `${optPct}%` }}
              className="h-full bg-blue-500 hover:bg-blue-400 transition-all rounded-sm relative group cursor-pointer"
              title={`Optimizer: ${formatBytes(memory.optimizerGB)} (${optPct.toFixed(1)}%)`}
            >
              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 text-white border border-slate-700 text-[10px] font-mono rounded shadow-lg whitespace-nowrap z-30 transition-opacity">
                Optimizer: {formatBytes(memory.optimizerGB)} ({optPct.toFixed(1)}%)
              </div>
            </div>
          )}
          {actPct > 0 && (
            <div
              style={{ width: `${actPct}%` }}
              className="h-full bg-emerald-500 hover:bg-emerald-400 transition-all rounded-sm relative group cursor-pointer"
              title={`Activations: ${formatBytes(memory.activationGB)} (${actPct.toFixed(1)}%)`}
            >
              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 text-white border border-slate-700 text-[10px] font-mono rounded shadow-lg whitespace-nowrap z-30 transition-opacity">
                Activations: {formatBytes(memory.activationGB)} ({actPct.toFixed(1)}%)
              </div>
            </div>
          )}
          {kvPct > 0 && (
            <div
              style={{ width: `${kvPct}%` }}
              className={`h-full ${isKvBottleneck ? 'bg-amber-500 hover:bg-amber-400' : 'bg-cyan-500 hover:bg-cyan-400'} transition-all rounded-sm relative group cursor-pointer`}
              title={`KV Cache: ${formatBytes(memory.kvCacheGB)} (${kvPct.toFixed(1)}%)`}
            >
              <div className="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 text-white border border-slate-700 text-[10px] font-mono rounded shadow-lg whitespace-nowrap z-30 transition-opacity">
                KV Cache: {formatBytes(memory.kvCacheGB)} ({kvPct.toFixed(1)}%)
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 shrink-0" />
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Weights:</span>
            <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{formatBytes(memory.weightsGB)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 shrink-0" />
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Optimizer:</span>
            <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{formatBytes(memory.optimizerGB)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 shrink-0" />
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Activations:</span>
            <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{formatBytes(memory.activationGB)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${isKvBottleneck ? 'bg-amber-500' : 'bg-cyan-500'} shrink-0`} />
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>KV Cache:</span>
            <span className={`font-semibold ${isKvBottleneck ? 'text-amber-500' : isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              {formatBytes(memory.kvCacheGB)}
            </span>
          </div>
        </div>
      </div>

      {/* Numerical Details Row */}
      <div className={`pt-3 border-t grid grid-cols-3 gap-2 text-center text-xs ${
        isDark ? 'border-slate-800' : 'border-slate-200'
      }`}>
        <div className={`p-2 rounded-lg border ${
          isDark ? 'bg-slate-800/40 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <div className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Per-GPU Footprint
          </div>
          <div className={`text-sm font-semibold font-mono mt-0.5 ${
            memory.isOOM ? 'text-rose-500' : isDark ? 'text-sky-300' : 'text-sky-600'
          }`}>
            {formatBytes(memory.perGpuGB)}
          </div>
        </div>
        <div className={`p-2 rounded-lg border ${
          isDark ? 'bg-slate-800/40 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <div className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Hardware Limit
          </div>
          <div className="text-sm font-semibold font-mono mt-0.5">
            {hardware.vramGBPerGPU} GB / GPU
          </div>
        </div>
        <div className={`p-2 rounded-lg border ${
          isDark ? 'bg-slate-800/40 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <div className={`text-[10px] uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Total Model State
          </div>
          <div className="text-sm font-semibold font-mono mt-0.5">
            {formatBytes(memory.totalGB)}
          </div>
        </div>
      </div>
    </div>
  );
};
