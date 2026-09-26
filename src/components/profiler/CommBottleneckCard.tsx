import React from 'react';
import { 
  DistributedConfig, 
  HardwareSpec, 
  ModelDimensions, 
  RuntimeDimensions, 
  PrecisionType, 
  CommLatencyStats 
} from '../../types';
import { calculateCommLatency } from '../../engine/scalingMath';
import { HARDWARE_DATABASE } from '../../engine/hardwareSpecs';
import { 
  Network, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRightLeft 
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface CommBottleneckCardProps {
  dist: DistributedConfig;
  onUpdateDist: (dist: DistributedConfig) => void;
  hardware: HardwareSpec;
  onUpdateHardware: (hw: HardwareSpec) => void;
  dim: ModelDimensions;
  runtime: RuntimeDimensions;
  precision: PrecisionType;
}

export const CommBottleneckCard: React.FC<CommBottleneckCardProps> = ({
  dist,
  onUpdateDist,
  hardware,
  onUpdateHardware,
  dim,
  runtime,
  precision
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const commStats: CommLatencyStats = calculateCommLatency(dim, runtime, precision, dist, hardware);
  const totalGPUs = dist.numNodes * dist.gpusPerNode;

  const handleClusterPreset = (nodes: number) => {
    onUpdateDist({
      ...dist,
      numNodes: nodes
    });
  };

  return (
    <div className={`rounded-xl p-4 border transition-all ${
      isDark 
        ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-xl' 
        : 'bg-white border-slate-200 text-slate-800 shadow-md'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${
            isDark ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-purple-50 border-purple-200 text-purple-600'
          }`}>
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`text-xs font-semibold tracking-wide ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              Distributed Topology & Interconnect Profiler
            </h3>
            <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Cluster Partitioning & Inter-GPU Communication Bottleneck Prediction
            </p>
          </div>
        </div>

        {/* Severity Badge */}
        {dim.numLayers === 0 ? (
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-mono ${
            isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
            Idle (0 Layers Partitioned)
          </span>
        ) : commStats.bottleneckSeverity === 'critical' ? (
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-mono animate-pulse ${
            isDark ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            High Comm Overhead ({commStats.commToComputeRatio}%)
          </span>
        ) : commStats.bottleneckSeverity === 'moderate' ? (
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-mono ${
            isDark ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            Moderate Comm Overhead ({commStats.commToComputeRatio}%)
          </span>
        ) : (
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-mono ${
            isDark ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Compute Dominant ({commStats.commToComputeRatio}% Comm)
          </span>
        )}
      </div>

      {/* Cluster Node Presets & Target Hardware Selection */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 p-3 rounded-lg border ${
        isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'
      }`}>
        <div>
          <label className={`text-xs font-medium block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Target Hardware Architecture:
          </label>
          <select
            value={hardware.id}
            onChange={(e) => {
              const selected = HARDWARE_DATABASE.find(h => h.id === e.target.value);
              if (selected) onUpdateHardware(selected);
            }}
            className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer ${
              isDark 
                ? 'bg-slate-800 border-slate-700 text-slate-200' 
                : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            {HARDWARE_DATABASE.map(hw => (
              <option key={hw.id} value={hw.id}>
                {hw.name} ({hw.vramGBPerGPU}GB, {hw.memoryBandwidthTBps}TB/s, NVLink: {hw.nvlinkBandwidthGBps}GB/s)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={`text-xs font-medium block mb-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Target Cluster Scale:
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 4, 16, 64].map((nodes) => {
              const gpus = nodes * 8;
              const isActive = dist.numNodes === nodes;
              return (
                <button
                  key={nodes}
                  onClick={() => handleClusterPreset(nodes)}
                  className={`px-2 py-1 rounded text-xs font-mono border transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white border-purple-400 shadow'
                      : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  {gpus}x GPUs
                  <div className="text-[9px] opacity-75 font-sans">({nodes} {nodes === 1 ? 'Node' : 'Nodes'})</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sharding Simulators (TP, PP, EP, ZeRO) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        {/* Tensor Parallelism (TP) */}
        <div className={`p-2.5 rounded-lg border ${
          isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Tensor (TP)</span>
            <span className={`font-mono font-bold ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>{dist.tensorParallelism}x</span>
          </div>
          <div className="flex gap-1 mt-1.5">
            {[1, 2, 4, 8].map(val => (
              <button
                key={val}
                onClick={() => onUpdateDist({ ...dist, tensorParallelism: val })}
                className={`flex-1 py-0.5 rounded text-[10px] font-mono border ${
                  dist.tensorParallelism === val 
                    ? 'bg-purple-600 border-purple-400 text-white' 
                    : isDark
                    ? 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
          <div className={`text-[9px] mt-1 font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Intra-layer Ring All-Reduce
          </div>
        </div>

        {/* Pipeline Parallelism (PP) */}
        <div className={`p-2.5 rounded-lg border ${
          isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Pipeline (PP)</span>
            <span className={`font-mono font-bold ${isDark ? 'text-sky-300' : 'text-sky-600'}`}>{dist.pipelineParallelism}x</span>
          </div>
          <div className="flex gap-1 mt-1.5">
            {[1, 2, 4, 8, 16].map(val => (
              <button
                key={val}
                onClick={() => onUpdateDist({ ...dist, pipelineParallelism: val })}
                className={`flex-1 py-0.5 rounded text-[10px] font-mono border ${
                  dist.pipelineParallelism === val 
                    ? 'bg-sky-600 border-sky-400 text-white' 
                    : isDark
                    ? 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
          <div className={`text-[9px] mt-1 font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Cross-node P2P Activations
          </div>
        </div>

        {/* Expert Parallelism (EP for MoE) */}
        <div className={`p-2.5 rounded-lg border ${
          isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Expert (EP)</span>
            <span className={`font-mono font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{dist.expertParallelism}x</span>
          </div>
          <div className="flex gap-1 mt-1.5">
            {[1, 2, 4, 8, 16].map(val => (
              <button
                key={val}
                disabled={!dim.isMoE}
                onClick={() => onUpdateDist({ ...dist, expertParallelism: val })}
                className={`flex-1 py-0.5 rounded text-[10px] font-mono border ${
                  !dim.isMoE ? 'opacity-40 cursor-not-allowed' :
                  dist.expertParallelism === val 
                    ? 'bg-amber-600 border-amber-400 text-white' 
                    : isDark
                    ? 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
          <div className={`text-[9px] mt-1 font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            MoE Token All-to-All
          </div>
        </div>

        {/* ZeRO Memory Optimization */}
        <div className={`p-2.5 rounded-lg border ${
          isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>ZeRO Stage</span>
            <span className={`font-mono font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>Stage {dist.zeroStage}</span>
          </div>
          <div className="flex gap-1 mt-1.5">
            {[0, 1, 2, 3].map((val: any) => (
              <button
                key={val}
                onClick={() => onUpdateDist({ ...dist, zeroStage: val })}
                className={`flex-1 py-0.5 rounded text-[10px] font-mono border ${
                  dist.zeroStage === val 
                    ? 'bg-emerald-600 border-emerald-400 text-white' 
                    : isDark
                    ? 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900'
                }`}
              >
                {val}
              </button>
            ))}
          </div>
          <div className={`text-[9px] mt-1 font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            DP: {Math.max(1, Math.floor(totalGPUs / (dist.tensorParallelism * dist.pipelineParallelism)))}x Sharding
          </div>
        </div>
      </div>

      {/* Latency Breakdown Bar & Predicted Numbers */}
      <div className={`p-3 rounded-lg border font-mono text-xs ${
        isDark ? 'bg-slate-950/70 border-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[11px] flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            <ArrowRightLeft className="w-3.5 h-3.5 text-purple-500" />
            Predicted Communication Latency per Step:
          </span>
          <span className="font-bold text-sm">
            {commStats.totalCommTimeMs.toFixed(2)} ms / step
          </span>
        </div>

        {/* Visual Progress/Ratio Bar */}
        <div className={`h-3 w-full rounded flex overflow-hidden mb-2.5 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
          {commStats.totalCommTimeMs === 0 && commStats.computeTimeMs === 0 ? (
            <div className="h-full w-full bg-slate-700/20" title="Idle - No active layers" />
          ) : (
            <>
              <div
                style={{ width: `${Math.min(100, Math.max(2, 100 - commStats.commToComputeRatio))}%` }}
                className="h-full bg-emerald-500"
                title={`Compute Execution: ${commStats.computeTimeMs.toFixed(2)}ms`}
              />
              <div
                style={{ width: `${Math.min(100, Math.max(2, commStats.commToComputeRatio))}%` }}
                className="h-full bg-rose-500"
                title={`Communication Latency: ${commStats.totalCommTimeMs.toFixed(2)}ms`}
              />
            </>
          )}
        </div>

        {/* Specific Numbers */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <div>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>TP All-Reduce:</span>{' '}
            <strong className="text-purple-500">{commStats.tpCommTimeMs.toFixed(2)} ms</strong>
          </div>
          <div>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>PP Latency:</span>{' '}
            <strong className="text-sky-500">{commStats.ppCommTimeMs.toFixed(2)} ms</strong>
          </div>
          <div>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>MoE All-to-All:</span>{' '}
            <strong className="text-amber-500">{commStats.moeCommTimeMs.toFixed(2)} ms</strong>
          </div>
          <div>
            <span className={isDark ? 'text-slate-400' : 'text-slate-500'}>Pure Compute:</span>{' '}
            <strong className="text-emerald-500">{commStats.computeTimeMs.toFixed(2)} ms</strong>
          </div>
        </div>
      </div>
    </div>
  );
};
