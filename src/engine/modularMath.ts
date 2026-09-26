/**
 * GraphFlow-AI - Modular Mathematical Scaling Engine
 * Evaluates individual modular PyTorch blocks and interconnect networks analytically.
 */

import { 
  ModularBlock, 
  BlockConnection, 
  RuntimeDimensions, 
  PrecisionType, 
  HardwareSpec, 
  TensorShape, 
  BlockStats,
  ModelArchitectureSpec,
  RepetitionGroup
} from '../types';
import { getBytesPerParam } from './scalingMath';

export function calculateBlockMetrics(
  block: Omit<ModularBlock, 'inputShape' | 'outputShape' | 'stats'>,
  incomingShape: TensorShape | null,
  runtime: RuntimeDimensions,
  precision: PrecisionType,
  hardware: HardwareSpec,
  repetitionMultiplier?: number
): { inputShape: TensorShape; outputShape: TensorShape; stats: BlockStats } {
  const bytesPerParam = getBytesPerParam(precision);
  const B = runtime.batchSize;
  const S = runtime.contextLength;
  const p = block.parameters || {};
  const repeats = repetitionMultiplier !== undefined 
    ? Math.max(1, repetitionMultiplier) 
    : Math.max(1, block.repeatLayers || 1);

  let inShape: TensorShape = incomingShape || { dims: [B, S], label: `[${B}, ${S}]` };
  let outShape: TensorShape = { dims: [B, S], label: `[${B}, ${S}]` };
  let singleParams = 0;
  let singleActiveParams = 0;
  let singleFlops = 0;

  switch (block.moduleType) {
    case 'nn.Embedding': {
      const vocabSize = Number(p.vocabSize) || 128256;
      const embeddingDim = Number(p.embeddingDim) || 8192;
      inShape = { dims: [B, S], label: `[${B}, ${S}] Tokens` };
      outShape = { dims: [B, S, embeddingDim], label: `[${B}, ${S}, ${embeddingDim}]` };
      singleParams = vocabSize * embeddingDim;
      singleActiveParams = singleParams;
      singleFlops = 0; // Pure table lookup memory copy
      break;
    }

    case 'nn.Conv2d': {
      const inChannels = Number(p.inChannels) || 3;
      const outChannels = Number(p.outChannels) || 64;
      const kernelSize = Number(p.kernelSize) || 7;
      const stride = Number(p.stride) || 2;
      const padding = Number(p.padding) || 3;
      const inH = Number(p.inputHeight) || 224;
      const inW = Number(p.inputWidth) || 224;

      const outH = Math.floor((inH + 2 * padding - kernelSize) / stride) + 1;
      const outW = Math.floor((inW + 2 * padding - kernelSize) / stride) + 1;

      inShape = { dims: [B, inChannels, inH, inW], label: `[${B}, ${inChannels}, ${inH}, ${inW}]` };
      outShape = { dims: [B, outChannels, outH, outW], label: `[${B}, ${outChannels}, ${outH}, ${outW}]` };

      // Conv2d weights: [out_channels, in_channels, K, K] + bias
      singleParams = outChannels * inChannels * kernelSize * kernelSize + outChannels;
      singleActiveParams = singleParams;
      // 2 * FLOPs per output element: 2 * (in_channels * K * K) * (out_channels * outH * outW)
      singleFlops = 2 * (inChannels * kernelSize * kernelSize) * outChannels * (outH * outW);
      break;
    }

    case 'nn.MultiheadAttention': {
      const dModel = Number(p.dModel) || 8192;
      const numHeads = Number(p.numHeads) || 64;
      const numKVHeads = Number(p.numKVHeads) || 8; // GQA default
      const headDim = Number(p.headDim) || Math.round(dModel / numHeads);

      inShape = incomingShape && incomingShape.dims.length >= 3 
        ? incomingShape 
        : { dims: [B, S, dModel], label: `[${B}, ${S}, ${dModel}]` };
      outShape = { dims: [B, S, dModel], label: `[${B}, ${S}, ${dModel}]` };

      // Q weight: dModel * (numHeads * headDim)
      // K weight: dModel * (numKVHeads * headDim)
      // V weight: dModel * (numKVHeads * headDim)
      // Out proj: (numHeads * headDim) * dModel
      const qParams = dModel * (numHeads * headDim);
      const kParams = dModel * (numKVHeads * headDim);
      const vParams = dModel * (numKVHeads * headDim);
      const outParams = (numHeads * headDim) * dModel;

      singleParams = qParams + kParams + vParams + outParams;
      singleActiveParams = singleParams;

      // FLOPs: 2 * (q + k + v + o) + 4 * S * dModel (QK^T and AV attention products)
      singleFlops = 2 * singleParams + 4 * S * dModel;
      break;
    }

    case 'nn.SwiGLUFFN': {
      const inFeatures = Number(p.inFeatures || p.dModel) || 8192;
      const intermediateDim = Number(p.intermediateDim) || Math.round((8 / 3) * inFeatures);

      inShape = incomingShape && incomingShape.dims.length >= 3 
        ? incomingShape 
        : { dims: [B, S, inFeatures], label: `[${B}, ${S}, ${inFeatures}]` };
      outShape = { dims: [B, S, inFeatures], label: `[${B}, ${S}, ${inFeatures}]` };

      // SwiGLU has 3 projection matrices: Gate, Up, and Down
      // Gate: inFeatures * intermediateDim
      // Up: inFeatures * intermediateDim
      // Down: intermediateDim * inFeatures
      singleParams = 3 * inFeatures * intermediateDim;
      singleActiveParams = singleParams;
      singleFlops = 2 * singleParams; // GEMM FLOPs
      break;
    }

    case 'nn.MoEBlock': {
      const dModel = Number(p.dModel) || 8192;
      const intermediateDim = Number(p.intermediateDim) || Math.round((8 / 3) * dModel);
      const numExperts = Number(p.numExperts) || 64;
      const topK = Number(p.topK) || 8;

      inShape = incomingShape && incomingShape.dims.length >= 3 
        ? incomingShape 
        : { dims: [B, S, dModel], label: `[${B}, ${S}, ${dModel}]` };
      outShape = { dims: [B, S, dModel], label: `[${B}, ${S}, ${dModel}]` };

      // Router gate: dModel * numExperts
      const routerParams = dModel * numExperts;
      // Each expert is a SwiGLU FFN (3 * dModel * intermediateDim)
      const perExpertParams = 3 * dModel * intermediateDim;

      singleParams = routerParams + (numExperts * perExpertParams);
      // Active params per token are router + topK * perExpertParams
      singleActiveParams = routerParams + (topK * perExpertParams);
      singleFlops = 2 * singleActiveParams;
      break;
    }

    case 'nn.RMSNorm':
    case 'nn.LayerNorm': {
      const normalizedShape = Number(p.normalizedShape || p.dModel) || 8192;
      inShape = incomingShape && incomingShape.dims.length >= 3 
        ? incomingShape 
        : { dims: [B, S, normalizedShape], label: `[${B}, ${S}, ${normalizedShape}]` };
      outShape = { dims: [B, S, normalizedShape], label: `[${B}, ${S}, ${normalizedShape}]` };

      singleParams = normalizedShape;
      singleActiveParams = singleParams;
      singleFlops = 4 * normalizedShape; // Mean, variance/RMS, scale, shift
      break;
    }

    case 'nn.Linear': {
      const inFeatures = Number(p.inFeatures) || 8192;
      const outFeatures = Number(p.outFeatures) || 8192;
      const hasBias = p.bias !== false;

      inShape = incomingShape && incomingShape.dims.length >= 3 
        ? incomingShape 
        : { dims: [B, S, inFeatures], label: `[${B}, ${S}, ${inFeatures}]` };
      outShape = { dims: [B, S, outFeatures], label: `[${B}, ${S}, ${outFeatures}]` };

      singleParams = inFeatures * outFeatures + (hasBias ? outFeatures : 0);
      singleActiveParams = singleParams;
      singleFlops = 2 * inFeatures * outFeatures;
      break;
    }

    case 'nn.MambaBlock': {
      const dModel = Number(p.dModel) || 4096;
      const dState = Number(p.dState) || 16;
      const dConv = Number(p.dConv) || 4;
      const expand = Number(p.expand) || 2;
      const dInner = expand * dModel;

      inShape = incomingShape && incomingShape.dims.length >= 3 
        ? incomingShape 
        : { dims: [B, S, dModel], label: `[${B}, ${S}, ${dModel}]` };
      outShape = { dims: [B, S, dModel], label: `[${B}, ${S}, ${dModel}]` };

      // In proj (2 * dModel * dInner), 1D Conv (dInner * dConv), SSM B/C projs, dt proj, Out proj (dInner * dModel)
      singleParams = (2 * dModel * dInner) + (dInner * dConv) + (dInner * dState * 2) + (dInner * dModel);
      singleActiveParams = singleParams;
      singleFlops = 2 * singleParams;
      break;
    }

    case 'nn.CrossEntropyHead': {
      const dModel = Number(p.dModel) || 8192;
      const vocabSize = Number(p.vocabSize) || 128256;

      inShape = incomingShape && incomingShape.dims.length >= 3 
        ? incomingShape 
        : { dims: [B, S, dModel], label: `[${B}, ${S}, ${dModel}]` };
      outShape = { dims: [B, S, vocabSize], label: `[${B}, ${S}, ${vocabSize}] Logits` };

      singleParams = dModel * vocabSize;
      singleActiveParams = singleParams;
      singleFlops = 2 * dModel * vocabSize;
      break;
    }

    case 'op.Add': {
      const dModel = Number(p.dModel) || (incomingShape && incomingShape.dims[2] ? Number(incomingShape.dims[2]) : 8192);
      inShape = incomingShape && incomingShape.dims.length >= 3 
        ? incomingShape 
        : { dims: [B, S, dModel], label: `[${B}, ${S}, ${dModel}]` };
      outShape = inShape;
      singleParams = 0; // Pure elementwise tensor addition (no learnable weights)
      singleActiveParams = 0;
      singleFlops = B * S * dModel; // 1 FLOP per element
      break;
    }

    case 'op.ResidualOrigin': {
      const dModel = Number(p.dModel) || (incomingShape && incomingShape.dims[2] ? Number(incomingShape.dims[2]) : 8192);
      inShape = incomingShape && incomingShape.dims.length >= 3 
        ? incomingShape 
        : { dims: [B, S, dModel], label: `[${B}, ${S}, ${dModel}]` };
      outShape = inShape;
      singleParams = 0; // Residual Origin is an identity tap / fork point
      singleActiveParams = 0;
      singleFlops = 0; // No FLOPs (zero-cost pointer tap / identity bifurcation)
      break;
    }

    case 'custom':
    default: {
      const paramMultiplier = Number(p.paramMultiplier) || 1;
      const customParams = Number(p.params) || (8192 * 8192);
      const customFlops = Number(p.flopsPerToken) || (2 * customParams);

      inShape = incomingShape || { dims: [B, S, 8192], label: `[${B}, ${S}, 8192]` };
      outShape = inShape;
      singleParams = customParams * paramMultiplier;
      singleActiveParams = singleParams;
      singleFlops = customFlops;
      break;
    }
  }

  const totalBlockParams = singleParams * repeats;
  const totalActiveParams = singleActiveParams * repeats;
  const totalBlockFlops = singleFlops * repeats;

  // Operational arithmetic intensity: FLOPs / Memory Traffic (Bytes)
  // For zero-param operations (like op.Add), memory traffic is pure activation tensor read/write (2 inputs read + 1 output write)
  const isZeroParamOp = singleActiveParams === 0;
  const memoryBytes = isZeroParamOp 
    ? Math.max(1, 3 * singleFlops * bytesPerParam)
    : Math.max(1, (singleActiveParams * bytesPerParam));
  let intensity = 1.0;
  if (isZeroParamOp) {
    intensity = Number((singleFlops / memoryBytes).toFixed(2));
  } else if (runtime.phase === 'decode') {
    intensity = Math.max(0.2, (singleFlops / memoryBytes));
  } else {
    // Prefill: arithmetic intensity increases with sequence length S and batch B
    const tokens = B * Math.min(S, 2048);
    intensity = Math.max(1.0, Math.min(300, (tokens * singleFlops) / (memoryBytes * 8)));
  }

  const hardwareRidge = (precision === 'INT8' || precision === 'FP4' ? hardware.peakTFlopsFP8 : hardware.peakTFlopsFP16) / hardware.memoryBandwidthTBps;
  const memoryBound = intensity < hardwareRidge;

  return {
    inputShape: inShape,
    outputShape: outShape,
    stats: {
      params: totalBlockParams,
      activeParams: totalActiveParams,
      flopsPerToken: totalBlockFlops,
      arithmeticIntensity: Number(intensity.toFixed(1)),
      memoryBound
    }
  };
}

