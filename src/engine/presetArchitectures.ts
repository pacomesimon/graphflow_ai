import { 
  ModelArchitectureSpec, 
  ModularBlock, 
  BlockConnection, 
  RuntimeDimensions, 
  PrecisionType, 
  DistributedConfig,
  ModelDimensions,
  RepetitionGroup
} from '../types';
import { DEFAULT_HARDWARE } from './hardwareSpecs';
import { calculateBlockMetrics, computeModelArchitectureSummary, recomputeSpecMetrics } from './modularMath';

export interface ModelPreset {
  id: string;
  name: string;
  tag: string;
  description: string;
  dimensions: ModelDimensions;
  runtime: RuntimeDimensions;
  precision: PrecisionType;
  recommendedDist: DistributedConfig;
  createSpec: () => ModelArchitectureSpec;
}

function initBlocks(
  rawBlocks: Omit<ModularBlock, 'inputShape' | 'outputShape' | 'stats'>[], 
  dModel: number, 
  runtime: RuntimeDimensions
): ModularBlock[] {
  return rawBlocks.map(b => ({
    ...b,
    inputShape: { dims: [runtime.batchSize, runtime.contextLength, dModel], label: `[${runtime.batchSize}, ${runtime.contextLength}, ${dModel}]` },
    outputShape: { dims: [runtime.batchSize, runtime.contextLength, dModel], label: `[${runtime.batchSize}, ${runtime.contextLength}, ${dModel}]` },
    stats: { params: 0, activeParams: 0, flopsPerToken: 0, arithmeticIntensity: 0, memoryBound: false }
  }));
}

