import React, { useState, useCallback, useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap, 
  applyNodeChanges, 
  applyEdgeChanges, 
  addEdge,
  Node, 
  Edge, 
  OnNodesChange, 
  OnEdgesChange, 
  OnConnect,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Automatically fits canvas viewport when graph/preset loads
const FlowFitter: React.FC<{ specId: string; nodeCount: number }> = ({ specId, nodeCount }) => {
  const { fitView } = useReactFlow();
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.18, duration: 450 });
    }, 60);
    return () => clearTimeout(timer);
  }, [specId, nodeCount, fitView]);
  return null;
};

import { ModularBlockNode, RepetitionGroupNode } from './CustomNodes';
import { TensorFlowEdge } from './CustomEdges';
import { 
  ModelArchitectureSpec, 
  ModularBlock, 
  BlockConnection, 
  CustomBlockDefinition,
  RuntimeDimensions, 
  PrecisionType, 
  DistributedConfig,
  RepetitionGroup
} from '../../types';
import { convertSpecToFlowGraph } from '../../engine/graphManager';
import { calculateBlockMetrics, computeModelArchitectureSummary, validateConnections, recomputeSpecMetrics } from '../../engine/modularMath';
import { DEFAULT_HARDWARE } from '../../engine/hardwareSpecs';
import { PredefinedBlockTemplate } from '../../engine/blockLibrary';

