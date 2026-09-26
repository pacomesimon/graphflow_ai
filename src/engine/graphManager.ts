import { Node, Edge } from '@xyflow/react';
import { ModelArchitectureSpec, ModularBlockNodeData, RepetitionGroupNodeData, RepetitionGroup } from '../types';

export interface FlowGraphOptions {
  minEdgeHeight?: number;
}

export function convertSpecToFlowGraph(
  spec: ModelArchitectureSpec,
  callbacks?: {
    onInspect?: (blockId: string) => void;
    onDelete?: (blockId: string) => void;
    onDuplicate?: (blockId: string) => void;
    onUpdateRepetitions?: (groupId: string, newReps: number) => void;
    onUpdateGroupName?: (groupId: string, newName: string) => void;
    onUngroup?: (groupId: string) => void;
  },
  options?: FlowGraphOptions
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Minimum height guaranteed to be at least the height of the edge's annotation text badge (~32px)
  const MIN_ANNOTATION_TEXT_HEIGHT = 32;
  const userMinEdgeHeight = options?.minEdgeHeight ?? 95;
  // REVIEWER: MIN_ANNOTATION_TEXT_HEIGHT is also hard-coded as 32 inside CustomEdges.tsx.
  // Extract this constant to a shared location (e.g. a constants.ts) to keep them in sync.
  const minEdgeHeight = Math.max(MIN_ANNOTATION_TEXT_HEIGHT, userMinEdgeHeight);

  // Layout positions: Vertically spaced blocks with horizontal offsets for residual channel
  const startX = 320;
  const startY = 60;
  const blockWidth = 320;

  // 1. Calculate dynamic sequential positions for every block based on block height and minEdgeHeight
  let currentY = startY;
  const blockPositions = new Map<string, { x: number; y: number; width: number; height: number }>();

  spec.blocks.forEach((block) => {
    // REVIEWER: The `isOp` predicate is duplicated verbatim in ArchitectureCanvas.tsx
    // (onNodesChange clamping logic). Centralise it in a helper, e.g. `isOperationBlock(block)`.
    const isOp = block.category === 'operation' || block.moduleType === 'op.Add' || block.moduleType === 'op.ResidualOrigin';
    // REVIEWER: Block heights (74px / 138px) are magic numbers that must match the actual
    // rendered DOM heights. If a node's Tailwind classes cause a different height, the bounding
    // boxes will be incorrect. Consider reading heights from a shared constant or deriving from
    // the node component itself.
    const height = isOp ? 74 : 138;
    blockPositions.set(block.id, { x: startX, y: currentY, width: blockWidth, height });
    // Vertical edge clearance between successive blocks governed by minEdgeHeight
    currentY += height + minEdgeHeight;
  });

  // Build lookup of blockId -> RepetitionGroup
  const blockToGroup = new Map<string, RepetitionGroup>();
  if (spec.repetitionGroups) {
    for (const grp of spec.repetitionGroups) {
      for (const bId of grp.blockIds) {
        blockToGroup.set(bId, grp);
      }
    }
  }

  // 2. Compute repetition group bounding boxes and create group nodes first (so they render behind child blocks)
  const groupBoxes = new Map<string, { boxX: number; minY: number; boxWidth: number; boxHeight: number }>();

  if (spec.repetitionGroups && spec.repetitionGroups.length > 0) {
    spec.repetitionGroups.forEach(grp => {
      const memberPos = grp.blockIds
        .map(id => blockPositions.get(id))
        .filter(Boolean) as { x: number; y: number; width: number; height: number }[];

      const memberBlocks = spec.blocks.filter(b => grp.blockIds.includes(b.id));

      if (memberPos.length > 0) {
        // Left padding of 110px accommodates the residual skip curve loop comfortably inside the container
        const paddingLeft = 110;
        const paddingRight = 45;
        const paddingTop = 48;
        const paddingBottom = 48;

        const minY = Math.min(...memberPos.map(p => p.y)) - paddingTop;
        const maxY = Math.max(...memberPos.map(p => p.y + p.height)) + paddingBottom;

        const boxX = startX - paddingLeft;
        const boxWidth = blockWidth + paddingLeft + paddingRight;
        const boxHeight = maxY - minY;

        groupBoxes.set(grp.id, { boxX, minY, boxWidth, boxHeight });

        const totalGroupParams = memberBlocks.reduce((acc, b) => acc + (b.stats?.params || 0), 0);
        const perLayerParams = Math.round(totalGroupParams / Math.max(1, grp.repetitions));
        const totalGroupFlops = memberBlocks.reduce((acc, b) => acc + (b.stats?.flopsPerToken || 0), 0);

        const groupNodeData: RepetitionGroupNodeData = {
          group: grp,
          memberBlocks,
          totalGroupParams,
          perLayerParams,
          totalGroupFlops,
          onUpdateRepetitions: (newReps: number) => callbacks?.onUpdateRepetitions?.(grp.id, newReps),
          onUpdateGroupName: (newName: string) => callbacks?.onUpdateGroupName?.(grp.id, newName),
          onUngroup: () => callbacks?.onUngroup?.(grp.id)
        };

        nodes.push({
          id: `group_${grp.id}`,
          type: 'repetitionGroup',
          position: { x: boxX, y: minY },
          style: {
            width: boxWidth,
            height: boxHeight,
            zIndex: 0
          },
          draggable: true,
          selectable: true,
          data: groupNodeData
        });
      }
    });
  }

  // 3. Create individual modular block nodes
  spec.blocks.forEach((block) => {
    const grp = blockToGroup.get(block.id);
    const pos = blockPositions.get(block.id) || { x: startX, y: startY, width: blockWidth, height: 135 };
    const grpBox = grp ? groupBoxes.get(grp.id) : undefined;

    const nodeData: ModularBlockNodeData = {
      block,
      isInRepetitionGroup: Boolean(grp),
      repetitionGroupId: grp?.id,
      repetitionMultiplier: grp?.repetitions,
      hasDimensionMismatch: false,
      onInspect: callbacks?.onInspect,
      onDelete: callbacks?.onDelete,
      onDuplicate: callbacks?.onDuplicate
    };

    if (grp && grpBox) {
      // Child node position is relative to parent group node
      // Clamped inside the group boundary via extent: 'parent'
      const relativeX = pos.x - grpBox.boxX;
      const relativeY = pos.y - grpBox.minY;

      nodes.push({
        id: block.id,
        type: 'modularBlock',
        position: { x: relativeX, y: relativeY },
        parentId: `group_${grp.id}`,
        extent: 'parent',
        draggable: true,
        data: nodeData
      });
    } else {
      nodes.push({
        id: block.id,
        type: 'modularBlock',
        position: { x: pos.x, y: pos.y },
        draggable: true,
        data: nodeData
      });
    }
  });

  // 4. Convert connections to custom tensorFlow edges
  spec.connections.forEach((conn) => {
    const isResidual = Boolean(conn.isResidual);

    edges.push({
      id: conn.id,
      source: conn.source,
      target: conn.target,
      sourceHandle: isResidual ? (conn.sourceHandle || 'residual-out') : (conn.sourceHandle || 'out'),
      targetHandle: isResidual ? (conn.targetHandle || 'residual-in') : (conn.targetHandle || 'in'),
      type: 'tensorFlow',
      data: {
        label: conn.tensorShape?.label || (isResidual ? 'Residual Stream (x)' : 'Tensor Link'),
        isCutBoundary: false,
        isResidual,
        isMismatch: conn.isMismatch,
        mismatchDetail: conn.mismatchDetail,
        minEdgeHeight
      }
    });

    // If edge is a mismatch, flag target node
    // REVIEWER: This mutates the `data` object of a node that was already pushed into the
    // `nodes` array. React Flow may not detect the mutation because the object reference
    // hasn't changed. Prefer building the nodeData with `hasDimensionMismatch` already set
    // during step 3, or create a new object reference here.
    if (conn.isMismatch) {
      const targetNode = nodes.find(n => n.id === conn.target);
      if (targetNode) {
        (targetNode.data as ModularBlockNodeData).hasDimensionMismatch = true;
        (targetNode.data as ModularBlockNodeData).mismatchDetail = conn.mismatchDetail;
      }
    }
  });

  return { nodes, edges };
}