// 1. Example-1T (Fictional Model - 1.02 Trillion Parameters)
function create1TSpeculativeMoESpec(): ModelArchitectureSpec {
  const runtime: RuntimeDimensions = {
    batchSize: 16,
    contextLength: 65536,
    promptTokens: 32768,
    generationTokens: 4096,
    phase: 'prefill'
  };
  const precision: PrecisionType = 'FP8';
  const distributed: DistributedConfig = {
    numNodes: 64, // 512 GPUs
    gpusPerNode: 8,
    tensorParallelism: 8,
    pipelineParallelism: 16,
    expertParallelism: 8,
    zeroStage: 1,
    interconnectType: 'InfiniBand NDR'
  };

  const rawBlocks: Omit<ModularBlock, 'inputShape' | 'outputShape' | 'stats'>[] = [
    {
      id: 'blk_embed',
      name: 'Vocabulary Embedding',
      moduleType: 'nn.Embedding',
      category: 'embedding',
      parameters: { vocabSize: 128256, embeddingDim: 16384 },
      assignedGPU: 0,
      assignedNode: 0,
      notes: 'Initial token lookup into 16,384-dim continuous embedding space'
    },
    {
      id: 'blk_res_orig_attn',
      name: 'Residual Origin (Attn)',
      moduleType: 'op.ResidualOrigin',
      category: 'operation',
      parameters: { dModel: 16384 },
      assignedGPU: 0,
      assignedNode: 0,
      notes: 'Residual origin tap: identity fork x → [x_main, x_residual]'
    },
    {
      id: 'blk_pre_norm',
      name: 'Input RMSNorm',
      moduleType: 'nn.RMSNorm',
      category: 'norm',
      parameters: { normalizedShape: 16384, eps: 1e-6 },
      assignedGPU: 0,
      assignedNode: 0,
      notes: 'Pre-attention normalization across 128 transformer layers'
    },
    {
      id: 'blk_attention',
      name: 'Grouped-Query Attention (GQA)',
      moduleType: 'nn.MultiheadAttention',
      category: 'attention',
      parameters: { dModel: 16384, numHeads: 128, numKVHeads: 16, headDim: 128 },
      assignedGPU: 1,
      assignedNode: 0,
      notes: '128 query heads with 16 KV heads (8x compression for KV cache)'
    },
    {
      id: 'blk_add_attn',
      name: 'Residual Add (Attn)',
      moduleType: 'op.Add',
      category: 'operation',
      parameters: { dModel: 16384, alpha: 1.0 },
      assignedGPU: 1,
      assignedNode: 0,
      notes: 'Residual connection: x + Attention(RMSNorm(x))'
    },
    {
      id: 'blk_res_orig_moe',
      name: 'Residual Origin (MoE)',
      moduleType: 'op.ResidualOrigin',
      category: 'operation',
      parameters: { dModel: 16384 },
      assignedGPU: 2,
      assignedNode: 0,
      notes: 'Residual origin tap: identity fork x_mid → [x_main, x_residual]'
    },
    {
      id: 'blk_post_attn_norm',
      name: 'Post-Attn RMSNorm',
      moduleType: 'nn.RMSNorm',
      category: 'norm',
      parameters: { normalizedShape: 16384, eps: 1e-6 },
      assignedGPU: 2,
      assignedNode: 0
    },
    {
      id: 'blk_moe',
      name: 'Sparse MoE Routed FFN',
      moduleType: 'nn.MoEBlock',
      category: 'moe',
      parameters: { dModel: 16384, intermediateDim: 32768, numExperts: 128, topK: 8 },
      assignedGPU: 3,
      assignedNode: 0,
      notes: '128 total experts, Top-8 routing per token (1.02T total weights, 72B active)'
    },
    {
      id: 'blk_add_moe',
      name: 'Residual Add (MoE)',
      moduleType: 'op.Add',
      category: 'operation',
      parameters: { dModel: 16384, alpha: 1.0 },
      assignedGPU: 3,
      assignedNode: 0,
      notes: 'Residual connection: x + MoE(RMSNorm(x))'
    },
    {
      id: 'blk_final_norm',
      name: 'Final RMSNorm',
      moduleType: 'nn.RMSNorm',
      category: 'norm',
      parameters: { normalizedShape: 16384, eps: 1e-6 },
      assignedGPU: 7,
      assignedNode: 15
    },
    {
      id: 'blk_lm_head',
      name: 'Language Model Head',
      moduleType: 'nn.CrossEntropyHead',
      category: 'head',
      parameters: { dModel: 16384, vocabSize: 128256 },
      assignedGPU: 7,
      assignedNode: 15,
      notes: 'Projects hidden state to vocabulary distribution logits'
    }
  ];

  const repetitionGroups: RepetitionGroup[] = [
    {
      id: 'grp_1t_layers',
      name: 'Frontier 1T Transformer Layer',
      repetitions: 128,
      blockIds: [
        'blk_res_orig_attn',
        'blk_pre_norm', 
        'blk_attention', 
        'blk_add_attn', 
        'blk_res_orig_moe', 
        'blk_post_attn_norm', 
        'blk_moe', 
        'blk_add_moe'
      ],
      color: 'rose',
      notes: '128 repeating MoE transformer layers with 128 experts'
    }
  ];

  const dummyBlocks = initBlocks(rawBlocks, 16384, runtime);

  const connections: BlockConnection[] = [
    { id: 'conn_1', source: 'blk_embed', target: 'blk_res_orig_attn' },
    { id: 'conn_res_attn', source: 'blk_res_orig_attn', target: 'blk_add_attn', isResidual: true },
    { id: 'conn_2', source: 'blk_res_orig_attn', target: 'blk_pre_norm' },
    { id: 'conn_3', source: 'blk_pre_norm', target: 'blk_attention' },
    { id: 'conn_4', source: 'blk_attention', target: 'blk_add_attn' },
    { id: 'conn_5', source: 'blk_add_attn', target: 'blk_res_orig_moe' },
    { id: 'conn_res_moe', source: 'blk_res_orig_moe', target: 'blk_add_moe', isResidual: true },
    { id: 'conn_6', source: 'blk_res_orig_moe', target: 'blk_post_attn_norm' },
    { id: 'conn_7', source: 'blk_post_attn_norm', target: 'blk_moe' },
    { id: 'conn_8', source: 'blk_moe', target: 'blk_add_moe' },
    { id: 'conn_9', source: 'blk_add_moe', target: 'blk_final_norm' },
    { id: 'conn_10', source: 'blk_final_norm', target: 'blk_lm_head' }
  ];

  const specPartial = {
    id: 'trillion-speculative-moe',
    name: 'Example-1T (Fictional Model)',
    tag: '1.02T Fictional Example',
    description: 'A simple example fictional 1-Trillion parameter mixture-of-experts model for illustrative scaling simulations.',
    version: '2.0.0',
    runtime,
    precision,
    distributed,
    blocks: dummyBlocks,
    repetitionGroups,
    connections
  };

  return recomputeSpecMetrics(specPartial, DEFAULT_HARDWARE);
}

