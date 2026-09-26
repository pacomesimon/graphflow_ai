/**
 * GraphFlow-AI - Core Types and Mathematical Simulation Definitions
 */

// REVIEWER: FP8 is included as a PrecisionType but getBytesPerParam treats FP8 and INT8 identically
// (both return 1 byte). If FP8 is distinct from INT8 in future hardware semantics, split the case.
export type PrecisionType = 'FP32' | 'FP16' | 'BF16' | 'FP8' | 'INT8' | 'FP4';

export type PyTorchModuleType = 
  | 'nn.Embedding'
  | 'nn.Conv2d'
  | 'nn.MultiheadAttention'
  | 'nn.Linear'
  | 'nn.RMSNorm'
  | 'nn.LayerNorm'
  | 'nn.MoEBlock'
  | 'nn.SwiGLUFFN'
  | 'nn.MambaBlock'
  | 'nn.CrossEntropyHead'
  | 'op.Add'
  | 'op.ResidualOrigin'
  | 'custom';

export type BlockCategory = 
  | 'embedding' 
  | 'attention' 
  | 'ffn' 
  | 'moe' 
  | 'conv' 
  | 'norm' 
  | 'head' 
  | 'ssm' 
  | 'operation'
  | 'custom';

export interface TensorShape {
  dims: (number | string)[];
  label: string;
}

export interface BlockStats {
  params: number;             // Trainable parameters
  activeParams: number;       // Active parameters per token (e.g. for MoE)
  flopsPerToken: number;      // FLOPs per token
  arithmeticIntensity: number;// FLOPs/Byte
  memoryBound: boolean;       // Intensity < Hardware ridge point
}

export interface ModularBlock {
  id: string;
  name: string;
  moduleType: PyTorchModuleType;
  category: BlockCategory;
  // REVIEWER: `parameters` is typed as `Record<string, any>` — consider narrowing this to a
  // discriminated union keyed on moduleType for better type-safety and IDE auto-complete.
  parameters: Record<string, any>;
  repeatLayers?: number;       // Repetition factor (e.g. 32x repeating transformer layers)
  inputShape: TensorShape;
  outputShape: TensorShape;
  stats: BlockStats;
  assignedGPU?: number;
  assignedNode?: number;
  isCutBoundary?: boolean;
  notes?: string;
}

export interface BlockConnection {
  id: string;
  source: string;
  target: string;
  tensorShape?: TensorShape;
  // REVIEWER: `dataType` is declared but never read anywhere in the codebase — remove or use it.
  dataType?: string;
  isResidual?: boolean;
  sourceHandle?: string;
  targetHandle?: string;
  isMismatch?: boolean;
  mismatchDetail?: string;
}

export interface RepetitionGroup {
  id: string;
  name: string;             // e.g. "DeepSeek-V3 Transformer Layer" or "Repetitive Backbone Block"
  repetitions: number;      // e.g. 61
  blockIds: string[];       // Ordered list of block IDs inside this repeated container
  color?: string;           // Optional accent color ('rose' | 'amber' | 'sky' | 'purple' | 'emerald')
  notes?: string;
}

export interface ModelArchitectureSpec {
  id: string;
  name: string;
  tag?: string;
  description: string;
  version: string;
  runtime: RuntimeDimensions;
  precision: PrecisionType;
  distributed: DistributedConfig;
  blocks: ModularBlock[];
  repetitionGroups?: RepetitionGroup[];
  connections: BlockConnection[];
  summary: {
    totalParameters: number;
    activeParameters: number;
    totalFlopsPerToken: number;
    memoryFootprintGB: number;
    layerCount: number;
    hasMismatches: boolean;
    mismatchCount: number;
  };
}