export function validateConnections(
  blocks: ModularBlock[],
  connections: BlockConnection[]
): { connections: BlockConnection[]; hasErrors: boolean; errorCount: number } {
  let errorCount = 0;
  const blockMap = new Map<string, ModularBlock>();
  blocks.forEach(b => blockMap.set(b.id, b));

  const validatedConnections = connections.map(conn => {
    const src = blockMap.get(conn.source);
    const tgt = blockMap.get(conn.target);

    if (!src || !tgt) {
      return { ...conn, isMismatch: false };
    }

    // Check last dimension or feature dimension compatibility
    const srcOut = src.outputShape.dims;
    const tgtIn = tgt.inputShape.dims;

    const lastSrc = srcOut[srcOut.length - 1];
    const lastTgt = tgtIn[tgtIn.length - 1];

    // If both are numbers and differ, flag mismatch
    if (typeof lastSrc === 'number' && typeof lastTgt === 'number' && lastSrc !== lastTgt) {
      errorCount++;
      return {
        ...conn,
        tensorShape: src.outputShape,
        isMismatch: true,
        mismatchDetail: `Dimension Mismatch: Output feature dim ${lastSrc} ≠ Target input dim ${lastTgt}`
      };
    }

    return {
      ...conn,
      tensorShape: src.outputShape,
      isMismatch: false,
      mismatchDetail: undefined
    };
  });

  return {
    connections: validatedConnections,
    hasErrors: errorCount > 0,
    errorCount
  };
}

