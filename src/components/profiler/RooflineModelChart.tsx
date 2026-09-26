import React, { useState, useMemo } from 'react';
import { HardwareSpec, RooflinePoint, PrecisionType } from '../../types';
import { HARDWARE_DATABASE } from '../../engine/hardwareSpecs';
import { Activity, Info } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface RooflineModelChartProps {
  points: RooflinePoint[];
  ridgePoint: number;
  peakCompute: number;
  memoryBandwidth: number;
  hardware: HardwareSpec;
  precision: PrecisionType;
  onSelectHardware?: (hw: HardwareSpec) => void;
}

export const RooflineModelChart: React.FC<RooflineModelChartProps> = ({
  points,
  ridgePoint,
  peakCompute,
  memoryBandwidth,
  hardware,
  precision,
  onSelectHardware
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [hoveredPoint, setHoveredPoint] = useState<RooflinePoint | null>(null);
  const [compareHwId, setCompareHwId] = useState<string>('nvidia-b200');

  const compareHw = HARDWARE_DATABASE.find(h => h.id === compareHwId) || HARDWARE_DATABASE[0];
  const comparePeak = precision === 'INT8' || precision === 'FP4' ? compareHw.peakTFlopsFP8 : compareHw.peakTFlopsFP16;
  const compareRidge = comparePeak / compareHw.memoryBandwidthTBps;

  // Chart Dimensions & Log10 Mapping
  const width = 560;
  const height = 330;
  const padding = { top: 34, right: 28, bottom: 45, left: 58 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const minLogX = -1;
  const maxLogX = 4;
  const minLogY = -0.6; // ~0.25 TFLOPs to prevent flattening of slope at bottom-left
  const maxLogY = 3.65; // ~4500 TFLOPs to fit high-compute chips comfortably

  const scaleX = (val: number) => {
    const logVal = Math.log10(Math.max(0.1, val));
    const clamped = Math.max(minLogX, Math.min(maxLogX, logVal));
    return padding.left + ((clamped - minLogX) / (maxLogX - minLogX)) * plotWidth;
  };

  const scaleY = (val: number) => {
    const logVal = Math.log10(Math.max(0.25, val));
    const clamped = Math.max(minLogY, Math.min(maxLogY, logVal));
    return height - padding.bottom - ((clamped - minLogY) / (maxLogY - minLogY)) * plotHeight;
  };

  // Primary Hardware Roofline points
  const pStartPrimary = { x: scaleX(0.1), y: scaleY(0.1 * memoryBandwidth) };
  const pRidgePrimary = { x: scaleX(ridgePoint), y: scaleY(peakCompute) };
  const pEndPrimary = { x: scaleX(10000), y: scaleY(peakCompute) };

  // Comparison Hardware Roofline points
  const pStartCompare = { x: scaleX(0.1), y: scaleY(0.1 * compareHw.memoryBandwidthTBps) };
  const pRidgeCompare = { x: scaleX(compareRidge), y: scaleY(comparePeak) };
  const pEndCompare = { x: scaleX(10000), y: scaleY(comparePeak) };

  const xTicks = [0.1, 1, 10, 100, 1000, 10000];
  const yTicks = [1, 10, 100, 1000, 3000];

  // Slope geometry for primary memory bandwidth label
  const dxPrimary = pRidgePrimary.x - pStartPrimary.x;
  const dyPrimary = pRidgePrimary.y - pStartPrimary.y; // Negative because SVG Y is downward
  const slopeAnglePrimary = (Math.atan2(dyPrimary, dxPrimary) * 180) / Math.PI;

  // Midpoint along the slope (30% from origin, well clear of axis and dots)
  const slopeMidX = pStartPrimary.x + dxPrimary * 0.28;
  const slopeMidY = pStartPrimary.y + dyPrimary * 0.28;
  const slopeLen = Math.hypot(dxPrimary, dyPrimary) || 1;
  // Perpendicular normal vector pointing above the slope
  const normX = dyPrimary / slopeLen;
  const normY = -dxPrimary / slopeLen;
  const hbmLabelX = slopeMidX + normX * 13;
  const hbmLabelY = slopeMidY - normY * 13;

  // Helper for concise, clean badge labels
  const getShortName = (pt: RooflinePoint) => {
    if (pt.id === 'norm_layer') return 'RMSNorm';
    if (pt.id === 'softmax') return 'Softmax';
    if (pt.id === 'attn_scores') return 'FlashAttn';
    if (pt.id === 'qkv_proj') return 'QKV Proj';
    if (pt.id === 'mlp_swiglu') return 'MLP SwiGLU';
    if (pt.id === 'lm_head') return 'LM Head';
    return pt.label.split(' ')[0];
  };

  // Compute collision-free layout coordinates for each point's label
  const positionedPoints = useMemo(() => {
    const memPoints = points.filter(p => p.memoryBound).sort((a, b) => a.arithmeticIntensity - b.arithmeticIntensity);
    const compPoints = points.filter(p => !p.memoryBound).sort((a, b) => a.arithmeticIntensity - b.arithmeticIntensity);

    const result: Array<{
      pt: RooflinePoint;
      cx: number;
      cy: number;
      labelX: number;
      labelY: number;
      labelWidth: number;
      labelHeight: number;
      shortName: string;
      lineFrom: { x: number; y: number };
      lineTo: { x: number; y: number };
    }> = [];

    // Position memory-bound points along the slope
    memPoints.forEach((pt, idx) => {
      const cx = scaleX(pt.arithmeticIntensity);
      const cy = scaleY(pt.attainableTFlops);
      const shortName = getShortName(pt);
      const labelWidth = shortName.length * 6.2 + 10;
      const labelHeight = 15;

      // Even indices sit above-left, odd sit below-right
      const isAbove = idx % 2 === 0;
      const labelX = isAbove ? cx - labelWidth / 2 - 4 : cx + labelWidth / 2 + 6;
      const labelY = isAbove ? cy - 14 : cy + 15;

      result.push({
        pt,
        cx,
        cy,
        labelX,
        labelY,
        labelWidth,
        labelHeight,
        shortName,
        lineFrom: { x: cx, y: isAbove ? cy - 4 : cy + 4 },
        lineTo: { x: labelX, y: isAbove ? labelY + 6 : labelY - 6 }
      });
    });

    // Position compute-bound points along the horizontal plateau
    compPoints.forEach((pt, idx) => {
      const cx = scaleX(pt.arithmeticIntensity);
      const cy = scaleY(pt.attainableTFlops);
      const shortName = getShortName(pt);
      const labelWidth = shortName.length * 6.2 + 10;
      const labelHeight = 15;

      // Stagger labels: even indices below the plateau line, odd indices above the line
      const isBelow = idx % 2 === 0;
      const labelX = cx;
      const labelY = isBelow ? cy + 18 : cy - 16;

      result.push({
        pt,
        cx,
        cy,
        labelX,
        labelY,
        labelWidth,
        labelHeight,
        shortName,
        lineFrom: { x: cx, y: isBelow ? cy + 4 : cy - 4 },
        lineTo: { x: cx, y: isBelow ? labelY - 8 : labelY + 8 }
      });
    });

    return result;
  }, [points, scaleX, scaleY]);

  return (
    <div className={`rounded-xl p-4 border transition-all flex flex-col ${
      isDark 
        ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-xl' 
        : 'bg-white border-slate-200 text-slate-800 shadow-md'
    }`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${
            isDark ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-sky-50 border-sky-200 text-sky-600'
          }`}>
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className={`text-xs font-semibold tracking-wide ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
              Dynamic Operational Roofline Model
            </h3>
            <p className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Log-Log Arithmetic Intensity (FLOPs/Byte) vs Attainable Performance (TFLOPs/sec)
            </p>
          </div>
        </div>

        {/* Comparison hardware dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <span className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Compare:</span>
          <select
            value={compareHwId}
            onChange={(e) => setCompareHwId(e.target.value)}
            className={`border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer ${
              isDark 
                ? 'bg-slate-800 border-slate-700 text-slate-200' 
                : 'bg-slate-100 border-slate-300 text-slate-800'
            }`}
          >
            {HARDWARE_DATABASE.map(hw => (
              <option key={hw.id} value={hw.id}>
                {hw.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SVG Log-Log Plot */}
      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[340px] select-none"
        >
          {/* Background Grid */}
          {xTicks.map((tick) => {
            const x = scaleX(tick);
            return (
              <g key={`xtick-${tick}`}>
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom}
                  stroke={isDark ? '#334155' : '#e2e8f0'}
                  strokeDasharray="2,3"
                  strokeWidth={0.7}
                />
                <text
                  x={x}
                  y={height - padding.bottom + 16}
                  fill={isDark ? '#94a3b8' : '#64748b'}
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {tick >= 1000 ? `${tick / 1000}k` : tick}
                </text>
              </g>
            );
          })}

          {yTicks.map((tick) => {
            const y = scaleY(tick);
            return (
              <g key={`ytick-${tick}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={isDark ? '#334155' : '#e2e8f0'}
                  strokeDasharray="2,3"
                  strokeWidth={0.7}
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  fill={isDark ? '#94a3b8' : '#64748b'}
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Axes Lines */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke={isDark ? '#64748b' : '#cbd5e1'}
            strokeWidth={1.5}
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke={isDark ? '#64748b' : '#cbd5e1'}
            strokeWidth={1.5}
          />

          {/* Axis Labels */}
          <text
            x={width / 2 + 10}
            y={height - 8}
            fill={isDark ? '#cbd5e1' : '#475569'}
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
          >
            Operational Intensity (FLOPs / Byte) →
          </text>
          <text
            x={-height / 2 + 10}
            y={16}
            fill={isDark ? '#cbd5e1' : '#475569'}
            fontSize="10"
            fontFamily="monospace"
            textAnchor="middle"
            transform="rotate(-90)"
          >
            Attainable TFLOPs/s →
          </text>

          {/* Comparison Roofline (Dashed Violet) */}
          {compareHw.id !== hardware.id && (
            <g opacity={0.85}>
              <polyline
                points={`${pStartCompare.x},${pStartCompare.y} ${pRidgeCompare.x},${pRidgeCompare.y} ${pEndCompare.x},${pEndCompare.y}`}
                fill="none"
                stroke="#a855f7"
                strokeWidth={1.5}
                strokeDasharray="4,4"
              />
              {/* Comparison Hardware Badge with protective background */}
              <g>
                <rect
                  x={Math.max(padding.left + 4, Math.min(width - padding.right - 216, pRidgeCompare.x - 20))}
                  y={Math.max(padding.top - 22, pRidgeCompare.y - 18)}
                  width={212}
                  height={15}
                  rx={3}
                  fill={isDark ? '#1a0e2e' : '#faf5ff'}
                  stroke="#a855f7"
                  strokeWidth={0.8}
                />
                <text
                  x={Math.max(padding.left + 4, Math.min(width - padding.right - 216, pRidgeCompare.x - 20)) + 106}
                  y={Math.max(padding.top - 22, pRidgeCompare.y - 18) + 11}
                  fill="#9333ea"
                  fontSize="8"
                  fontFamily="monospace"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {compareHw.vendor} {comparePeak} TFLOPs ({compareHw.memoryBandwidthTBps} TB/s)
                </text>
              </g>
            </g>
          )}

          {/* Vertical Ridge Point Line */}
          <line
            x1={pRidgePrimary.x}
            y1={pRidgePrimary.y}
            x2={pRidgePrimary.x}
            y2={height - padding.bottom}
            stroke="#0ea5e9"
            strokeDasharray="3,3"
            strokeWidth={1.2}
            opacity={0.8}
          />
          {/* Ridge Point Badge */}
          <g>
            <rect
              x={pRidgePrimary.x - 56}
              y={padding.top - 22}
              width={112}
              height={16}
              rx={3}
              fill={isDark ? '#08172e' : '#f0f9ff'}
              stroke="#0284c7"
              strokeWidth={1}
            />
            <text
              x={pRidgePrimary.x}
              y={padding.top - 10}
              fill="#0284c7"
              fontSize="8.5"
              fontFamily="monospace"
              textAnchor="middle"
              fontWeight="bold"
            >
              Ridge: {ridgePoint.toFixed(1)} FLOPs/B
            </text>
          </g>

          {/* Primary Hardware Roofline (Solid Sky Blue) */}
          <polyline
            points={`${pStartPrimary.x},${pStartPrimary.y} ${pRidgePrimary.x},${pRidgePrimary.y} ${pEndPrimary.x},${pEndPrimary.y}`}
            fill="none"
            stroke="#0284c7"
            strokeWidth={2.5}
          />

          {/* Peak Compute Ceiling Badge (Positioned clearly above the plateau line) */}
          <g>
            <rect
              x={width - padding.right - 216}
              y={Math.max(padding.top + 2, pEndPrimary.y - 22)}
              width={216}
              height={17}
              rx={3.5}
              fill={isDark ? '#08172e' : '#f0f9ff'}
              stroke="#0284c7"
              strokeWidth={1.2}
            />
            <text
              x={width - padding.right - 108}
              y={Math.max(padding.top + 2, pEndPrimary.y - 22) + 12}
              fill="#0284c7"
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              Peak {peakCompute} TFLOPs ({hardware.name})
            </text>
          </g>

          {/* Memory Bandwidth Sloped Bound Label (Aligned to slope with protective pill) */}
          <g transform={`rotate(${slopeAnglePrimary}, ${hbmLabelX}, ${hbmLabelY})`}>
            <rect
              x={hbmLabelX - 42}
              y={hbmLabelY - 8}
              width={84}
              height={16}
              rx={3}
              fill={isDark ? '#08172e' : '#f0f9ff'}
              stroke="#0284c7"
              strokeWidth={1}
            />
            <text
              x={hbmLabelX}
              y={hbmLabelY + 3.5}
              fill="#0284c7"
              fontSize="8.5"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              HBM: {memoryBandwidth} TB/s
            </text>
          </g>

          {/* Operational Points Plotted on Roofline with Non-Overlapping Badges */}
          {positionedPoints.map(({ pt, cx, cy, labelX, labelY, labelWidth, labelHeight, shortName, lineFrom, lineTo }) => {
            const isHovered = hoveredPoint?.id === pt.id;
            const accentColor = pt.memoryBound ? '#f59e0b' : '#10b981';

            return (
              <g
                key={pt.id}
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                {/* Connecting Leader Line between Dot and Badge */}
                <line
                  x1={lineFrom.x}
                  y1={lineFrom.y}
                  x2={lineTo.x}
                  y2={lineTo.y}
                  stroke={accentColor}
                  strokeWidth={0.9}
                  strokeDasharray="1.5,1.5"
                  opacity={0.8}
                />

                {/* Glow ring when hovered */}
                {isHovered && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={9}
                    fill="none"
                    stroke={accentColor}
                    strokeWidth={2}
                    opacity={0.8}
                    className="animate-pulse"
                  />
                )}

                {/* Point Center */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 4.5}
                  fill={accentColor}
                  stroke={isDark ? '#0f172a' : '#ffffff'}
                  strokeWidth={1.5}
                />

                {/* Clean Label Badge with Protective Background Pill */}
                <g>
                  <rect
                    x={labelX - labelWidth / 2}
                    y={labelY - labelHeight / 2}
                    width={labelWidth}
                    height={labelHeight}
                    rx={3}
                    fill={isDark ? '#090e1a' : '#ffffff'}
                    stroke={isHovered ? (isDark ? '#ffffff' : '#0f172a') : accentColor}
                    strokeWidth={isHovered ? 1.4 : 0.8}
                    opacity={0.95}
                  />
                  <text
                    x={labelX}
                    y={labelY + 3.5}
                    fill={isHovered ? (isDark ? '#ffffff' : '#0f172a') : (isDark ? '#e2e8f0' : '#1e293b')}
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight={isHovered ? 'bold' : '600'}
                    textAnchor="middle"
                  >
                    {shortName}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Empty Canvas Notice */}
          {points.length === 0 && (
            <g>
              <rect
                x={width / 2 - 120}
                y={height / 2 - 18}
                width={240}
                height={38}
                rx={6}
                fill={isDark ? '#0f172a' : '#ffffff'}
                stroke={isDark ? '#334155' : '#cbd5e1'}
                strokeWidth={1}
                opacity={0.92}
              />
              <text
                x={width / 2}
                y={height / 2}
                fill={isDark ? '#94a3b8' : '#475569'}
                fontSize="10"
                fontFamily="sans-serif"
                fontWeight="600"
                textAnchor="middle"
              >
                Hardware Profile Ready
              </text>
              <text
                x={width / 2}
                y={height / 2 + 13}
                fill={isDark ? '#64748b' : '#64748b'}
                fontSize="8.5"
                fontFamily="monospace"
                textAnchor="middle"
              >
                0 active kernels (Add blocks to canvas to plot)
              </text>
            </g>
          )}
        </svg>

        {/* Hovered Point Card Info */}
        {hoveredPoint && (
          <div className={`absolute top-2 right-4 p-2.5 rounded-lg border text-xs font-mono z-20 backdrop-blur-md max-w-xs ${
            isDark ? 'bg-slate-950/95 border-slate-700 shadow-xl' : 'bg-white/95 border-slate-200 shadow-lg'
          }`}>
            <div className={`font-semibold flex items-center justify-between ${
              isDark ? 'text-slate-100' : 'text-slate-900'
            }`}>
              <span>{hoveredPoint.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                hoveredPoint.memoryBound 
                  ? (isDark ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200')
                  : (isDark ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
              }`}>
                {hoveredPoint.memoryBound ? 'Bandwidth-Bound' : 'Compute-Bound'}
              </span>
            </div>
            <div className={`mt-1 space-y-0.5 text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              <div>Intensity: <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{hoveredPoint.arithmeticIntensity} FLOPs/Byte</strong></div>
              <div>Attainable: <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{hoveredPoint.attainableTFlops} TFLOPs/s</strong></div>
              <div>Hardware Ridge: <strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>{ridgePoint.toFixed(1)} FLOPs/Byte</strong></div>
            </div>
          </div>
        )}
      </div>

      {/* Legend and Regime Explanation */}
      <div className={`mt-2 pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs ${
        isDark ? 'border-slate-800' : 'border-slate-200'
      }`}>
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Memory-Bandwidth Bound (Intensity &lt; Ridge)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>Compute Bound (Intensity ≥ Ridge)</span>
          </div>
        </div>

        <div className={`text-[11px] flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          <Info className="w-3.5 h-3.5 text-sky-500" />
          <span>Decodes are memory-bound; Prefills are compute-bound.</span>
        </div>
      </div>
    </div>
  );
};