export interface CustomBlockDefinition {
  id: string;
  name: string;
  // REVIEWER: `moduleType` is `string` here but `PyTorchModuleType` in ModularBlock. The cast
  // `template.moduleType as any` in ArchitectureCanvas is a workaround for this widening; align
  // the types so the cast can be removed.
  moduleType: string;
  category: BlockCategory;
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

export interface ModelDimensions {
  dModel: number;       // Hidden dimension (e.g., 4096, 8192, 16384)
  numLayers: number;    // Number of transformer layers (L, e.g., 32, 80, 128)
  numHeads: number;     // Number of query attention heads (H, e.g., 32, 64, 128)
  numKVHeads: number;   // Number of key-value heads for GQA/MQA (e.g., 8, 16, 64)
  intermediateDim: number; // MLP intermediate dimension
  vocabSize: number;    // Vocabulary size
  isMoE: boolean;       // Mixture of Experts enabled
  numExperts?: number;  // Total experts
  topKExperts?: number; // Active experts per token
}

export interface RuntimeDimensions {
  batchSize: number;           // Batch Size (B)
  contextLength: number;       // Context Window Length (S)
  promptTokens: number;        // Prompt/Prefill tokens
  generationTokens: number;    // Generation/Decode tokens
  phase: 'prefill' | 'decode' | 'training'; // Active simulation phase
}

export interface HardwareSpec {
  id: string;
  name: string;
  vendor: string;
  peakTFlopsFP16: number;      // Peak TFLOPs FP16/BF16
  peakTFlopsFP8: number;       // Peak TFLOPs FP8/FP4
  memoryBandwidthTBps: number; // Memory Bandwidth in TB/s
  vramGBPerGPU: number;        // VRAM per accelerator in GB
  nvlinkBandwidthGBps: number; // Intra-node interconnect BW per GPU (GB/s)
  networkBandwidthGBps: number;// Inter-node network BW per GPU
}

export interface DistributedConfig {
  numNodes: number;            // Number of nodes
  gpusPerNode: number;         // Accelerators per node
  tensorParallelism: number;   // TP degree
  pipelineParallelism: number; // PP degree
  expertParallelism: number;   // EP degree
  zeroStage: 0 | 1 | 2 | 3;    // ZeRO optimizer sharding stage
  // REVIEWER: `interconnectType` is stored in DistributedConfig but the bandwidth values come
  // from HardwareSpec (nvlinkBandwidthGBps / networkBandwidthGBps). The two fields are never
  // cross-validated — a user could select "InfiniBand NDR" while the hardware is Apple M4.
  // Consider driving bandwidth from the hardware spec alone, or add a validation guard.
  interconnectType: 'NVLink 5' | 'NVLink 4' | 'PCIe Gen5' | 'InfiniBand NDR' | 'RoCE v2';
}

export interface MemoryProfile {
  weightsGB: number;
  optimizerGB: number;
  activationGB: number;
  kvCacheGB: number;
  totalGB: number;
  perGpuGB: number;
  clusterCapacityGB: number;
  isOOM: boolean;
}

export interface RooflinePoint {
  id: string;
  label: string;
  arithmeticIntensity: number; // FLOPs/Byte (X-axis)
  attainableTFlops: number;    // TFLOPs/sec (Y-axis)
  memoryBound: boolean;
  category: string;
}

export interface CommLatencyStats {
  tpCommTimeMs: number;
  ppCommTimeMs: number;
  moeCommTimeMs: number;
  totalCommTimeMs: number;
  computeTimeMs: number;
  commToComputeRatio: number;
  allReduceSizeMB: number;
  allToAllSizeMB: number;
  bottleneckSeverity: 'none' | 'moderate' | 'critical';
}

export type Theme = 'light' | 'dark';

// React Flow node data for ModularBlockNode
// REVIEWER: The index signature `[key: string]: unknown` is required by React Flow v12 but
// forces every property to be cast when read back — the downstream (targetNode.data as
// ModularBlockNodeData) casts in graphManager.ts are a direct consequence. Once React Flow
// removes or relaxes the constraint, remove the index signature.
export interface ModularBlockNodeData {
  [key: string]: unknown;
  block: ModularBlock;
  isInRepetitionGroup?: boolean;
  repetitionGroupId?: string;
  repetitionMultiplier?: number;
  hasDimensionMismatch?: boolean;
  mismatchDetail?: string;
  onInspect?: (blockId: string) => void;
  onDelete?: (blockId: string) => void;
  onDuplicate?: (blockId: string) => void;
}

// React Flow node data for RepetitionGroupNode
export interface RepetitionGroupNodeData {
  [key: string]: unknown;
  group: RepetitionGroup;
  memberBlocks: ModularBlock[];
  totalGroupParams: number;
  perLayerParams: number;
  totalGroupFlops: number;
  onUpdateRepetitions?: (newRep: number) => void;
  onUpdateGroupName?: (newName: string) => void;
  onUngroup?: () => void;
}
