import { 
  ModelDimensions, 
  RuntimeDimensions, 
  PrecisionType, 
  HardwareSpec, 
  DistributedConfig, 
  MemoryProfile, 
  RooflinePoint, 
  CommLatencyStats 
} from '../types';

export function getBytesPerParam(precision: PrecisionType): number {
  switch (precision) {
    case 'FP32': return 4;
    case 'FP16':
    case 'BF16': return 2;
    case 'FP8':
    case 'INT8': return 1;
    case 'FP4': return 0.5;
    default: return 2;
  }
}

/**
 * Calculates total and active parameter counts analytically.
 */
export function calculateModelParameters(dim: ModelDimensions): {
  totalParams: number;
  activeParams: number;
  paramsPerLayer: number;
  embeddingParams: number;
  attentionParamsPerLayer: number;
  mlpParamsPerLayer: number;
} {
  if (!dim || dim.dModel === 0 || (dim.numLayers === 0 && (!dim.vocabSize || dim.vocabSize === 0))) {
    return {
      totalParams: 0,
      activeParams: 0,
      paramsPerLayer: 0,
      embeddingParams: 0,
      attentionParamsPerLayer: 0,
      mlpParamsPerLayer: 0
    };
  }

  const d = dim.dModel;
  const L = dim.numLayers;
  const H = Math.max(1, dim.numHeads);
  const Hkv = Math.max(1, dim.numKVHeads);
  const dHead = d / H;
  const dFfn = dim.intermediateDim;

  // Embedding & Un-tied Output Head: Vocab * d * 2 (or 1 if tied)
  const embeddingParams = dim.vocabSize * d * 2;

  // Multi-Head or Grouped-Query Attention:
  // Q: d * (H * dHead) = d^2
  // K: d * (Hkv * dHead) = d * (Hkv * (d/H)) = d^2 * (Hkv / H)
  // V: d * (Hkv * dHead) = d^2 * (Hkv / H)
  // Out: d * d = d^2
  const attentionParamsPerLayer = Math.round(d * d * (2 + 2 * (Hkv / H)));

  // Layer norms (Pre-attn RMSNorm + Pre-MLP RMSNorm): 2 * d
  const normParamsPerLayer = 2 * d;

  // MLP / FFN Block
  let mlpParamsPerLayer = 0;
  let activeMlpParamsPerLayer = 0;

  if (dim.isMoE && dim.numExperts && dim.topKExperts) {
    // Router gating: d * E
    const routerParams = d * dim.numExperts;
    // Each expert with SwiGLU: 3 * d * dFfn (Gate, Up, Down)
    const singleExpertParams = 3 * d * dFfn;
    mlpParamsPerLayer = routerParams + dim.numExperts * singleExpertParams;
    activeMlpParamsPerLayer = routerParams + dim.topKExperts * singleExpertParams;
  } else {
    // Standard SwiGLU (Gate, Up, Down): 3 * d * dFfn
    mlpParamsPerLayer = 3 * d * dFfn;
    activeMlpParamsPerLayer = mlpParamsPerLayer;
  }

  const paramsPerLayer = attentionParamsPerLayer + mlpParamsPerLayer + normParamsPerLayer;
  const activeParamsPerLayer = attentionParamsPerLayer + activeMlpParamsPerLayer + normParamsPerLayer;

  const totalParams = embeddingParams + (L * paramsPerLayer);
  const activeParams = embeddingParams + (L * activeParamsPerLayer);

  return {
    totalParams,
    activeParams,
    paramsPerLayer,
    embeddingParams,
    attentionParamsPerLayer,
    mlpParamsPerLayer
  };
}

/**
 * Calculates Memory Profile breakdown: Weights, Optimizer, Activation, KV Cache.
 */