// 2. DeepSeek-V3 / R1 (671B MoE)
function createDeepSeekV3Spec(): ModelArchitectureSpec {
  const runtime: RuntimeDimensions = {
    batchSize: 32,
    contextLength: 32768,
    promptTokens: 16384,
    generationTokens: 2048,
    phase: 'decode'
  };
  const precision: PrecisionType = 'FP8';
  const distributed: DistributedConfig = {
    numNodes: 32,
    gpusPerNode: 8,
    tensorParallelism: 8,
    pipelineParallelism: 8,
    expertParallelism: 16,
    zeroStage: 1,
    interconnectType: 'InfiniBand NDR'
  };

  const rawBlocks: Omit<ModularBlock, 'inputShape' | 'outputShape' | 'stats'>[] = [
    {
      id: 'ds_embed',
      name: 'DeepSeek Embedding',
      moduleType: 'nn.Embedding',
      category: 'embedding',
      parameters: { vocabSize: 129280, embeddingDim: 7168 },
      assignedGPU: 0,
      assignedNode: 0
    },
    {
      id: 'ds_res_orig1',
      name: 'Residual Origin (MLA)',
      moduleType: 'op.ResidualOrigin',
      category: 'operation',
      parameters: { dModel: 7168 },
      assignedGPU: 0,
      assignedNode: 0,
      notes: 'Residual origin tap: bifurcates layer input x into residual stream and MLA branch'
    },
    {
      id: 'ds_norm1',
      name: 'Pre-MLA RMSNorm',
      moduleType: 'nn.RMSNorm',
      category: 'norm',
      parameters: { normalizedShape: 7168, eps: 1e-6 },
      assignedGPU: 0,
      assignedNode: 0
    },
    {
      id: 'ds_mla',
      name: 'Multi-Head Latent Attention (MLA)',
      moduleType: 'nn.MultiheadAttention',
      category: 'attention',
      parameters: { dModel: 7168, numHeads: 128, numKVHeads: 128, headDim: 128 },
      assignedGPU: 1,
      assignedNode: 0,
      notes: 'Low-rank latent compression of key-value representations'
    },
    {
      id: 'ds_add1',
      name: 'Residual Add (MLA)',
      moduleType: 'op.Add',
      category: 'operation',
      parameters: { dModel: 7168, alpha: 1.0 },
      assignedGPU: 1,
      assignedNode: 0,
      notes: 'Residual connection: x + MLA(RMSNorm(x))'
    },
    {
      id: 'ds_res_orig2',
      name: 'Residual Origin (MoE)',
      moduleType: 'op.ResidualOrigin',
      category: 'operation',
      parameters: { dModel: 7168 },
      assignedGPU: 2,
      assignedNode: 0,
      notes: 'Residual origin tap: bifurcates intermediate stream x into residual stream and MoE branch'
    },
    {
      id: 'ds_norm2',
      name: 'Pre-MoE RMSNorm',
      moduleType: 'nn.RMSNorm',
      category: 'norm',
      parameters: { normalizedShape: 7168, eps: 1e-6 },
      assignedGPU: 2,
      assignedNode: 0
    },
    {
      id: 'ds_moe',
      name: 'DeepSeek MoE (256 Experts)',
      moduleType: 'nn.MoEBlock',
      category: 'moe',
      parameters: { dModel: 7168, intermediateDim: 18432, numExperts: 256, topK: 8 },
      assignedGPU: 3,
      assignedNode: 0,
      notes: '256 fine-grained routed experts with 1 shared expert'
    },
    {
      id: 'ds_add2',
      name: 'Residual Add (MoE)',
      moduleType: 'op.Add',
      category: 'operation',
      parameters: { dModel: 7168, alpha: 1.0 },
      assignedGPU: 3,
      assignedNode: 0,
      notes: 'Residual connection: x + MoE(RMSNorm(x))'
    },
    {
      id: 'ds_norm_out',
      name: 'Final RMSNorm',
      moduleType: 'nn.RMSNorm',
      category: 'norm',
      parameters: { normalizedShape: 7168, eps: 1e-6 },
      assignedGPU: 7,
      assignedNode: 31
    },
    {
      id: 'ds_head',
      name: 'DeepSeek Unembedding Head',
      moduleType: 'nn.CrossEntropyHead',
      category: 'head',
      parameters: { dModel: 7168, vocabSize: 129280 },
      assignedGPU: 7,
      assignedNode: 31
    }
  ];

  const repetitionGroups: RepetitionGroup[] = [
    {
      id: 'ds_transformer_layers',
      name: 'DeepSeek-V3 Transformer Layer',
      repetitions: 61,
      blockIds: [
        'ds_res_orig1',
        'ds_norm1', 
        'ds_mla', 
        'ds_add1', 
        'ds_res_orig2', 
        'ds_norm2', 
        'ds_moe', 
        'ds_add2'
      ],
      color: 'rose',
      notes: '61 repeating transformer layers with RMSNorm, MLA, and 256 routed MoE experts'
    }
  ];

  const dummyBlocks = initBlocks(rawBlocks, 7168, runtime);

  const connections: BlockConnection[] = [
    { id: 'ds_c1', source: 'ds_embed', target: 'ds_res_orig1' },
    { id: 'ds_res_mla', source: 'ds_res_orig1', target: 'ds_add1', isResidual: true },
    { id: 'ds_c2', source: 'ds_res_orig1', target: 'ds_norm1' },
    { id: 'ds_c3', source: 'ds_norm1', target: 'ds_mla' },
    { id: 'ds_c4', source: 'ds_mla', target: 'ds_add1' },
    { id: 'ds_c5', source: 'ds_add1', target: 'ds_res_orig2' },
    { id: 'ds_res_moe', source: 'ds_res_orig2', target: 'ds_add2', isResidual: true },
    { id: 'ds_c6', source: 'ds_res_orig2', target: 'ds_norm2' },
    { id: 'ds_c7', source: 'ds_norm2', target: 'ds_moe' },
    { id: 'ds_c8', source: 'ds_moe', target: 'ds_add2' },
    { id: 'ds_c9', source: 'ds_add2', target: 'ds_norm_out' },
    { id: 'ds_c10', source: 'ds_norm_out', target: 'ds_head' }
  ];

  const specPartial = {
    id: 'deepseek-v3-moe',
    name: 'DeepSeek-V3 / R1 (671B MoE)',
    tag: '671 Billion Params',
    description: 'Multi-Head Latent Attention with 256 routed experts and 1 shared expert.',
    version: '2.0.0',
    runtime,
    precision,
    distributed,
    blocks: dummyBlocks,
    repetitionGroups,
    connections
  };

  return recomputeSpecMetrics(specPartial, DEFAULT_HARDWARE);
}