import { 
  Plus, 
  Sliders, 
  FileCode, 
  Bot, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw,
  Layers,
  Sparkles,
  Boxes,
  X,
  Check,
  CheckSquare,
  Square,
  Repeat,
  MoveVertical,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { AddBlockDrawer } from './AddBlockDrawer';
import { BlockInspectorModal } from './BlockInspectorModal';
import { ModelJsonModal } from './ModelJsonModal';
import { AssistantChatDrawer } from '../assistant/AssistantChatDrawer';

export interface ArchitectureCanvasProps {
  spec: ModelArchitectureSpec;
  onUpdateSpec: (updatedSpec: ModelArchitectureSpec) => void;
  customBlocks: CustomBlockDefinition[];
  onSaveCustomBlock: (newBlock: CustomBlockDefinition) => void;
  minEdgeHeight?: number;
  onUpdateMinEdgeHeight?: (height: number) => void;
  hardware?: import('../../types').HardwareSpec;
  onReRender?: () => void;
}

const ArchitectureCanvasInner: React.FC<ArchitectureCanvasProps> = ({
  spec,
  onUpdateSpec,
  customBlocks,
  onSaveCustomBlock,
  minEdgeHeight = 95,
  onUpdateMinEdgeHeight,
  hardware = DEFAULT_HARDWARE,
  onReRender
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Modal / Drawer visibility states
  const [isAddBlockOpen, setIsAddBlockOpen] = useState(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Repetition Group modal state
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedGroupBlockIds, setSelectedGroupBlockIds] = useState<string[]>([]);
  const [newGroupReps, setNewGroupReps] = useState(61);
  const [newGroupName, setNewGroupName] = useState('Transformer Layer Block');

  // Inspector target block
  const inspectedBlock = useMemo(() => {
    if (!selectedBlockId) return null;
    return spec.blocks.find(b => b.id === selectedBlockId) || null;
  }, [spec.blocks, selectedBlockId]);

  const inspectedBlockGroup = useMemo(() => {
    if (!inspectedBlock || !spec.repetitionGroups) return null;
    const grp = spec.repetitionGroups.find(g => g.blockIds.includes(inspectedBlock.id));
    if (!grp) return null;
    return {
      groupId: grp.id,
      groupName: grp.name,
      repetitions: grp.repetitions
    };
  }, [inspectedBlock, spec.repetitionGroups]);

  // Handlers for node interactions
  const handleInspect = useCallback((blockId: string) => {
    setSelectedBlockId(blockId);
  }, []);

  const handleDeleteBlock = useCallback((blockId: string) => {
    const remainingBlocks = spec.blocks.filter(b => b.id !== blockId);
    const remainingConnections = spec.connections.filter(c => c.source !== blockId && c.target !== blockId);
    
    // Clean up repetition groups
    const remainingGroups = (spec.repetitionGroups || [])
      .map(grp => ({
        ...grp,
        blockIds: grp.blockIds.filter(id => id !== blockId)
      }))
      .filter(grp => grp.blockIds.length > 0);

    const updated = {
      ...spec,
      blocks: remainingBlocks,
      connections: remainingConnections,
      repetitionGroups: remainingGroups
    };
    const recomputed = recomputeSpecMetrics(updated, DEFAULT_HARDWARE);
    onUpdateSpec(recomputed);
  }, [spec, onUpdateSpec]);

  const handleDuplicateBlock = useCallback((blockId: string) => {
    const target = spec.blocks.find(b => b.id === blockId);
    if (!target) return;

    const newId = `${target.id}_copy_${Date.now().toString().slice(-4)}`;
    const duplicatedBlock: ModularBlock = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`
    };

    const updatedBlocks = [...spec.blocks, duplicatedBlock];
    const updated = {
      ...spec,
      blocks: updatedBlocks
    };
    const recomputed = recomputeSpecMetrics(updated, DEFAULT_HARDWARE);
    onUpdateSpec(recomputed);
  }, [spec, onUpdateSpec]);

  // Repetition Group Handlers
  const handleUpdateGroupRepetitions = useCallback((groupId: string, newReps: number) => {
    const sanitized = Math.max(1, Math.round(newReps));
    const currentGroups = spec.repetitionGroups || [];
    const updatedGroups = currentGroups.map(g => 
      g.id === groupId ? { ...g, repetitions: sanitized } : g
    );
    const updated = {
      ...spec,
      repetitionGroups: updatedGroups
    };
    const recomputed = recomputeSpecMetrics(updated, DEFAULT_HARDWARE);
    onUpdateSpec(recomputed);
  }, [spec, onUpdateSpec]);

  const handleUpdateGroupName = useCallback((groupId: string, newName: string) => {
    const currentGroups = spec.repetitionGroups || [];
    const updatedGroups = currentGroups.map(g => 
      g.id === groupId ? { ...g, name: newName } : g
    );
    onUpdateSpec({ ...spec, repetitionGroups: updatedGroups });
  }, [spec, onUpdateSpec]);

  const handleUngroup = useCallback((groupId: string) => {
    const groupToUngroup = (spec.repetitionGroups || []).find(g => g.id === groupId);
    if (!groupToUngroup) return;

    const remainingGroups = (spec.repetitionGroups || []).filter(g => g.id !== groupId);
    const updatedBlocks = spec.blocks.map(b => {
      if (groupToUngroup.blockIds.includes(b.id)) {
        return { ...b, repeatLayers: groupToUngroup.repetitions };
      }
      return b;
    });

    const updated = {
      ...spec,
      blocks: updatedBlocks,
      repetitionGroups: remainingGroups
    };
    const recomputed = recomputeSpecMetrics(updated, DEFAULT_HARDWARE);
    onUpdateSpec(recomputed);
  }, [spec, onUpdateSpec]);

  const handleOpenGroupModal = () => {
    // Collect all blocks that are currently in a group
    const alreadyGroupedIds = new Set<string>();
    (spec.repetitionGroups || []).forEach(g => g.blockIds.forEach(id => alreadyGroupedIds.add(id)));

    // Auto-select candidate repeated blocks (attention, norm, moe, ffn) that are not grouped
    const candidates = spec.blocks
      .filter(b => !alreadyGroupedIds.has(b.id) && b.category !== 'embedding' && b.category !== 'head')
      .map(b => b.id);

    setSelectedGroupBlockIds(candidates.length > 0 ? candidates : spec.blocks.map(b => b.id));
    setNewGroupReps(61);
    setNewGroupName('Transformer Backbone Layer');
    setIsGroupModalOpen(true);
  };

  const handleCreateGroup = () => {
    if (selectedGroupBlockIds.length === 0) return;

    const newGroup: RepetitionGroup = {
      id: `grp_${Date.now().toString().slice(-6)}`,
      name: newGroupName.trim() || 'Repeated Layer Block',
      repetitions: Math.max(1, newGroupReps),
      blockIds: selectedGroupBlockIds,
      color: 'rose'
    };

    // Filter out existing groupings that overlap
    const existingGroups = (spec.repetitionGroups || []).map(g => ({
      ...g,
      blockIds: g.blockIds.filter(id => !selectedGroupBlockIds.includes(id))
    })).filter(g => g.blockIds.length > 0);

    const updated = {
      ...spec,
      repetitionGroups: [...existingGroups, newGroup]
    };
    const recomputed = recomputeSpecMetrics(updated, DEFAULT_HARDWARE);
    onUpdateSpec(recomputed);
    setIsGroupModalOpen(false);
  };

  // Clear all blocks & connections to start from scratch
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  // React Flow instance for smooth viewport fitting and DAG realignment
  const { fitView } = useReactFlow();
  const [isReRendering, setIsReRendering] = useState(false);

  // Auto-reset confirmation after 4 seconds if user doesn't click
  React.useEffect(() => {
    if (!isConfirmingClear) return;
    const timer = setTimeout(() => setIsConfirmingClear(false), 4000);
    return () => clearTimeout(timer);
  }, [isConfirmingClear]);

  const handleClearAll = useCallback(() => {
    const emptySpec: ModelArchitectureSpec = {
      ...spec,
      id: `custom-empty-${Date.now()}`,
      name: 'Custom Architecture (Blank)',
      tag: 'Custom',
      description: 'Blank architecture canvas ready for custom blocks.',
      blocks: [],
      connections: [],
      repetitionGroups: []
    };
    const recomputed = recomputeSpecMetrics(emptySpec, hardware);
    onUpdateSpec(recomputed);
    setSelectedBlockId(null);
    setIsConfirmingClear(false);
  }, [spec, hardware, onUpdateSpec]);

  // Convert spec to React Flow graph
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    return convertSpecToFlowGraph(
      spec, 
      {
        onInspect: handleInspect,
        onDelete: handleDeleteBlock,
        onDuplicate: handleDuplicateBlock,
        onUpdateRepetitions: handleUpdateGroupRepetitions,
        onUpdateGroupName: handleUpdateGroupName,
        onUngroup: handleUngroup
      },
      { minEdgeHeight }
    );
  }, [
    spec, 
    minEdgeHeight,
    handleInspect, 
    handleDeleteBlock, 
    handleDuplicateBlock, 
    handleUpdateGroupRepetitions, 
    handleUpdateGroupName, 
    handleUngroup
  ]);

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  // Re-render the diagram layout and sync the entire computational analysis pipeline
  const handleReRender = useCallback(() => {
    setIsReRendering(true);

    // 1. Recompute all metrics, tensor dimensions, parameter counts, FLOPs and shape mismatches
    const recomputed = recomputeSpecMetrics(spec, hardware);
    onUpdateSpec({ ...recomputed });

    // 2. Generate clean auto-layout flow graph nodes and edges
    const freshGraph = convertSpecToFlowGraph(
      recomputed,
      {
        onInspect: handleInspect,
        onDelete: handleDeleteBlock,
        onDuplicate: handleDuplicateBlock,
        onUpdateRepetitions: handleUpdateGroupRepetitions,
        onUpdateGroupName: handleUpdateGroupName,
        onUngroup: handleUngroup
      },
      { minEdgeHeight }
    );

    setNodes(freshGraph.nodes);
    setEdges(freshGraph.edges);

    // 3. Smoothly center & fit view within the canvas viewport
    setTimeout(() => {
      fitView({ padding: 0.18, duration: 400 });
    }, 60);

    // 4. Notify parent to refresh computational analysis, roofline & topology
    onReRender?.();

    // 5. Reset re-rendering animation
    setTimeout(() => {
      setIsReRendering(false);
    }, 550);
  }, [
    spec,
    hardware,
    minEdgeHeight,
    onUpdateSpec,
    handleInspect,
    handleDeleteBlock,
    handleDuplicateBlock,
    handleUpdateGroupRepetitions,
    handleUpdateGroupName,
    handleUngroup,
    fitView,
    onReRender
  ]);

  const nodeTypes = useMemo(() => ({ 
    modularBlock: ModularBlockNode as any,
    repetitionGroup: RepetitionGroupNode as any
  }), []);
  const edgeTypes = useMemo(() => ({ tensorFlow: TensorFlowEdge as any }), []);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => {
        const nextNodes = applyNodeChanges(changes, nds);
        // Constraint: once grouped, a user cannot drag any of those blocks out of their group container box
        return nextNodes.map((node) => {
          if (node.parentId) {
            const parent = nextNodes.find((p) => p.id === node.parentId);
            if (parent && parent.style) {
              const pWidth = Number(parent.style.width) || 475;
              const pHeight = Number(parent.style.height) || 800;
              const blockW = 320;
              const isOp = (node.data as any)?.block?.category === 'operation' || 
                (node.data as any)?.block?.moduleType === 'op.Add' || 
                (node.data as any)?.block?.moduleType === 'op.ResidualOrigin';
              const blockH = isOp ? 74 : 138;
              const minX = 15;
              const maxX = Math.max(minX, pWidth - blockW - 15);
              const minY = 38; // keeps clearance below group floating header
              const maxY = Math.max(minY, pHeight - blockH - 20);

              const clampedX = Math.max(minX, Math.min(maxX, node.position.x));
              const clampedY = Math.max(minY, Math.min(maxY, node.position.y));

              if (clampedX !== node.position.x || clampedY !== node.position.y) {
                return {
                  ...node,
                  position: { x: clampedX, y: clampedY }
                };
              }
            }
          }
          return node;
        });
      });
    },
    []
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (!params.source || !params.target) return;
      const newConnId = `conn_${params.source}_${params.target}_${Date.now()}`;
      const srcBlock = spec.blocks.find(b => b.id === params.source);
      const isResidual = params.sourceHandle === 'residual-out' || params.targetHandle === 'residual-in';
      const newConn: BlockConnection = {
        id: newConnId,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle || undefined,
        targetHandle: params.targetHandle || undefined,
        isResidual,
        tensorShape: srcBlock?.outputShape || { dims: [spec.runtime.batchSize, spec.runtime.contextLength, 8192], label: isResidual ? 'Residual Stream (x)' : 'Tensor Link' }
      };

      const updatedConnections = [...spec.connections, newConn];
      const updated = { ...spec, connections: updatedConnections };
      const summary = computeModelArchitectureSummary(updated, DEFAULT_HARDWARE);
      onUpdateSpec({ ...updated, summary });
    },
    [spec, onUpdateSpec]
  );

  // Add block from Library or Custom Builder
  const handleAddBlock = useCallback((template: PredefinedBlockTemplate | CustomBlockDefinition) => {
    const id = `${template.category}_${Date.now().toString().slice(-5)}`;
    const prevBlock = spec.blocks[spec.blocks.length - 1];

    const rawBlock = {
      id,
      name: template.name,
      moduleType: template.moduleType as any,
      category: template.category,
      parameters: { ...template.defaultParameters },
      repeatLayers: 1,
      assignedGPU: 0,
      assignedNode: 0
    };

    const calculated = calculateBlockMetrics(
      rawBlock,
      prevBlock ? prevBlock.outputShape : null,
      spec.runtime,
      spec.precision,
      DEFAULT_HARDWARE
    );

    const newBlock: ModularBlock = {
      ...rawBlock,
      inputShape: calculated.inputShape,
      outputShape: calculated.outputShape,
      stats: calculated.stats
    };

    const updatedBlocks = [...spec.blocks, newBlock];
    let updatedConnections = [...spec.connections];

    // Automatically connect to the last block if appropriate
    if (prevBlock) {
      updatedConnections.push({
        id: `conn_${prevBlock.id}_${newBlock.id}`,
        source: prevBlock.id,
        target: newBlock.id,
        tensorShape: prevBlock.outputShape
      });
    }

    const updated = {
      ...spec,
      blocks: updatedBlocks,
      connections: updatedConnections
    };
    const summary = computeModelArchitectureSummary(updated, DEFAULT_HARDWARE);
    onUpdateSpec({ ...updated, summary });
  }, [spec, onUpdateSpec]);

  // Update block properties from Inspector
  const handleUpdateBlock = useCallback((updatedBlock: ModularBlock) => {
    const updatedBlocks = spec.blocks.map(b => b.id === updatedBlock.id ? updatedBlock : b);
    const updated = {
      ...spec,
      blocks: updatedBlocks
    };
    const recomputed = recomputeSpecMetrics(updated, DEFAULT_HARDWARE);
    onUpdateSpec(recomputed);
  }, [spec, onUpdateSpec]);

  // Inject a dimension mismatch test to demonstrate validation
  const handleToggleMismatchTest = () => {
    if (spec.blocks.length < 2) return;
    // Modify block 0 output dimension to something different
    const block0 = spec.blocks[0];
    const isAlreadyMismatched = spec.summary.hasMismatches;

    const modifiedParams = isAlreadyMismatched 
      ? { ...block0.parameters, embeddingDim: 16384, inChannels: 3, outChannels: 1280 }
      : { ...block0.parameters, embeddingDim: 512, outChannels: 32 };

    const recalc = calculateBlockMetrics(
      { ...block0, parameters: modifiedParams },
      null,
      spec.runtime,
      spec.precision,
      DEFAULT_HARDWARE
    );

    const updatedBlock0: ModularBlock = {
      ...block0,
      parameters: modifiedParams,
      outputShape: recalc.outputShape,
      stats: recalc.stats
    };

    const updatedBlocks = spec.blocks.map((b, i) => i === 0 ? updatedBlock0 : b);
    const updated = { ...spec, blocks: updatedBlocks };
    const summary = computeModelArchitectureSummary(updated, DEFAULT_HARDWARE);
    onUpdateSpec({ ...updated, summary });
  };

  return (
    <div className={`relative w-full h-full flex flex-col overflow-hidden transition-colors ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100/90 text-slate-800'
    }`}>
      {/* Left Floating Column: Architecture Model Title & Layout/Validation Tools */}
      <div className="absolute top-4 left-4 z-10 flex flex-col items-start gap-2.5 pointer-events-none">
        {/* Architecture Model Title & Summary Badge */}
        <div className={`flex items-center gap-2 p-1.5 px-3 rounded-xl border backdrop-blur-md shadow-lg pointer-events-auto text-xs font-mono transition-colors ${
          isDark ? 'bg-slate-900/90 border-slate-800 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800 shadow'
        }`}>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{spec.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
              isDark ? 'bg-sky-950 text-sky-400 border-sky-800' : 'bg-sky-50 text-sky-700 border-sky-200'
            }`}>
              {spec.blocks.length} Blocks
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
              isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}>
              {(spec.summary.totalParameters / 1e9).toFixed(1)}B Params
            </span>
          </div>
        </div>

        {/* Layout & Topology Vertical Tool Group */}
        <div className="flex flex-col items-start gap-1.5 pointer-events-auto">
          {/* Edge Height / Diagram Stretch Control */}
          <div 
            className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-md text-xs font-mono transition-colors ${
              isDark ? 'bg-slate-900/90 border-slate-800 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-700'
            }`}
            title="Stretch diagram vertically to increase edge clearance"
          >
            <div className="flex items-center gap-1.5 text-emerald-500">
              <MoveVertical className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="font-sans text-xs">Edge:</span>
              <span className="font-mono font-bold text-xs">{minEdgeHeight}px</span>
            </div>
            <input
              type="range"
              min="35"
              max="220"
              step="5"
              value={minEdgeHeight}
              onChange={(e) => onUpdateMinEdgeHeight?.(parseInt(e.target.value, 10))}
              className={`w-16 h-1.5 rounded-lg appearance-none cursor-pointer accent-emerald-500 ${
                isDark ? 'bg-slate-700' : 'bg-slate-200'
              }`}
            />
          </div>

          {/* Re-render Graph & Sync Profiler Button */}
          <button
            onClick={handleReRender}
            disabled={isReRendering}
            title="Re-render graph layout & update right-panel computational analysis"
            className={`w-full justify-start px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all shadow-md backdrop-blur-md ${
              isDark 
                ? 'bg-slate-900/90 border-slate-800 text-sky-400 hover:text-sky-300 hover:bg-slate-800' 
                : 'bg-white/95 border-slate-200 text-sky-600 hover:text-sky-700 hover:bg-sky-50'
            }`}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isReRendering ? 'animate-spin text-sky-500' : ''}`} />
            <span>{isReRendering ? 'Re-rendering...' : 'Re-render Graph'}</span>
          </button>

          {/* Validation Status Indicator */}
          <div className={`w-full flex items-center gap-1.5 px-3 py-1.5 rounded-xl border backdrop-blur-md text-xs font-mono shadow-md ${
            spec.summary.hasMismatches 
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' 
              : isDark ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            {spec.summary.hasMismatches ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 animate-pulse text-rose-500" />
                <span>{spec.summary.mismatchCount} Dim Mismatch</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Graph Validated</span>
              </>
            )}
          </div>

          {/* Test Mismatch Toggle */}
          <button
            onClick={handleToggleMismatchTest}
            title="Inject or resolve tensor dimension mismatch for simulation"
            className={`w-full justify-start px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-all shadow-md backdrop-blur-md ${
              spec.summary.hasMismatches
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent'
                : isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white' : 'bg-white/95 border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{spec.summary.hasMismatches ? 'Fix Mismatch' : 'Simulate Mismatch'}</span>
          </button>

          {/* Group Repetitive Layers Button */}
          <button
            onClick={handleOpenGroupModal}
            className={`w-full justify-start px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 shadow-md backdrop-blur-md transition-all ${
              (spec.repetitionGroups && spec.repetitionGroups.length > 0)
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20'
                : isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white' : 'bg-white/95 border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            title="Group repetitive layers into an editable N× box container"
          >
            <Boxes className="w-3.5 h-3.5 text-rose-500" />
            <span>Group Layers {(spec.repetitionGroups && spec.repetitionGroups.length > 0) ? `(${spec.repetitionGroups.length})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Right Floating Column: Creation & Action Tools */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5 pointer-events-none">
        {/* Add Modular Block Button */}
        <button
          onClick={() => setIsAddBlockOpen(true)}
          className="w-full justify-center px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg hover:shadow-sky-500/20 transition-all pointer-events-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Block</span>
        </button>

        {/* AI Assistant Chatbot Button */}
        <button
          onClick={() => setIsAssistantOpen(true)}
          className="w-full justify-center px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg hover:shadow-violet-500/20 transition-all pointer-events-auto"
        >
          <Bot className="w-4 h-4" />
          <span>Copilot Assistant</span>
        </button>

        {/* Model JSON Spec Button */}
        <button
          onClick={() => setIsJsonModalOpen(true)}
          className={`w-full justify-center px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all shadow-md backdrop-blur-md pointer-events-auto ${
            isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300 hover:text-white' : 'bg-white/95 border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>JSON Spec</span>
        </button>

        {/* Clear All Button */}
        {isConfirmingClear ? (
          <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/40 p-1 rounded-xl backdrop-blur-md shadow-lg pointer-events-auto animate-in fade-in duration-150">
            <button
              onClick={handleClearAll}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition-all"
              title="Confirm clearing all blocks from canvas"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Confirm Clear?</span>
            </button>
            <button
              onClick={() => setIsConfirmingClear(false)}
              className={`p-1 rounded-lg hover:bg-slate-700/40 text-xs transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsConfirmingClear(true)}
            disabled={spec.blocks.length === 0}
            className={`w-full justify-center px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 shadow-md backdrop-blur-md transition-all pointer-events-auto ${
              spec.blocks.length === 0
                ? 'opacity-40 cursor-not-allowed border-transparent text-slate-400'
                : isDark 
                ? 'bg-slate-900/90 border-slate-800 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 hover:border-rose-900' 
                : 'bg-white/95 border-slate-200 text-rose-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200'
            }`}
            title="Clear all blocks to start from scratch"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear all</span>
          </button>
        )}
      </div>

      {/* Main React Flow Canvas */}
      <div className="flex-1 w-full h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          onNodeClick={(_, node) => handleInspect(node.id)}
        >
          <Background 
            variant={BackgroundVariant.Dots} 
            gap={20} 
            size={1.5} 
            color={isDark ? '#334155' : '#cbd5e1'} 
          />
          <Controls className={`border rounded-lg overflow-hidden shadow-md ${
            isDark ? '!bg-slate-900/90 !border-slate-800 !fill-slate-300' : '!bg-white/95 !border-slate-200 !fill-slate-700'
          }`} />
          <FlowFitter specId={spec.id} nodeCount={nodes.length} />
          <MiniMap 
            nodeStrokeWidth={3}
            nodeColor={(node: any) => {
              const b = node.data?.block as ModularBlock;
              if (!b) return '#94a3b8';
              switch (b.category) {
                case 'attention': return '#f59e0b';
                case 'ffn': return '#8b5cf6';
                case 'moe': return '#a855f7';
                case 'conv': return '#10b981';
                case 'embedding': return '#3b82f6';
                case 'norm': return '#06b6d4';
                case 'head': return '#f43f5e';
                case 'operation': return '#10b981';
                default: return '#64748b';
              }
            }}
            className={`border rounded-xl shadow-lg m-4 ${
              isDark ? '!bg-slate-900/90 !border-slate-800' : '!bg-white/95 !border-slate-200'
            }`}
          />
        </ReactFlow>

        {/* Empty State Overlay when all blocks are cleared */}
        {spec.blocks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 p-4">
            <div className={`p-8 rounded-2xl border backdrop-blur-md max-w-sm text-center shadow-2xl pointer-events-auto transition-all ${
              isDark ? 'bg-slate-900/90 border-slate-800 text-slate-200' : 'bg-white/95 border-slate-200 text-slate-800 shadow-xl'
            }`}>
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold mb-1.5">Canvas is Cleared</h3>
              <p className={`text-xs mb-5 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Your canvas is blank and ready. Start building from scratch by adding blocks from the library or designing custom operations.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setIsAddBlockOpen(true)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Block</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Block Drawer (Catalog & Custom Form) */}
      <AddBlockDrawer
        isOpen={isAddBlockOpen}
        onClose={() => setIsAddBlockOpen(false)}
        onAddBlock={handleAddBlock}
        customBlocks={customBlocks}
        onSaveCustomBlock={onSaveCustomBlock}
      />

      {/* Block Hyperparameter Inspector Modal */}
      <BlockInspectorModal
        block={inspectedBlock}
        isOpen={Boolean(inspectedBlock)}
        onClose={() => setSelectedBlockId(null)}
        onUpdateBlock={handleUpdateBlock}
        onDeleteBlock={handleDeleteBlock}
        onDuplicateBlock={handleDuplicateBlock}
        runtime={spec.runtime}
        precision={spec.precision}
        hardware={DEFAULT_HARDWARE}
        groupInfo={inspectedBlockGroup}
        onUpdateGroupRepetitions={handleUpdateGroupRepetitions}
      />

      {/* Model JSON Spec Modal */}
      <ModelJsonModal
        spec={spec}
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        onApplyJsonSpec={(updated) => {
          const recomputed = recomputeSpecMetrics(updated, DEFAULT_HARDWARE);
          onUpdateSpec(recomputed);
        }}
      />

      {/* Copilot Assistant Chat Drawer */}
      <AssistantChatDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        currentSpec={spec}
        onApplySpec={(updated) => {
          const recomputed = recomputeSpecMetrics(updated, DEFAULT_HARDWARE);
          onUpdateSpec(recomputed);
        }}
      />

      {/* Group Repetitive Layers Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className={`w-full max-w-xl max-h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden transition-all ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between shrink-0 ${
              isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl border ${
                  isDark ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-600'
                }`}>
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Group Repetitive Connected Layers</h3>
                  <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Enclose repeating blocks into an editable <span className="font-mono text-rose-500 font-bold">N ×</span> container box
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsGroupModalOpen(false)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-200 text-slate-600'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4">
              {/* Existing Groups (if any) */}
              {spec.repetitionGroups && spec.repetitionGroups.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Active Layer Groups ({spec.repetitionGroups.length})
                  </h4>
                  <div className="space-y-2">
                    {spec.repetitionGroups.map(grp => (
                      <div 
                        key={grp.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                          isDark ? 'bg-slate-950/60 border-rose-500/30' : 'bg-rose-50/40 border-rose-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500 text-white">
                            {grp.repetitions} ×
                          </span>
                          <div>
                            <div className="text-xs font-semibold">{grp.name}</div>
                            <div className="text-[11px] text-slate-400">
                              Contains {grp.blockIds.length} blocks: {grp.blockIds.join(', ')}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleUngroup(grp.id)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                            isDark 
                              ? 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-rose-400' 
                              : 'border-slate-300 text-slate-600 hover:bg-slate-100 hover:text-rose-600'
                          }`}
                        >
                          Ungroup
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Create New Group Section */}
              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Create New Group Container
                </h4>

                {/* Group Name & Repetition Multiplier Inputs */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-medium block mb-1">Container Label</label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g. Transformer Layer Block"
                      className={`w-full rounded-lg px-2.5 py-1.5 text-xs border focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                        isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-800'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium block mb-1">Repetitions (N ×)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="1024"
                        value={newGroupReps}
                        onChange={(e) => setNewGroupReps(Math.max(1, parseInt(e.target.value) || 1))}
                        className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold border focus:outline-none focus:ring-1 focus:ring-rose-500 ${
                          isDark ? 'bg-slate-800 border-slate-700 text-rose-400' : 'bg-slate-50 border-slate-300 text-rose-700'
                        }`}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-rose-500">×</span>
                    </div>
                  </div>
                </div>

                {/* Quick Multiplier Presets */}
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className={`text-[11px] mr-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Presets:</span>
                  {[32, 61, 80, 126, 128].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNewGroupReps(preset)}
                      className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                        newGroupReps === preset
                          ? 'bg-rose-500 text-white border-rose-500 font-bold'
                          : isDark
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {preset}×
                    </button>
                  ))}
                </div>

                {/* Select Member Blocks */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium">Select Blocks to Enclose:</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedGroupBlockIds(spec.blocks.map(b => b.id))}
                        className="text-[11px] text-sky-500 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-500 text-[11px]">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedGroupBlockIds([])}
                        className="text-[11px] text-slate-400 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className={`max-h-48 overflow-y-auto rounded-xl border divide-y ${
                    isDark ? 'bg-slate-950/40 border-slate-800 divide-slate-800/60' : 'bg-slate-50 border-slate-200 divide-slate-200'
                  }`}>
                    {spec.blocks.map(b => {
                      const isSelected = selectedGroupBlockIds.includes(b.id);
                      return (
                        <div
                          key={b.id}
                          onClick={() => {
                            setSelectedGroupBlockIds(prev => 
                              isSelected ? prev.filter(id => id !== b.id) : [...prev, b.id]
                            );
                          }}
                          className={`p-2 px-3 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected 
                              ? isDark ? 'bg-rose-500/10' : 'bg-rose-50' 
                              : isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-rose-500 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            <div>
                              <div className="text-xs font-semibold">{b.name}</div>
                              <div className="text-[10px] font-mono text-slate-400">{b.id}</div>
                            </div>
                          </div>

                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-200'
                          }`}>
                            {b.moduleType}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`p-4 border-t flex items-center justify-between shrink-0 ${
              isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-slate-50'
            }`}>
              <div className="text-xs text-slate-400">
                {selectedGroupBlockIds.length} blocks selected for <span className="font-mono text-rose-500 font-bold">{newGroupReps}×</span> repetition
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium ${
                    isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedGroupBlockIds.length === 0}
                  onClick={handleCreateGroup}
                  className={`px-4 py-1.5 rounded-xl text-xs font-medium text-white transition-all shadow-md ${
                    selectedGroupBlockIds.length === 0
                      ? 'bg-slate-600 opacity-50 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-500 cursor-pointer'
                  }`}
                >
                  Create {newGroupReps}× Group Container
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ArchitectureCanvas: React.FC<ArchitectureCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ArchitectureCanvasInner {...props} />
    </ReactFlowProvider>
  );
};