export function computeModelArchitectureSummary(
  spec: Omit<ModelArchitectureSpec, 'summary'>,
  hardware: HardwareSpec
): ModelArchitectureSpec['summary'] {
  const bytesPerParam = getBytesPerParam(spec.precision);

  if (spec.blocks.length === 0) {
    return {
      totalParameters: 0,
      activeParameters: 0,
      totalFlopsPerToken: 0,
      memoryFootprintGB: 0,
      layerCount: 0,
      hasMismatches: false,
      mismatchCount: 0
    };
  }
  
  // Build lookup map for repetition groups
  const blockToGroup = new Map<string, RepetitionGroup>();
  if (spec.repetitionGroups) {
    for (const grp of spec.repetitionGroups) {
      for (const bId of grp.blockIds) {
        blockToGroup.set(bId, grp);
      }
    }
  }

  let totalParams = 0;
  let activeParams = 0;
  let totalFlops = 0;

  spec.blocks.forEach(b => {
    totalParams += b.stats.params || 0;
    activeParams += b.stats.activeParams || b.stats.params || 0;
    totalFlops += b.stats.flopsPerToken || 0;
  });

  // Total weights VRAM
  const weightsGB = (totalParams * bytesPerParam) / (1024 ** 3);
  
  // KV Cache memory estimation
  let kvCacheGB = 0;
  spec.blocks.forEach(b => {
    if (b.moduleType === 'nn.MultiheadAttention') {
      const p = b.parameters;
      const numKVHeads = Number(p.numKVHeads) || 8;
      const headDim = Number(p.headDim) || Math.round((Number(p.dModel) || 8192) / (Number(p.numHeads) || 64));
      const repGroup = blockToGroup.get(b.id);
      const repeats = repGroup ? repGroup.repetitions : Math.max(1, b.repeatLayers || 1);
      // 2 * B * S * numKVHeads * headDim * bytesPerParam * numLayers
      const kvBytes = 2 * spec.runtime.batchSize * spec.runtime.contextLength * numKVHeads * headDim * bytesPerParam * repeats;
      kvCacheGB += kvBytes / (1024 ** 3);
    }
  });

  // Optimizer & Activations
  const optFactor = spec.distributed.zeroStage === 3 
    ? (16 / Math.max(1, spec.distributed.numNodes * spec.distributed.gpusPerNode)) 
    : spec.distributed.zeroStage === 2 
    ? 8 
    : 16;
  const optimizerGB = (totalParams * optFactor) / (1024 ** 3);
  const activationGB = (spec.runtime.batchSize * spec.runtime.contextLength * 8192 * 4) / (1024 ** 3);

  const totalGB = weightsGB + optimizerGB + activationGB + kvCacheGB;

  // Validation
  const valResult = validateConnections(spec.blocks, spec.connections);

  // Layer count calculation: count group repetitions for groups, plus standalone layer repetitions
  let calculatedLayerCount = 0;
  const groupedBlockIds = new Set<string>();

  if (spec.repetitionGroups && spec.repetitionGroups.length > 0) {
    for (const grp of spec.repetitionGroups) {
      calculatedLayerCount += grp.repetitions;
      for (const bId of grp.blockIds) {
        groupedBlockIds.add(bId);
      }
    }
  }

  spec.blocks.forEach(b => {
    if (!groupedBlockIds.has(b.id)) {
      calculatedLayerCount += (b.repeatLayers || 1);
    }
  });

  return {
    totalParameters: totalParams,
    activeParameters: activeParams,
    totalFlopsPerToken: totalFlops,
    memoryFootprintGB: Number(totalGB.toFixed(2)),
    layerCount: Math.max(1, calculatedLayerCount),
    hasMismatches: valResult.hasErrors,
    mismatchCount: valResult.errorCount
  };
}