export function calculateMemoryProfile(
  dim: ModelDimensions,
  runtime: RuntimeDimensions,
  precision: PrecisionType,
  dist: DistributedConfig,
  hardware: HardwareSpec
): MemoryProfile {
  const totalGPUs = dist.numNodes * dist.gpusPerNode;

  if (!dim || dim.dModel === 0 || dim.numLayers === 0) {
    return {
      weightsGB: 0,
      optimizerGB: 0,
      activationGB: 0,
      kvCacheGB: 0,
      totalGB: 0,
      perGpuGB: 0,
      clusterCapacityGB: totalGPUs * hardware.vramGBPerGPU,
      isOOM: false
    };
  }

  const { totalParams } = calculateModelParameters(dim);
  const bytesPerParam = getBytesPerParam(precision);

  // 1. Model Weights Memory (GB)
  // Pure model parameters in specified precision
  const weightsGB = (totalParams * bytesPerParam) / (1024 ** 3);

  // 2. Optimizer States (GB)
  // AdamW requires: FP32 Master Weights (4 bytes) + FP32 Momentum (4 bytes) + FP32 Variance (4 bytes) = 12 bytes/param
  // Plus Gradients: 2 or 4 bytes/param. Total = 16 bytes/param for full FP32 AdamW.
  let optimizerGB = 0;
  if (runtime.phase === 'training') {
    const rawOptimizerBytes = totalParams * 16;
    // ZeRO stage partitioning:
    if (dist.zeroStage === 0) {
      optimizerGB = rawOptimizerBytes / (1024 ** 3);
    } else if (dist.zeroStage === 1) {
      // Optimizer state sharded across DP ranks
      const dpDegree = Math.max(1, totalGPUs / (dist.tensorParallelism * dist.pipelineParallelism));
      optimizerGB = ((totalParams * 4) + (totalParams * 12 / dpDegree)) / (1024 ** 3);
    } else if (dist.zeroStage === 2) {
      // Gradients + Optimizer state sharded
      const dpDegree = Math.max(1, totalGPUs / (dist.tensorParallelism * dist.pipelineParallelism));
      optimizerGB = (totalParams * 16 / dpDegree) / (1024 ** 3);
    } else if (dist.zeroStage === 3) {
      // Weights, Gradients, and Optimizer all sharded
      const dpDegree = Math.max(1, totalGPUs / (dist.tensorParallelism * dist.pipelineParallelism));
      optimizerGB = (totalParams * 16 / dpDegree) / (1024 ** 3);
    }
  }

  // 3. KV Cache Memory (GB)
  // KV Cache = 2 * Batch * SeqLen * NumLayers * (numKVHeads * (dModel / numHeads)) * bytesPerParam
  // Key and Value matrices stored for all generated tokens in the context window.
  const dHead = dim.dModel / dim.numHeads;
  const kvElements = 2 * runtime.batchSize * runtime.contextLength * dim.numLayers * (dim.numKVHeads * dHead);
  const kvCacheGB = (kvElements * bytesPerParam) / (1024 ** 3);

  // 4. Activation Memory (GB)
  // Memory required to store intermediate activations during forward pass.
  // FlashAttention-2/3 reduces attention activation memory from O(S^2) to O(S).
  // Standard transformer layer with selective activation checkpointing:
  // ~ B * S * d * (10 + 2 * (Hkv/H)) * bytesPerParam * L
  const actElementsPerToken = dim.dModel * (12 + 2 * (dim.numKVHeads / dim.numHeads));
  const activationGB = (runtime.batchSize * runtime.contextLength * actElementsPerToken * dim.numLayers * bytesPerParam) / (1024 ** 3 * 2.5);

  const totalGB = weightsGB + optimizerGB + activationGB + kvCacheGB;

  // Per-GPU footprint after 3D Parallelism (TP, PP, ZeRO/DP)
  const tp = Math.max(1, dist.tensorParallelism);
  const pp = Math.max(1, dist.pipelineParallelism);
  const parallelDivisor = tp * pp;

  // Distributed weights & KV cache sharded across TP / PP
  const perGpuWeights = weightsGB / (dist.zeroStage === 3 ? totalGPUs : parallelDivisor);
  const perGpuKV = kvCacheGB / tp; // KV heads partitioned across TP
  const perGpuAct = activationGB / (tp * pp);
  const perGpuOpt = optimizerGB / (dist.zeroStage > 0 ? 1 : totalGPUs);

  const perGpuGB = perGpuWeights + perGpuKV + perGpuAct + perGpuOpt;
  const clusterCapacityGB = totalGPUs * hardware.vramGBPerGPU;
  const isOOM = perGpuGB > hardware.vramGBPerGPU;

  return {
    weightsGB,
    optimizerGB,
    activationGB,
    kvCacheGB,
    totalGB,
    perGpuGB,
    clusterCapacityGB,
    isOOM
  };
}