// 3. Llama-3 405B (Dense Foundation Model)
function createLlama3405BSpec(): ModelArchitectureSpec {
  const runtime: RuntimeDimensions = {
    batchSize: 8,
    contextLength: 131072,
    promptTokens: 65536,
    generationTokens: 4096,
    phase: 'prefill'
  };
  const precision: PrecisionType = 'FP8';
  const distributed: DistributedConfig = {
    numNodes: 16,
    gpusPerNode: 8,
    tensorParallelism: 8,
    pipelineParallelism: 8,
    expertParallelism: 1,
    zeroStage: 1,
    interconnectType: 'InfiniBand NDR'
  };

  const rawBlocks: Omit<ModularBlock, 'inputShape' | 'outputShape' | 'stats'>[] = [
    {
      id: 'l405_embed',
      name: 'Llama-3 Token Embedding',
      moduleType: 'nn.Embedding',
      category: 'embedding',
      parameters: { vocabSize: 128256, embeddingDim: 16384 },
      assignedGPU: 0,
      assignedNode: 0
    },
    {
      id: 'l405_res_orig1',
      name: 'Residual Origin (GQA)',
      moduleType: 'op.ResidualOrigin',
      category: 'operation',
      parameters: { dModel: 16384 },
      assignedGPU: 0,
      assignedNode: 0,
      notes: 'Residual origin tap: bifurcates layer input x into residual stream and GQA branch'
    },
    {
      id: 'l405_norm1',
      name: 'Pre-Attention RMSNorm',
      moduleType: 'nn.RMSNorm',
      category: 'norm',
      parameters: { normalizedShape: 16384, eps: 1e-5 },
      assignedGPU: 0,
      assignedNode: 0
    },
    {
      id: 'l405_gqa',
      name: 'Llama-3 Grouped Query Attention',
      moduleType: 'nn.MultiheadAttention',
      category: 'attention',
      parameters: { dModel: 16384, numHeads: 128, numKVHeads: 16, headDim: 128 },
      assignedGPU: 1,
      assignedNode: 0,
      notes: '128 query heads with 16 KV heads and RoPE positional embeddings'
    },
    {
      id: 'l405_add1',
      name: 'Residual Add (GQA)',
      moduleType: 'op.Add',
      category: 'operation',
      parameters: { dModel: 16384, alpha: 1.0 },
      assignedGPU: 1,
      assignedNode: 0,
      notes: 'Residual connection: x + Attention(RMSNorm(x))'
    },
    {
      id: 'l405_res_orig2',
      name: 'Residual Origin (FFN)',
      moduleType: 'op.ResidualOrigin',
      category: 'operation',
      parameters: { dModel: 16384 },
      assignedGPU: 2,
      assignedNode: 0,
      notes: 'Residual origin tap: bifurcates intermediate stream x into residual stream and FFN branch'
    },
    {
      id: 'l405_norm2',
      name: 'Pre-FFN RMSNorm',
      moduleType: 'nn.RMSNorm',
      category: 'norm',
      parameters: { normalizedShape: 16384, eps: 1e-5 },
      assignedGPU: 2,
      assignedNode: 0
    },
    {
      id: 'l405_ffn',
      name: 'SwiGLU Dense Feed-Forward',
      moduleType: 'nn.SwiGLUFFN',
      category: 'ffn',
      parameters: { inFeatures: 16384, intermediateDim: 53248 },
      assignedGPU: 3,
      assignedNode: 0,
      notes: 'Dense 53,248-dim gated projection'
    },
    {
      id: 'l405_add2',
      name: 'Residual Add (FFN)',
      moduleType: 'op.Add',
      category: 'operation',
      parameters: { dModel: 16384, alpha: 1.0 },
      assignedGPU: 3,
      assignedNode: 0,
      notes: 'Residual connection: x + SwiGLU(RMSNorm(x))'
    },
    {
      id: 'l405_final_norm',
      name: 'Final Layer RMSNorm',
      moduleType: 'nn.RMSNorm',
      category: 'norm',
      parameters: { normalizedShape: 16384, eps: 1e-5 },
      assignedGPU: 7,
      assignedNode: 15
    },
    {
      id: 'l405_head',
      name: 'Llama-3 LM Head',
      moduleType: 'nn.CrossEntropyHead',
      category: 'head',
      parameters: { dModel: 16384, vocabSize: 128256 },
      assignedGPU: 7,
      assignedNode: 15
    }
  ];

  const repetitionGroups: RepetitionGroup[] = [
    {
      id: 'l405_transformer_layers',
      name: 'Llama-3 405B Transformer Layer',
      repetitions: 126,
      blockIds: [
        'l405_res_orig1',
        'l405_norm1', 
        'l405_gqa', 
        'l405_add1', 
        'l405_res_orig2', 
        'l405_norm2', 
        'l405_ffn', 
        'l405_add2'
      ],
      color: 'rose',
      notes: '126 repeating dense transformer layers with GQA and SwiGLU'
    }
  ];

  const dummyBlocks = initBlocks(rawBlocks, 16384, runtime);

  const connections: BlockConnection[] = [
    { id: 'l405_c1', source: 'l405_embed', target: 'l405_res_orig1' },
    { id: 'l405_res_gqa', source: 'l405_res_orig1', target: 'l405_add1', isResidual: true },
    { id: 'l405_c2', source: 'l405_res_orig1', target: 'l405_norm1' },
    { id: 'l405_c3', source: 'l405_norm1', target: 'l405_gqa' },
    { id: 'l405_c4', source: 'l405_gqa', target: 'l405_add1' },
    { id: 'l405_c5', source: 'l405_add1', target: 'l405_res_orig2' },
    { id: 'l405_res_ffn', source: 'l405_res_orig2', target: 'l405_add2', isResidual: true },
    { id: 'l405_c6', source: 'l405_res_orig2', target: 'l405_norm2' },
    { id: 'l405_c7', source: 'l405_norm2', target: 'l405_ffn' },
    { id: 'l405_c8', source: 'l405_ffn', target: 'l405_add2' },
    { id: 'l405_c9', source: 'l405_add2', target: 'l405_final_norm' },
    { id: 'l405_c10', source: 'l405_final_norm', target: 'l405_head' }
  ];

  const specPartial = {
    id: 'llama-3-405b',
    name: 'Llama-3 405B (Dense)',
    tag: '405 Billion Params',
    description: 'Frontier dense autoregressive transformer with Grouped-Query Attention (16 KV heads).',
    version: '2.0.0',
    runtime,
    precision,
    distributed,
    blocks: dummyBlocks,
    repetitionGroups,
    connections
  };

  return recomputeSpecMetrics(specPartial, DEFAULT_HARDWARE);
}