/**
 * Recomputes all block metrics (and their shapes) considering repetition groups,
 * and updates the architecture summary.
 */
export function recomputeSpecMetrics(
  spec: Omit<ModelArchitectureSpec, 'summary'>,
  hardware: HardwareSpec
): ModelArchitectureSpec {
  const blockToGroup = new Map<string, RepetitionGroup>();
  if (spec.repetitionGroups) {
    for (const grp of spec.repetitionGroups) {
      for (const bId of grp.blockIds) {
        blockToGroup.set(bId, grp);
      }
    }
  }

  const updatedBlocks: ModularBlock[] = [];
  let prevShape: TensorShape | null = null;

  for (const b of spec.blocks) {
    const repGroup = blockToGroup.get(b.id);
    const multiplier = repGroup ? repGroup.repetitions : (b.repeatLayers || 1);

    const calc = calculateBlockMetrics(
      b,
      prevShape,
      spec.runtime,
      spec.precision,
      hardware,
      multiplier
    );

    updatedBlocks.push({
      ...b,
      inputShape: calc.inputShape,
      outputShape: calc.outputShape,
      stats: calc.stats
    });
    prevShape = calc.outputShape;
  }

  const updatedSpec = {
    ...spec,
    blocks: updatedBlocks
  };

  const summary = computeModelArchitectureSummary(updatedSpec, hardware);
  return { ...updatedSpec, summary };
}
