import React, { memo } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';
import { useTheme } from '../../context/ThemeContext';

export const TensorFlowEdge = memo((props: any) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected
  } = props;
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const isResidual = data?.isResidual || (sourcePosition === 'left' && targetPosition === 'left');
  const isMismatch = data?.isMismatch;
  const isCut = data?.isCut;
  const tensorLabel = data?.label || '';
  const mismatchDetail = data?.mismatchDetail;

  // Minimal height guaranteed to be at least the height of the edge's annotation text badge (~32px)
  const MIN_ANNOTATION_TEXT_HEIGHT = 32;

  let edgePath = '';
  let labelX = 0;
  let labelY = 0;

  if (isResidual) {
    // Route around intermediate nodes through the left corridor
    const dy = targetY - sourceY;
    const absDy = Math.abs(dy);
    const isForward = targetY >= sourceY;

    // Guaranteed minimum visual span: at least the height of the edge's annotation text
    const effectiveSpan = Math.max(absDy, MIN_ANNOTATION_TEXT_HEIGHT);
    const arcClearance = Math.max(80, Math.min(130, 75 + (effectiveSpan - 60) * 0.25));
    const bendX = Math.min(sourceX, targetX) - arcClearance;

    // Proportional control point offsets that never invert or knot
    const cpOffsetY = Math.max(16, Math.min(45, effectiveSpan * 0.35));

    if (absDy < MIN_ANNOTATION_TEXT_HEIGHT) {
      // If source and target handles are too close, bow the curve outward with minimum height
      const bottomArcY = sourceY + MIN_ANNOTATION_TEXT_HEIGHT;
      edgePath = `M ${sourceX} ${sourceY} C ${bendX} ${sourceY + cpOffsetY}, ${bendX} ${bottomArcY}, ${targetX} ${targetY}`;
      labelX = bendX + 20;
      labelY = (sourceY + bottomArcY) / 2;
    } else if (isForward) {
      edgePath = `M ${sourceX} ${sourceY} C ${bendX} ${sourceY + cpOffsetY}, ${bendX} ${targetY - cpOffsetY}, ${targetX} ${targetY}`;
      labelX = bendX + 20;
      labelY = (sourceY + targetY) / 2;
    } else {
      edgePath = `M ${sourceX} ${sourceY} C ${bendX} ${sourceY - cpOffsetY}, ${bendX} ${targetY + cpOffsetY}, ${targetX} ${targetY}`;
      labelX = bendX + 20;
      labelY = (sourceY + targetY) / 2;
    }
  } else {
    const [stepPath, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 20
    });
    edgePath = stepPath;
    labelX = lx;
    labelY = ly;
  }

  let strokeColor = isDark ? '#38bdf8' : '#0284c7'; // sky-400 or sky-600
  let strokeWidth = 2;
  let strokeDasharray: string | undefined = undefined;

  if (isMismatch) {
    strokeColor = '#f43f5e'; // rose-500
    strokeWidth = 3;
  } else if (isCut) {
    strokeColor = isDark ? '#fb7185' : '#e11d48'; // rose-400 / rose-600
    strokeDasharray = '6,4';
    strokeWidth = 2.5;
  } else if (isResidual) {
    strokeColor = isDark ? '#10b981' : '#059669'; // emerald-500 / emerald-600
    strokeDasharray = '6,3';
    strokeWidth = 2.5;
  } else if (selected) {
    strokeColor = isDark ? '#0ea5e9' : '#0369a1';
    strokeWidth = 3;
  }

  const safeId = id ? String(id).replace(/[^a-zA-Z0-9_-]/g, '_') : 'edge';
  const markerId = `arrow-${safeId}`;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="6.5"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth={10}
          markerHeight={10}
          orient="auto"
        >
          <path
            d="M 1.5 2 L 7.5 5 L 1.5 8 Z"
            fill={strokeColor}
            stroke={strokeColor}
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={`url(#${markerId})`}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray,
          filter: isMismatch 
            ? 'drop-shadow(0 0 6px rgba(244, 63, 94, 0.4))' 
            : isResidual
            ? 'drop-shadow(0 0 5px rgba(16, 185, 129, 0.35))'
            : undefined,
          transition: 'stroke 0.2s, stroke-width 0.2s'
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all'
          }}
          className="nodrag nopan"
        >
          {isMismatch ? (
            <div className={`px-2.5 py-1 rounded-md border text-[10px] font-mono shadow-lg flex items-center gap-1.5 backdrop-blur-md ${
              isDark 
                ? 'bg-rose-950/90 border-rose-600 text-rose-200' 
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
              <span>Mismatch: {mismatchDetail}</span>
            </div>
          ) : isCut ? (
            <div className={`px-2.5 py-1 rounded-md border border-dashed text-[10px] font-mono shadow-md backdrop-blur-md flex items-center gap-1 ${
              isDark 
                ? 'bg-slate-900/90 border-rose-500/80 text-rose-300' 
                : 'bg-white border-rose-400 text-rose-700 shadow-sm'
            }`}>
              <span>All-Reduce Link</span>
            </div>
          ) : isResidual ? (
            <div className={`px-2 py-0.5 rounded-full text-[9px] font-mono shadow-md border flex items-center gap-1 backdrop-blur-md transition-colors ${
              isDark 
                ? 'bg-slate-900/95 border-emerald-500/60 text-emerald-300 shadow-emerald-950/50' 
                : 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
              <span>{tensorLabel || 'Residual Stream (x)'}</span>
            </div>
          ) : tensorLabel ? (
            <div className={`px-2 py-0.5 rounded text-[10px] font-mono shadow-sm backdrop-blur-sm border transition-colors ${
              isDark 
                ? 'bg-slate-900/90 border-slate-700 text-slate-200' 
                : 'bg-white border-slate-300 text-slate-700 shadow'
            }`}>
              {tensorLabel}
            </div>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

TensorFlowEdge.displayName = 'TensorFlowEdge';