/**
 * Calculates FLOPs required per token and batch.
 */
export function calculateFLOPs(
  dim: ModelDimensions,
  runtime: RuntimeDimensions
): {
  fwdFlopsPerToken: number;
  bwdFlopsPerToken: number;
  totalStepFlops: number;
  formattedPerToken: string;
  formattedStepFlops: string;
} {
  if (!dim || dim.dModel === 0 || dim.numLayers === 0) {
    return {
      fwdFlopsPerToken: 0,
      bwdFlopsPerToken: 0,
      totalStepFlops: 0,
      formattedPerToken: '0 FLOPs',
      formattedStepFlops: '0 FLOPs'
    };
  }

  const { activeParams } = calculateModelParameters(dim);
  
  // Standard transformer scaling:
  // Forward pass ~ 2 * P_active FLOPs per token + 4 * L * H * S * dHead (attention quadratic term)
  const attentionFlopsPerToken = 4 * dim.numLayers * dim.numHeads * runtime.contextLength * (dim.dModel / dim.numHeads);
  const fwdFlopsPerToken = (2 * activeParams) + attentionFlopsPerToken;
  
  // Backward pass is ~ 2x forward pass = 4 * activeParams + 8 * attention
  const bwdFlopsPerToken = 2 * fwdFlopsPerToken;

  const multiplier = runtime.phase === 'training' ? 3 : 1; // fwd + bwd = 3x fwd
  const totalStepFlops = (fwdFlopsPerToken * multiplier) * runtime.batchSize * (runtime.promptTokens + runtime.generationTokens);

  return {
    fwdFlopsPerToken,
    bwdFlopsPerToken,
    totalStepFlops,
    formattedPerToken: formatFLOPs(fwdFlopsPerToken),
    formattedStepFlops: formatFLOPs(totalStepFlops)
  };
}

export function formatFLOPs(flops: number): string {
  if (flops >= 1e21) return `${(flops / 1e21).toFixed(2)} ZFLOPs`;
  if (flops >= 1e18) return `${(flops / 1e18).toFixed(2)} EFLOPs`;
  if (flops >= 1e15) return `${(flops / 1e15).toFixed(2)} PFLOPs`;
  if (flops >= 1e12) return `${(flops / 1e12).toFixed(2)} TFLOPs`;
  if (flops >= 1e9) return `${(flops / 1e9).toFixed(2)} GFLOPs`;
  return `${(flops / 1e6).toFixed(2)} MFLOPs`;
}

