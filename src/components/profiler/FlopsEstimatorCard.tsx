import React from 'react';
import { ModelDimensions, RuntimeDimensions, PrecisionType, DistributedConfig, HardwareSpec } from '../../types';
import { calculateFLOPs, calculateModelParameters } from '../../engine/scalingMath';
import { Zap, Cpu } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface FlopsEstimatorCardProps {
  dim: ModelDimensions;
  runtime: RuntimeDimensions;
  precision: PrecisionType;
  dist: DistributedConfig;
  hardware: HardwareSpec;
}

export const FlopsEstimatorCard: React.FC<FlopsEstimatorCardProps> = ({
  dim,
  runtime,
  precision,
  dist,
  hardware
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const flopsData = calculateFLOPs(dim, runtime);
  const { activeParams } = calculateModelParameters(dim);
  const totalGPUs = dist.numNodes * dist.gpusPerNode;

  const peakClusterTFlops = totalGPUs * (precision === 'INT8' || precision === 'FP4' ? hardware.peakTFlopsFP8 : hardware.peakTFlopsFP16);
  // Realistic Model FLOPs Utilization (MFU) ~ 48%
  const assumedMFU = 0.48;
  const effectiveClusterTFlops = peakClusterTFlops * assumedMFU;

  // Forward pass time per step in milliseconds
  const fwdTimeMs = effectiveClusterTFlops > 0 
    ? ((flopsData.fwdFlopsPerToken * runtime.batchSize * (runtime.promptTokens + runtime.generationTokens)) / (effectiveClusterTFlops * 1e12)) * 1000 
    : 0;

  // Tokens per second throughput estimate
  const totalTokensInStep = runtime.batchSize * (runtime.promptTokens + runtime.generationTokens);
  const tokensPerSec = fwdTimeMs > 0 ? (totalTokensInStep / (fwdTimeMs / 1000)) : 0;

  return (
    <div className={`rounded-xl p-4 border transition-all ${
      isDark 
        ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-xl' 
        : 'bg-white border-slate-200 text-slate-800 shadow-md'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${
            isDark ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-cyan-50 border-cyan-200 text-cyan-600'
          }`}>
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`text-xs font-semibold tracking-wide ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              Live FLOPs & Throughput Estimator
            </h3>
            <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Analytical Compute Scaling for Forward & Backward Passes
            </p>
          </div>
        </div>

        <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${
          dim.numLayers === 0
            ? (isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200')
            : (isDark ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80' : 'bg-cyan-50 text-cyan-700 border-cyan-200')
        }`}>
          {dim.numLayers === 0 ? 'Idle (0 FLOPs)' : `MFU: ${(assumedMFU * 100).toFixed(0)}% Target`}
        </span>
      </div>

      {/* Grid of Key Numerical Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 font-mono">
        <div className={`p-2.5 rounded-lg border ${
          isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Forward FLOPs / Token</div>
          <div className={`text-sm font-bold mt-1 ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>
            {flopsData.formattedPerToken}
          </div>
          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {dim.numLayers === 0 ? '0 active params' : `≈ 2P (${activeParams >= 1e9 ? `${(activeParams / 1e9).toFixed(1)}B active` : `${(activeParams / 1e6).toFixed(0)}M`})`}
          </div>
        </div>

        <div className={`p-2.5 rounded-lg border ${
          isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Step Compute</div>
          <div className={`text-sm font-bold mt-1 ${isDark ? 'text-sky-300' : 'text-sky-600'}`}>
            {flopsData.formattedStepFlops}
          </div>
          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {dim.numLayers === 0 ? '0 Tokens / Step' : `${totalTokensInStep.toLocaleString()} Tokens / Step`}
          </div>
        </div>

        <div className={`p-2.5 rounded-lg border ${
          isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Est. Step Time</div>
          <div className={`text-sm font-bold mt-1 ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>
            {dim.numLayers === 0 ? '0.0ms' : fwdTimeMs >= 1000 ? `${(fwdTimeMs / 1000).toFixed(2)}s` : `${fwdTimeMs.toFixed(1)}ms`}
          </div>
          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            On {totalGPUs}x {hardware.vendor} GPUs
          </div>
        </div>

        <div className={`p-2.5 rounded-lg border ${
          isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`text-[10px] uppercase ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Cluster Throughput</div>
          <div className={`text-sm font-bold mt-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
            {dim.numLayers === 0 ? '0 tok/s' : tokensPerSec >= 1000 ? `${(tokensPerSec / 1000).toFixed(1)}k tok/s` : `${tokensPerSec.toFixed(0)} tok/s`}
          </div>
          <div className={`text-[10px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {dim.numLayers === 0 ? 'Idle (Canvas Cleared)' : 'Effective Execution Rate'}
          </div>
        </div>
      </div>

      {/* Analytical Formulation Breakdown */}
      <div className={`p-2 rounded border text-[11px] font-mono flex flex-wrap items-center justify-between gap-2 ${
        isDark ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
      }`}>
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <span>Fwd FLOPs = 2·P_act + 4·L·H·S·d_head = <strong>{flopsData.formattedPerToken}</strong></span>
        </div>
        <div>
          Cluster Peak: <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{(peakClusterTFlops / 1000).toFixed(2)} PFLOPs</strong>
        </div>
      </div>
    </div>
  );
};