// 4. Llama-3 70B (Dense Enterprise Workhorse)
function createLlama370BSpec(): ModelArchitectureSpec {
  const runtime: RuntimeDimensions = {
    batchSize: 16,
    contextLength: 8192,
    promptTokens: 4096,
    generationTokens: 1024,
    phase: 'prefill'
  };
  const precision: PrecisionType = 'BF16';
  const distributed: DistributedConfig = {
    numNodes: 4,
    gpusPerNode: 8,
    tensorParallelism: 4,
    pipelineParallelism: 2,
    expertParallelism: 1,
    zeroStage: 1,
    interconnectType: 'NVLink 5'
  };

  const rawBlocks: Omit<ModularBlock, 'inputShape' | 'outputShape' | 'stats'>[] = [
    {
      id: 'l70_embed',
      name: 'Embedding Layer',
      moduleType: 'nn.Embedding',
      category: 'embedding',
      parameters: { vocabSize: 128256, embeddingDim: 8192 },
      assignedGPU: 0,
      assignedNode: 0
    },
    {
      id: 'l70_res_orig1',
      name: 'Residual Origin (GQA)',
      moduleType: 'op.ResidualOrigin',
      category: 'operation',
      parameters: { dModel: 8192 },
      assignedGPU: 0,
      assignedNode: 0,
      notes: 'Residual origin tap: bifurcates layer input x into residual stream and GQA branch'
    },
    {
      id: 'l70_norm1',
      name: 'Pre-Attention RMSNorm',
      moduleType: 'nn.RMSNorm',
      category: 'norm',
      parameters: { normalizedShape: 8192, eps: 1e-5 },
      assignedGPU: 0,
      assignedNode: 0
    },
    {
      id: 'l70_gqa',
      name: 'Grouped-Query Attention',
      moduleType: 'nn.MultiheadAttention',
      category: 'attention',
      parameters: { dModel: 8192, numHeads: 64, numKVHeads: 8, headDim: 128 },
      assignedGPU: 1,
      assignedNode: 0
    },
    {
      id: 'l70_add1',
      name: 'Residual Add (GQA)',
      moduleType: 'op.Add',
      category: 'operation',
      parameters: { dModel: 8192, alpha: 1.0 },
      assignedGPU: 1,
      assignedNode: 0,
      notes: 'Residual connection: x + Attention(RMSNorm(x))'
    },
    {
      id: 'l70_res_orig2',
      name: 'Residual Origin (FFN)',
      moduleType: 'op.ResidualOrigin',
      category: 'operation',
      parameters: { dModel: 8192 },
      assignedGPU: 2,
      assignedNode: 0,
      notes: 'Residual origin tap: bifurcates intermediate stream x into residual stream and FFN branch'
    },
    {
      id: 'l70_norm2',
      name: 'Pre-FFN RMSNorm',
      moduleType: 'nn.RMSNorm',
      category: 'norm',
      parameters: { normalizedShape: 8192, eps: 1e-5 },
      assignedGPU: 2,
      assignedNode: 0
    },
    {
      id: 'l70_ffn',
      name: 'SwiGLU FFN',
      moduleType: 'nn.SwiGLUFFN',
      category: 'ffn',
      parameters: { inFeatures: 8192, intermediateDim: 28672 },
      assignedGPU: 3,
      assignedNode: 0
    },
    {
      id: 'l70_add2',
      name: 'Residual Add (FFN)',
      moduleType: 'op.Add',
      category: 'operation',
      parameters: { dModel: 8192, alpha: 1.0 },
      assignedGPU: 3,
      assignedNode: 0,
      notes: 'Residual connection: x + SwiGLU(RMSNorm(x))'
    },
    {
      id: 'l70_final_norm',
      name: 'Output RMSNorm',
      moduleType: 'nn.RMSNorm',
      category: 'norm',
      parameters: { normalizedShape: 8192, eps: 1e-5 },
      assignedGPU: 7,
      assignedNode: 3
    },
    {
      id: 'l70_head',
      name: 'LM Unembedding Head',
      moduleType: 'nn.CrossEntropyHead',
      category: 'head',
      parameters: { dModel: 8192, vocabSize: 128256 },
      assignedGPU: 7,
      assignedNode: 3
    }
  ];

  const repetitionGroups: RepetitionGroup[] = [
    {
      id: 'l70_transformer_layers',
      name: 'Llama-3 70B Transformer Layer',
      repetitions: 80,
      blockIds: [
        'l70_res_orig1',
        'l70_norm1', 
        'l70_gqa', 
        'l70_add1', 
        'l70_res_orig2', 
        'l70_norm2', 
        'l70_ffn', 
        'l70_add2'
      ],
      color: 'rose',
      notes: '80 repeating transformer layers with 8 KV heads'
    }
  ];

  const dummyBlocks = initBlocks(rawBlocks, 8192, runtime);

  const connections: BlockConnection[] = [
    { id: 'l70_c1', source: 'l70_embed', target: 'l70_res_orig1' },
    { id: 'l70_res_gqa', source: 'l70_res_orig1', target: 'l70_add1', isResidual: true },
    { id: 'l70_c2', source: 'l70_res_orig1', target: 'l70_norm1' },
    { id: 'l70_c3', source: 'l70_norm1', target: 'l70_gqa' },
    { id: 'l70_c4', source: 'l70_gqa', target: 'l70_add1' },
    { id: 'l70_c5', source: 'l70_add1', target: 'l70_res_orig2' },
    { id: 'l70_res_ffn', source: 'l70_res_orig2', target: 'l70_add2', isResidual: true },
    { id: 'l70_c6', source: 'l70_res_orig2', target: 'l70_norm2' },
    { id: 'l70_c7', source: 'l70_norm2', target: 'l70_ffn' },
    { id: 'l70_c8', source: 'l70_ffn', target: 'l70_add2' },
    { id: 'l70_c9', source: 'l70_add2', target: 'l70_final_norm' },
    { id: 'l70_c10', source: 'l70_final_norm', target: 'l70_head' }
  ];

  const specPartial = {
    id: 'llama-3-70b',
    name: 'Llama-3 70B (Dense)',
    tag: '70 Billion Params',
    description: 'Optimal performance-to-compute ratio open model with 80 layers and 8 KV heads.',
    version: '2.0.0',
    runtime,
    precision,
    distributed,
    blocks: dummyBlocks,
    repetitionGroups,
    connections
  };

  return recomputeSpecMetrics(specPartial, DEFAULT_HARDWARE);
}