export function formatBytes(gb: number): string {
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`;
  if (gb < 1) return `${(gb * 1024).toFixed(1)} MB`;
  return `${gb.toFixed(2)} GB`;
}

/**
 * Calculates Dynamic Operational Roofline Points for Model Blocks.
 * Shows Arithmetic Intensity (FLOPs/Byte) vs Attainable Performance (TFLOPs/sec)
 */
export function calculateRooflineModel(
  dim: ModelDimensions,
  runtime: RuntimeDimensions,
  precision: PrecisionType,
  hardware: HardwareSpec
): {
  points: RooflinePoint[];
  ridgePoint: number;
  peakCompute: number;
  memoryBandwidth: number;
} {
  const bytesPerParam = getBytesPerParam(precision);
  const peakCompute = precision === 'INT8' || precision === 'FP4' ? hardware.peakTFlopsFP8 : hardware.peakTFlopsFP16;
  const memoryBandwidth = hardware.memoryBandwidthTBps; // TB/s = 10^12 Bytes/s

  // Ridge Point (Machine Balance) = Peak TFLOPs / Peak TB/s = (10^12 FLOPs/s) / (10^12 Bytes/s) = FLOPs / Byte
  const ridgePoint = peakCompute / memoryBandwidth;

  if (!dim || dim.dModel === 0 || dim.numLayers === 0) {
    return {
      points: [],
      ridgePoint: Number(ridgePoint.toFixed(1)),
      peakCompute,
      memoryBandwidth
    };
  }

  const B = runtime.batchSize;
  const S = runtime.phase === 'decode' ? 1 : Math.min(runtime.contextLength, 2048); // decode is 1 token per step
  const d = dim.dModel;
  const dFfn = dim.intermediateDim;

  // Helper to compute attainable performance on roofline
  const getAttainableTFlops = (intensity: number) => {
    // Memory-bound ceiling: intensity * memoryBandwidth
    const memCeiling = intensity * memoryBandwidth;
    return Math.min(peakCompute, memCeiling);
  };

  const points: RooflinePoint[] = [];

  // 1. Softmax (Memory Bandwidth Bound: reduction and exponentiation over heads)
  const softmaxIntensity = Number((0.40 / bytesPerParam).toFixed(2));
  points.push({
    id: 'softmax',
    label: 'Softmax / Activation',
    arithmeticIntensity: softmaxIntensity,
    attainableTFlops: Number(getAttainableTFlops(softmaxIntensity).toFixed(1)),
    memoryBound: softmaxIntensity < ridgePoint,
    category: 'Elementwise'
  });

  // 2. Normalization (RMSNorm / LayerNorm: memory bound elementwise affine transform)
  const normIntensity = Number((0.85 / bytesPerParam).toFixed(2));
  points.push({
    id: 'norm_layer',
    label: 'RMSNorm / LayerNorm',
    arithmeticIntensity: normIntensity,
    attainableTFlops: Number(getAttainableTFlops(normIntensity).toFixed(1)),
    memoryBound: normIntensity < ridgePoint,
    category: 'Elementwise'
  });

  // 3. Attention Matrix Score (FlashAttention-2 SRAM-tiled MatMul)
  const attnMatMulIntensity = runtime.phase === 'decode'
    ? Math.max(1.4, Number(((B * 1.5) / bytesPerParam).toFixed(2)))
    : Math.min(ridgePoint * 1.3, Number(((4 * B * S * d) / (4 * d * bytesPerParam * 32)).toFixed(2)));

  points.push({
    id: 'attn_scores',
    label: 'Self-Attention (SDPA)',
    arithmeticIntensity: Number(attnMatMulIntensity.toFixed(2)),
    attainableTFlops: Number(getAttainableTFlops(attnMatMulIntensity).toFixed(1)),
    memoryBound: attnMatMulIntensity < ridgePoint,
    category: 'Attention'
  });

  // 4. QKV Linear Projection (GEMM)
  const qkvIntensity = runtime.phase === 'decode' 
    ? Math.max(1.8, Number(((2 * B * d) / (2 * d * bytesPerParam + 2 * B * bytesPerParam * 10)).toFixed(2)))
    : Math.min(ridgePoint * 2.5, Number(((2 * B * S * d) / (2 * d * bytesPerParam + 2 * B * S * bytesPerParam * 4)).toFixed(2)));
  
  points.push({
    id: 'qkv_proj',
    label: 'QKV Projection (GEMM)',
    arithmeticIntensity: Number(qkvIntensity.toFixed(2)),
    attainableTFlops: Number(getAttainableTFlops(qkvIntensity).toFixed(1)),
    memoryBound: qkvIntensity < ridgePoint,
    category: 'Attention'
  });

  // 5. MLP SwiGLU Gate/Up/Down Projections (Heavy GEMMs)
  const mlpIntensity = runtime.phase === 'decode'
    ? Math.max(2.4, Number(((2 * B * dFfn) / (2 * dFfn * bytesPerParam + 2 * B * bytesPerParam * 8)).toFixed(2)))
    : Math.min(ridgePoint * 5.0, Number(((2 * B * S * dFfn) / (2 * dFfn * bytesPerParam + 2 * B * S * bytesPerParam * 2)).toFixed(2)));

  points.push({
    id: 'mlp_swiglu',
    label: 'MLP SwiGLU (Gate/Up/Down)',
    arithmeticIntensity: Number(mlpIntensity.toFixed(2)),
    attainableTFlops: Number(getAttainableTFlops(mlpIntensity).toFixed(1)),
    memoryBound: mlpIntensity < ridgePoint,
    category: 'MLP'
  });

  // 6. Final LM Head / Logits Projection (Massive vocabulary GEMM)
  const lmHeadIntensity = runtime.phase === 'decode'
    ? Math.max(3.2, Number(((2 * B * dim.vocabSize) / (dim.vocabSize * bytesPerParam * 2 + 2 * B * bytesPerParam * 10)).toFixed(2)))
    : Math.min(ridgePoint * 9.5, 3200);

  points.push({
    id: 'lm_head',
    label: 'LM Head / Logits',
    arithmeticIntensity: Number(lmHeadIntensity.toFixed(2)),
    attainableTFlops: Number(getAttainableTFlops(lmHeadIntensity).toFixed(1)),
    memoryBound: lmHeadIntensity < ridgePoint,
    category: 'Output'
  });

  return {
    points,
    ridgePoint: Number(ridgePoint.toFixed(1)),
    peakCompute,
    memoryBandwidth
  };
}

/**
 * Calculates Distributed Interconnect & Communication Latencies (Module D).
 */
export function calculateCommLatency(
  dim: ModelDimensions,
  runtime: RuntimeDimensions,
  precision: PrecisionType,
  dist: DistributedConfig,
  hardware: HardwareSpec
): CommLatencyStats {
  if (!dim || dim.dModel === 0 || dim.numLayers === 0) {
    return {
      tpCommTimeMs: 0,
      ppCommTimeMs: 0,
      moeCommTimeMs: 0,
      totalCommTimeMs: 0,
      computeTimeMs: 0,
      commToComputeRatio: 0,
      allReduceSizeMB: 0,
      allToAllSizeMB: 0,
      bottleneckSeverity: 'none'
    };
  }

  const bytesPerParam = getBytesPerParam(precision);
  const B = runtime.batchSize;
  const S = runtime.phase === 'decode' ? 1 : Math.min(runtime.contextLength, 4096);
  const d = dim.dModel;
  const L = dim.numLayers;

  const totalGPUs = dist.numNodes * dist.gpusPerNode;
  const TP = Math.max(1, dist.tensorParallelism);
  const PP = Math.max(1, dist.pipelineParallelism);
  const EP = Math.max(1, dist.expertParallelism);

  // 1. Tensor Parallelism Communication (All-Reduce in Attention + All-Reduce in MLP = 2 per layer)
  // Ring All-Reduce transmits 2 * (TP - 1) / TP * message_size bytes
  // Message size = B * S * d * bytesPerParam
  let tpCommTimeMs = 0;
  let allReduceSizeMB = 0;
  if (TP > 1) {
    const messageSizeBytes = B * S * d * bytesPerParam;
    allReduceSizeMB = messageSizeBytes / (1024 * 1024);
    const ringFactor = (2 * (TP - 1)) / TP;
    const transferredBytesPerLayer = ringFactor * messageSizeBytes * 2; // 2 all-reduces per layer
    
    // Intra-node NVLink bandwidth (GB/s) vs inter-node network bandwidth
    // If TP <= GPUs per node, runs across NVLink. If TP > GPUs per node, crosses network!
    const effectiveBwGBps = TP <= dist.gpusPerNode ? hardware.nvlinkBandwidthGBps : hardware.networkBandwidthGBps;
    const transferBwBytesPerSec = effectiveBwGBps * 1e9;
    const latencyOverheadSec = 2e-6; // 2 microseconds per kernel launch

    tpCommTimeMs = L * ((transferredBytesPerLayer / transferBwBytesPerSec) + (2 * latencyOverheadSec)) * 1000;
  }

  // 2. Pipeline Parallelism Communication (Point-to-Point activation passing between stages)
  let ppCommTimeMs = 0;
  if (PP > 1) {
    const activationSizeBytes = B * S * d * bytesPerParam;
    const p2pBandwidthBytesPerSec = hardware.networkBandwidthGBps * 1e9;
    const p2pLatencySec = 5e-6; // Network hop latency

    // Pipeline bubble overhead: (PP - 1) / NumMicrobatches
    const numMicrobatches = Math.max(4, PP * 2);
    const bubbleFraction = (PP - 1) / (numMicrobatches + PP - 1);
    
    // Raw P2P transfer time
    const rawTransferMs = ((activationSizeBytes / p2pBandwidthBytesPerSec) + p2pLatencySec) * 1000 * (PP - 1);
    ppCommTimeMs = rawTransferMs * (1 + bubbleFraction * 2);
  }

  // 3. MoE Expert Parallelism Communication (All-to-All communication)
  let moeCommTimeMs = 0;
  let allToAllSizeMB = 0;
  if (dim.isMoE && EP > 1) {
    const topK = dim.topKExperts || 2;
    // Each token sends its topK expert embeddings to destination GPUs:
    // Volume = 2 * (EP - 1) / EP * (topK * B * S * d * bytesPerParam)
    const moeMessageBytes = topK * B * S * d * bytesPerParam;
    allToAllSizeMB = moeMessageBytes / (1024 * 1024);
    const allToAllFactor = (2 * (EP - 1)) / EP;
    const totalMoeTransferredBytes = allToAllFactor * moeMessageBytes;

    const effectiveBwGBps = EP <= dist.gpusPerNode ? hardware.nvlinkBandwidthGBps : hardware.networkBandwidthGBps;
    moeCommTimeMs = L * (totalMoeTransferredBytes / (effectiveBwGBps * 1e9)) * 1000;
  }

  const totalCommTimeMs = tpCommTimeMs + ppCommTimeMs + moeCommTimeMs;

  // Compute Time Estimation
  const { activeParams } = calculateModelParameters(dim);
  const totalFlops = 2 * activeParams * B * S;
  const clusterPeakTFlops = totalGPUs * (precision === 'INT8' ? hardware.peakTFlopsFP8 : hardware.peakTFlopsFP16);
  // Real-world MFU (Model Flops Utilization) ~ 45-55%
  const mfu = 0.50;
  const computeTimeMs = (totalFlops / (clusterPeakTFlops * 1e12 * mfu)) * 1000;

  const totalStepTimeMs = computeTimeMs + totalCommTimeMs;
  const commToComputeRatio = totalStepTimeMs > 0 ? (totalCommTimeMs / totalStepTimeMs) * 100 : 0;

  let bottleneckSeverity: 'none' | 'moderate' | 'critical' = 'none';
  if (commToComputeRatio > 40) {
    bottleneckSeverity = 'critical';
  } else if (commToComputeRatio > 15) {
    bottleneckSeverity = 'moderate';
  }

  return {
    tpCommTimeMs: Number(tpCommTimeMs.toFixed(2)),
    ppCommTimeMs: Number(ppCommTimeMs.toFixed(2)),
    moeCommTimeMs: Number(moeCommTimeMs.toFixed(2)),
    totalCommTimeMs: Number(totalCommTimeMs.toFixed(2)),
    computeTimeMs: Number(computeTimeMs.toFixed(2)),
    commToComputeRatio: Number(commToComputeRatio.toFixed(1)),
    allReduceSizeMB: Number(allReduceSizeMB.toFixed(2)),
    allToAllSizeMB: Number(allToAllSizeMB.toFixed(2)),
    bottleneckSeverity
  };
}
