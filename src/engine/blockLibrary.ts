import { CustomBlockDefinition, PyTorchModuleType, BlockCategory } from '../types';

export interface PredefinedBlockTemplate {
  id: string;
  name: string;
  moduleType: PyTorchModuleType;
  category: BlockCategory;
  tag: string;
  description: string;
  defaultParameters: Record<string, any>;
  paramSchema: {
    key: string;
    label: string;
    type: 'number' | 'string' | 'boolean' | 'select';
    options?: string[];
    defaultValue: any;
    description?: string;
  }[];
  formulaSummary: string;
  color: string;
}

export const PREDEFINED_BLOCK_LIBRARY: PredefinedBlockTemplate[] = [
  {
    id: 'lib_embedding',
    name: 'Vocabulary & Pos Embedding',
    moduleType: 'nn.Embedding',
    category: 'embedding',
    tag: 'Lookup',
    description: 'Maps discrete vocabulary indices into continuous hidden embedding vectors.',
    defaultParameters: {
      vocabSize: 128256,
      embeddingDim: 8192
    },
    paramSchema: [
      { key: 'vocabSize', label: 'Vocab Size', type: 'number', defaultValue: 128256, description: 'Total vocabulary token count' },
      { key: 'embeddingDim', label: 'Embedding Dimension', type: 'number', defaultValue: 8192, description: 'Model hidden dimension (d_model)' }
    ],
    formulaSummary: 'P = vocab_size × embedding_dim',
    color: 'blue'
  },
  {
    id: 'lib_conv2d',
    name: '2D Convolution (Conv2d)',
    moduleType: 'nn.Conv2d',
    category: 'conv',
    tag: 'Spatial',
    description: 'Spatial 2D convolutional filter bank for patch projection, image stems, or downsampling.',
    defaultParameters: {
      inChannels: 3,
      outChannels: 64,
      kernelSize: 7,
      stride: 2,
      padding: 3,
      inputHeight: 224,
      inputWidth: 224
    },
    paramSchema: [
      { key: 'inChannels', label: 'Input Channels', type: 'number', defaultValue: 3 },
      { key: 'outChannels', label: 'Output Channels', type: 'number', defaultValue: 64 },
      { key: 'kernelSize', label: 'Kernel Size (K)', type: 'number', defaultValue: 7 },
      { key: 'stride', label: 'Stride', type: 'number', defaultValue: 2 },
      { key: 'padding', label: 'Padding', type: 'number', defaultValue: 3 },
      { key: 'inputHeight', label: 'Input Height', type: 'number', defaultValue: 224 },
      { key: 'inputWidth', label: 'Input Width', type: 'number', defaultValue: 224 }
    ],
    formulaSummary: 'P = C_out × C_in × K² + C_out | FLOPs = 2 × (C_in × K²) × (C_out × H_out × W_out)',
    color: 'emerald'
  },
  {
    id: 'lib_gqa_attention',
    name: 'Multi-Head Attention (GQA / MHA)',
    moduleType: 'nn.MultiheadAttention',
    category: 'attention',
    tag: 'Core Transformer',
    description: 'Grouped-Query Attention with configurable Query heads and KV heads for high-speed decode.',
    defaultParameters: {
      dModel: 8192,
      numHeads: 64,
      numKVHeads: 8,
      headDim: 128,
      dropout: 0.0
    },
    paramSchema: [
      { key: 'dModel', label: 'Hidden Dim (d_model)', type: 'number', defaultValue: 8192 },
      { key: 'numHeads', label: 'Query Heads (H_q)', type: 'number', defaultValue: 64 },
      { key: 'numKVHeads', label: 'KV Heads (H_kv)', type: 'number', defaultValue: 8, description: 'Set equal to H_q for standard MHA, or 1 for MQA' },
      { key: 'headDim', label: 'Head Dimension', type: 'number', defaultValue: 128 }
    ],
    formulaSummary: 'P = d_model × (H_q + 2×H_kv + H_q) × d_head | FLOPs = 2P + 4×S×d_model',
    color: 'amber'
  },
  {
    id: 'lib_swiglu_ffn',
    name: 'SwiGLU Feed-Forward (FFN)',
    moduleType: 'nn.SwiGLUFFN',
    category: 'ffn',
    tag: 'Dense MLP',
    description: 'Swish-Gated Linear Unit MLP block utilized in modern dense LLMs (Llama-3, Mistral, Gemma).',
    defaultParameters: {
      inFeatures: 8192,
      intermediateDim: 28672
    },
    paramSchema: [
      { key: 'inFeatures', label: 'Input Dim (d_model)', type: 'number', defaultValue: 8192 },
      { key: 'intermediateDim', label: 'Intermediate Dim', type: 'number', defaultValue: 28672, description: 'Typically ~ (8/3) × d_model' }
    ],
    formulaSummary: 'P = 3 × in_features × intermediate_dim | FLOPs = 2P',
    color: 'violet'
  },
  {
    id: 'lib_moe_block',
    name: 'Mixture of Experts (MoE) Layer',
    moduleType: 'nn.MoEBlock',
    category: 'moe',
    tag: 'Sparse MoE',
    description: 'Sparse conditional routing network with Top-K expert activation per token.',
    defaultParameters: {
      dModel: 8192,
      intermediateDim: 28672,
      numExperts: 64,
      topK: 8
    },
    paramSchema: [
      { key: 'dModel', label: 'Hidden Dim (d_model)', type: 'number', defaultValue: 8192 },
      { key: 'intermediateDim', label: 'Expert Intermediate Dim', type: 'number', defaultValue: 28672 },
      { key: 'numExperts', label: 'Total Experts (E)', type: 'number', defaultValue: 64 },
      { key: 'topK', label: 'Active Experts (Top-K)', type: 'number', defaultValue: 8 }
    ],
    formulaSummary: 'Total P = E × (3 × d × d_ffn) + (d × E) | Active P = TopK × (3 × d × d_ffn)',
    color: 'purple'
  },
  {
    id: 'lib_rmsnorm',
    name: 'RMSNorm / LayerNorm',
    moduleType: 'nn.RMSNorm',
    category: 'norm',
    tag: 'Stabilizer',
    description: 'Root Mean Square Layer Normalization without mean-centering overhead.',
    defaultParameters: {
      normalizedShape: 8192,
      eps: 1e-6
    },
    paramSchema: [
      { key: 'normalizedShape', label: 'Normalized Shape', type: 'number', defaultValue: 8192 },
      { key: 'eps', label: 'Epsilon', type: 'number', defaultValue: 1e-6 }
    ],
    formulaSummary: 'P = normalized_shape | FLOPs = 4 × normalized_shape',
    color: 'cyan'
  },
  {
    id: 'lib_mamba',
    name: 'Mamba Selective State Space (SSM)',
    moduleType: 'nn.MambaBlock',
    category: 'ssm',
    tag: 'Linear Recurrence',
    description: 'Hardware-aware selective state space model offering linear O(N) context scaling.',
    defaultParameters: {
      dModel: 4096,
      dState: 16,
      dConv: 4,
      expand: 2
    },
    paramSchema: [
      { key: 'dModel', label: 'Model Dim', type: 'number', defaultValue: 4096 },
      { key: 'dState', label: 'SSM State Dim (N)', type: 'number', defaultValue: 16 },
      { key: 'dConv', label: 'Conv Kernel Width', type: 'number', defaultValue: 4 },
      { key: 'expand', label: 'Expansion Factor (E)', type: 'number', defaultValue: 2 }
    ],
    formulaSummary: 'O(N) recurrence with selective discretization parameters',
    color: 'teal'
  },
  {
    id: 'lib_linear',
    name: 'Linear Dense Projection (nn.Linear)',
    moduleType: 'nn.Linear',
    category: 'ffn',
    tag: 'Matrix Multiply',
    description: 'General linear feed-forward projection (GEMM) layer.',
    defaultParameters: {
      inFeatures: 8192,
      outFeatures: 8192,
      bias: true
    },
    paramSchema: [
      { key: 'inFeatures', label: 'Input Features', type: 'number', defaultValue: 8192 },
      { key: 'outFeatures', label: 'Output Features', type: 'number', defaultValue: 8192 },
      { key: 'bias', label: 'Bias', type: 'boolean', defaultValue: true }
    ],
    formulaSummary: 'P = in_features × out_features (+ bias) | FLOPs = 2 × in × out',
    color: 'sky'
  },
  {
    id: 'lib_lm_head',
    name: 'Cross-Entropy LM Head (Unembedding)',
    moduleType: 'nn.CrossEntropyHead',
    category: 'head',
    tag: 'Output',
    description: 'Final linear projection from model hidden space to target vocabulary logit scores.',
    defaultParameters: {
      dModel: 8192,
      vocabSize: 128256
    },
    paramSchema: [
      { key: 'dModel', label: 'Hidden Dimension', type: 'number', defaultValue: 8192 },
      { key: 'vocabSize', label: 'Vocabulary Size', type: 'number', defaultValue: 128256 }
    ],
    formulaSummary: 'P = d_model × vocab_size | FLOPs = 2 × d_model × vocab_size',
    color: 'rose'
  },
  {
    id: 'lib_add',
    name: 'Residual Add (op.Add)',
    moduleType: 'op.Add',
    category: 'operation',
    tag: 'Residual Stream',
    description: 'Elementwise tensor addition combining residual bypass streams with transformed layer outputs (x + F(x)).',
    defaultParameters: {
      dModel: 8192,
      alpha: 1.0
    },
    paramSchema: [
      { key: 'dModel', label: 'Hidden Dimension (d_model)', type: 'number', defaultValue: 8192 },
      { key: 'alpha', label: 'Residual Scaling Factor (alpha)', type: 'number', defaultValue: 1.0, description: 'Scale factor for residual branch: out = x + alpha * F(x)' }
    ],
    formulaSummary: 'P = 0 (weights) | FLOPs = B × S × d_model | Intensity ≈ 0.17 FLOP/B (Memory Bound)',
    color: 'emerald'
  },
  {
    id: 'lib_residual_origin',
    name: 'Residual Origin (op.ResidualOrigin)',
    moduleType: 'op.ResidualOrigin',
    category: 'operation',
    tag: 'Residual Origin',
    description: 'Bifurcation point for the residual identity stream. Placed at the layer entrance inside grouped layers to tap the input tensor x before transformation.',
    defaultParameters: {
      dModel: 8192
    },
    paramSchema: [
      { key: 'dModel', label: 'Hidden Dimension (d_model)', type: 'number', defaultValue: 8192 }
    ],
    formulaSummary: 'P = 0 | FLOPs = 0 | Identity Tap x → [x_residual, x_main] (Zero cost pointer fork)',
    color: 'emerald'
  }
];