// 5. Vision Transformer & Conv Patching (ViT-H/14)
function createViTHSpec(): ModelArchitectureSpec {
  const runtime: RuntimeDimensions = {
    batchSize: 64,
    contextLength: 256, // 16x16 patches = 256 tokens
    promptTokens: 256,
    generationTokens: 0,
    phase: 'training'
  };
  const precision: PrecisionType = 'FP16';
  const distributed: DistributedConfig = {
    numNodes: 1,
    gpusPerNode: 8,
    tensorParallelism: 1,
    pipelineParallelism: 1,
    expertParallelism: 1,
    zeroStage: 1,
    interconnectType: 'NVLink 5'
  };

  const rawBlocks: Omit<ModularBlock, 'inputShape' | 'outputShape' | 'stats'>[] = [
    {
      id: 'vit_conv',
      name: 'Conv2d Patch Projection',
      moduleType: 'nn.Conv2d',
      category: 'conv',
      parameters: { inChannels: 3, outChannels: 1280, kernelSize: 14, stride: 14, padding: 0, inputHeight: 224, inputWidth: 224 },
      assignedGPU: 0,
      assignedNode: 0,
      notes: '14x14 non-overlapping convolution patch tokenizer'
    },
    {
      id: 'vit_res_orig1',
      name: 'Residual Origin (MSA)',
      moduleType: 'op.ResidualOrigin',
      category: 'operation',
      parameters: { dModel: 1280 },
      assignedGPU: 0,
      assignedNode: 0,
      notes: 'Residual origin tap: bifurcates patch tokens into residual stream and MSA branch'
    },
    {
      id: 'vit_norm1',
      name: 'LayerNorm Pre-Attn',
      moduleType: 'nn.LayerNorm',
      category: 'norm',
      parameters: { normalizedShape: 1280, eps: 1e-5 },
      assignedGPU: 0,
      assignedNode: 0
    },
    {
      id: 'vit_mha',
      name: 'Vision Multi-Head Attention',
      moduleType: 'nn.MultiheadAttention',
      category: 'attention',
      parameters: { dModel: 1280, numHeads: 16, numKVHeads: 16, headDim: 80 },
      assignedGPU: 1,
      assignedNode: 0
    },
    {
      id: 'vit_add1',
      name: 'Residual Add (MSA)',
      moduleType: 'op.Add',
      category: 'operation',
      parameters: { dModel: 1280, alpha: 1.0 },
      assignedGPU: 1,
      assignedNode: 0,
      notes: 'Residual connection: x + MSA(LayerNorm(x))'
    },
    {
      id: 'vit_res_orig2',
      name: 'Residual Origin (MLP)',
      moduleType: 'op.ResidualOrigin',
      category: 'operation',
      parameters: { dModel: 1280 },
      assignedGPU: 2,
      assignedNode: 0,
      notes: 'Residual origin tap: bifurcates intermediate stream x into residual stream and MLP branch'
    },
    {
      id: 'vit_norm2',
      name: 'LayerNorm Pre-MLP',
      moduleType: 'nn.LayerNorm',
      category: 'norm',
      parameters: { normalizedShape: 1280, eps: 1e-5 },
      assignedGPU: 2,
      assignedNode: 0
    },
    {
      id: 'vit_mlp',
      name: 'Linear MLP Expansion',
      moduleType: 'nn.Linear',
      category: 'ffn',
      parameters: { inFeatures: 1280, outFeatures: 5120 },
      assignedGPU: 3,
      assignedNode: 0
    },
    {
      id: 'vit_add2',
      name: 'Residual Add (MLP)',
      moduleType: 'op.Add',
      category: 'operation',
      parameters: { dModel: 1280, alpha: 1.0 },
      assignedGPU: 3,
      assignedNode: 0,
      notes: 'Residual connection: x + MLP(LayerNorm(x))'
    },
    {
      id: 'vit_head',
      name: 'Classification Head',
      moduleType: 'nn.Linear',
      category: 'head',
      parameters: { inFeatures: 1280, outFeatures: 1000 },
      assignedGPU: 4,
      assignedNode: 0,
      notes: 'ImageNet-1k 1000-class linear classification logits'
    }
  ];

  const repetitionGroups: RepetitionGroup[] = [
    {
      id: 'vit_transformer_layers',
      name: 'ViT Transformer Encoder Layer',
      repetitions: 32,
      blockIds: [
        'vit_res_orig1',
        'vit_norm1', 
        'vit_mha', 
        'vit_add1', 
        'vit_res_orig2', 
        'vit_norm2', 
        'vit_mlp', 
        'vit_add2'
      ],
      color: 'rose',
      notes: '32 repeating vision transformer blocks'
    }
  ];

  const dummyBlocks = initBlocks(rawBlocks, 1280, runtime);

  const connections: BlockConnection[] = [
    { id: 'vit_c1', source: 'vit_conv', target: 'vit_res_orig1' },
    { id: 'vit_res_mha', source: 'vit_res_orig1', target: 'vit_add1', isResidual: true },
    { id: 'vit_c2', source: 'vit_res_orig1', target: 'vit_norm1' },
    { id: 'vit_c3', source: 'vit_norm1', target: 'vit_mha' },
    { id: 'vit_c4', source: 'vit_mha', target: 'vit_add1' },
    { id: 'vit_c5', source: 'vit_add1', target: 'vit_res_orig2' },
    { id: 'vit_res_mlp', source: 'vit_res_orig2', target: 'vit_add2', isResidual: true },
    { id: 'vit_c6', source: 'vit_res_orig2', target: 'vit_norm2' },
    { id: 'vit_c7', source: 'vit_norm2', target: 'vit_mlp' },
    { id: 'vit_c8', source: 'vit_mlp', target: 'vit_add2' },
    { id: 'vit_c9', source: 'vit_add2', target: 'vit_head' }
  ];

  const specPartial = {
    id: 'vit-h-14',
    name: 'Vision Transformer (ViT-H/14)',
    tag: '632 Million Params',
    description: 'Vision backbone with 14x14 Conv2d patch embedding, 32 transformer blocks, and linear classification head.',
    version: '2.0.0',
    runtime,
    precision,
    distributed,
    blocks: dummyBlocks,
    repetitionGroups,
    connections
  };

  return recomputeSpecMetrics(specPartial, DEFAULT_HARDWARE);
}

export const PRESET_ARCHITECTURES: ModelPreset[] = [
  {
    id: 'trillion-speculative-moe',
    name: 'Example-1T (Fictional Model)',
    tag: '1.02T Fictional Example',
    description: 'A simple example fictional 1-Trillion parameter mixture-of-experts model for illustrative scaling simulations.',
    dimensions: {
      dModel: 16384,
      numLayers: 128,
      numHeads: 128,
      numKVHeads: 16,
      intermediateDim: 32768,
      vocabSize: 128256,
      isMoE: true,
      numExperts: 128,
      topKExperts: 8
    },
    runtime: {
      batchSize: 16,
      contextLength: 65536,
      promptTokens: 32768,
      generationTokens: 4096,
      phase: 'prefill'
    },
    precision: 'FP8',
    recommendedDist: {
      numNodes: 64,
      gpusPerNode: 8,
      tensorParallelism: 8,
      pipelineParallelism: 16,
      expertParallelism: 8,
      zeroStage: 1,
      interconnectType: 'InfiniBand NDR'
    },
    createSpec: create1TSpeculativeMoESpec
  },
  {
    id: 'deepseek-v3-moe',
    name: 'DeepSeek-V3 / R1 (671B MoE)',
    tag: '671 Billion Params',
    description: 'Multi-Head Latent Attention with 256 routed experts and 1 shared expert.',
    dimensions: {
      dModel: 7168,
      numLayers: 61,
      numHeads: 128,
      numKVHeads: 128,
      intermediateDim: 18432,
      vocabSize: 129280,
      isMoE: true,
      numExperts: 256,
      topKExperts: 8
    },
    runtime: {
      batchSize: 32,
      contextLength: 32768,
      promptTokens: 16384,
      generationTokens: 2048,
      phase: 'decode'
    },
    precision: 'FP8',
    recommendedDist: {
      numNodes: 32,
      gpusPerNode: 8,
      tensorParallelism: 8,
      pipelineParallelism: 8,
      expertParallelism: 16,
      zeroStage: 1,
      interconnectType: 'InfiniBand NDR'
    },
    createSpec: createDeepSeekV3Spec
  },
  {
    id: 'llama-3-405b',
    name: 'Llama-3 405B (Dense)',
    tag: '405 Billion Params',
    description: 'Frontier dense autoregressive transformer with Grouped-Query Attention (16 KV heads).',
    dimensions: {
      dModel: 16384,
      numLayers: 126,
      numHeads: 128,
      numKVHeads: 16,
      intermediateDim: 53248,
      vocabSize: 128256,
      isMoE: false
    },
    runtime: {
      batchSize: 8,
      contextLength: 131072,
      promptTokens: 65536,
      generationTokens: 4096,
      phase: 'prefill'
    },
    precision: 'FP8',
    recommendedDist: {
      numNodes: 16,
      gpusPerNode: 8,
      tensorParallelism: 8,
      pipelineParallelism: 8,
      expertParallelism: 1,
      zeroStage: 1,
      interconnectType: 'InfiniBand NDR'
    },
    createSpec: createLlama3405BSpec
  },
  {
    id: 'llama-3-70b',
    name: 'Llama-3 70B (Dense)',
    tag: '70 Billion Params',
    description: 'Optimal performance-to-compute ratio open model with 80 layers and 8 KV heads.',
    dimensions: {
      dModel: 8192,
      numLayers: 80,
      numHeads: 64,
      numKVHeads: 8,
      intermediateDim: 28672,
      vocabSize: 128256,
      isMoE: false
    },
    runtime: {
      batchSize: 16,
      contextLength: 8192,
      promptTokens: 4096,
      generationTokens: 1024,
      phase: 'prefill'
    },
    precision: 'BF16',
    recommendedDist: {
      numNodes: 4,
      gpusPerNode: 8,
      tensorParallelism: 4,
      pipelineParallelism: 2,
      expertParallelism: 1,
      zeroStage: 1,
      interconnectType: 'NVLink 5'
    },
    createSpec: createLlama370BSpec
  },
  {
    id: 'vit-h-14',
    name: 'Vision Transformer (ViT-H/14)',
    tag: '632 Million Params',
    description: 'Vision backbone with 14x14 Conv2d patch embedding, 32 transformer blocks, and linear classification head.',
    dimensions: {
      dModel: 1280,
      numLayers: 32,
      numHeads: 16,
      numKVHeads: 16,
      intermediateDim: 5120,
      vocabSize: 1000,
      isMoE: false
    },
    runtime: {
      batchSize: 64,
      contextLength: 256,
      promptTokens: 256,
      generationTokens: 0,
      phase: 'training'
    },
    precision: 'FP16',
    recommendedDist: {
      numNodes: 1,
      gpusPerNode: 8,
      tensorParallelism: 1,
      pipelineParallelism: 1,
      expertParallelism: 1,
      zeroStage: 1,
      interconnectType: 'NVLink 5'
    },
    createSpec: createViTHSpec
  }
];
