# Profiler Components

This folder contains the four analytical UI cards that form the **Profiler panel** of GraphFlow AI. Together they give a real-time, hardware-aware breakdown of how a large language model (or any transformer architecture) actually executes — from raw FLOPs to memory pressure, network communication overhead, and hardware utilisation regime.

All four components are **display-only React functional components** driven by props. They do not own their state (outside of local hover/select micro-interactions). Computation is delegated entirely to engine functions in [`src/engine/scalingMath.ts`](../../engine/scalingMath.ts) and hardware constants in [`src/engine/hardwareSpecs.ts`](../../engine/hardwareSpecs.ts).

---

## Files

| File | Component | What it profiles |
|---|---|---|
| [`FlopsEstimatorCard.tsx`](./FlopsEstimatorCard.tsx) | `FlopsEstimatorCard` | FLOPs per token, total step compute, step latency, cluster throughput |
| [`MemoryProfileChart.tsx`](./MemoryProfileChart.tsx) | `MemoryProfileChart` | VRAM allocation per GPU broken down by weights / optimizer / activations / KV cache |
| [`RooflineModelChart.tsx`](./RooflineModelChart.tsx) | `RooflineModelChart` | Log-log roofline plot classifying each kernel as memory-bound or compute-bound |
| [`CommBottleneckCard.tsx`](./CommBottleneckCard.tsx) | `CommBottleneckCard` | Distributed topology controls and predicted inter-GPU communication latency |

---

## Component Details

### `FlopsEstimatorCard`

**Purpose:** Estimates the compute cost of a forward pass using the analytical formula:

```
Fwd FLOPs = 2·P_active + 4·L·H·S·d_head
```

where `P_active` is active parameters (dense or MoE top-k), `L` is number of layers, `H` is number of heads, `S` is context length, and `d_head` is the per-head dimension.

**Props:**

| Prop | Type | Description |
|---|---|---|
| `dim` | `ModelDimensions` | Architecture shape (layers, heads, hidden dim, MoE config, …) |
| `runtime` | `RuntimeDimensions` | Batch size, prompt/generation token counts, phase |
| `precision` | `PrecisionType` | `FP16`, `BF16`, `FP8`, `INT8`, `FP4` — selects peak TFLOPs figure |
| `dist` | `DistributedConfig` | Node / GPU count for cluster-wide throughput computation |
| `hardware` | `HardwareSpec` | Target accelerator's peak TFLOPs and memory bandwidth |

**Key outputs displayed:**

- **Forward FLOPs / Token** — absolute compute demand per input token.
- **Total Step Compute** — scaled to the full batch × sequence length.
- **Est. Step Time** — assumes `MFU = 48%` of peak, a realistic utilisation target for production clusters.
- **Cluster Throughput** — effective tokens per second across all GPUs.

---

### `MemoryProfileChart`

**Purpose:** Breaks down the theoretical VRAM footprint on a single GPU, checks whether the model fits, and highlights KV-cache pressure.

**Props:**

| Prop | Type | Description |
|---|---|---|
| `memory` | `MemoryProfile` | Pre-computed memory breakdown (weights, optimizer, activations, KV cache, totals) |
| `hardware` | `HardwareSpec` | VRAM capacity per GPU used as the capacity ceiling |
| `runtime` | `RuntimeDimensions` | Runtime context (used for labelling only in this component) |

**Memory segments tracked:**

| Segment | Colour | Notes |
|---|---|---|
| Weights | Indigo | Parameter bytes at the selected precision |
| Optimizer | Blue | Adam / ZeRO optimizer state (fp32 moments) |
| Activations | Emerald | Gradient checkpointing-aware activation buffer |
| KV Cache | Cyan / Amber | Turns amber when KV cache > 45% of VRAM — a KV-bottleneck warning |

**Status badges:**

- **OOM** (pulsing red) — per-GPU footprint exceeds hardware VRAM, with the deficit shown in GB.
- **Fits in VRAM** (green) — shows % utilisation.
- **0 GB / Canvas Cleared** — no blocks on the canvas yet.

The progress bar is interactive: hovering any coloured segment shows an exact tooltip with GB and percentage.

---

### `RooflineModelChart`

**Purpose:** Renders a **log-log Roofline Model** chart that plots each active kernel operation (QKV projection, MLP, softmax, RMSNorm, etc.) against the two hardware ceilings: memory bandwidth and peak compute. This immediately shows whether a kernel is **bandwidth-bound** or **compute-bound** relative to the selected hardware.

**Props:**

| Prop | Type | Description |
|---|---|---|
| `points` | `RooflinePoint[]` | One entry per kernel, carrying arithmetic intensity (FLOPs/Byte) and attainable TFLOPs/s |
| `ridgePoint` | `number` | `peakCompute / memoryBandwidth` — the inflection intensity in FLOPs/Byte |
| `peakCompute` | `number` | Hardware peak in TFLOPs (FP16 or FP8 depending on precision) |
| `memoryBandwidth` | `number` | HBM bandwidth in TB/s |
| `hardware` | `HardwareSpec` | Primary hardware used for the roofline envelope |
| `precision` | `PrecisionType` | Controls which peak TFLOPs figure is used for the comparison GPU |
| `onSelectHardware?` | `(hw: HardwareSpec) => void` | Optional callback when the user clicks a hardware entry |

**Chart anatomy:**

- **Solid sky-blue line** — primary hardware roofline (memory-bandwidth slope transitioning to compute plateau).
- **Dashed violet line** — overlay of a second hardware spec chosen via the "Compare" dropdown, for side-by-side regime comparison.
- **Ridge point marker** — vertical dashed line at the inflection intensity, labelled in FLOPs/Byte.
- **Amber dots** — memory-bound kernels (arithmetic intensity below the ridge).
- **Emerald dots** — compute-bound kernels (arithmetic intensity at or above the ridge).
- **Hover card** — clicking/hovering a dot shows exact intensity, attainable TFLOPs/s, and the hardware ridge point.

The component uses `useMemo` to compute collision-free label placement: memory-bound labels alternate above/below the slope; compute-bound labels alternate above/below the plateau.

> **Design note:** Prefill (large matrix multiplications) is naturally compute-bound; decode (autoregressive single-token generation) is naturally memory-bandwidth-bound. The legend at the bottom of the chart makes this explicit.

---

### `CommBottleneckCard`

**Purpose:** Models inter-GPU communication overhead for a distributed training/inference cluster, predicting the total communication latency per training step and its ratio to pure compute time. Serves as a topology planner and bottleneck predictor.

**Props:**

| Prop | Type | Description |
|---|---|---|
| `dist` | `DistributedConfig` | Current parallelism strategy and cluster topology |
| `onUpdateDist` | `(dist: DistributedConfig) => void` | Callback when the user changes any parallelism setting |
| `hardware` | `HardwareSpec` | Interconnect bandwidths (NVLink / network) used for latency estimation |
| `onUpdateHardware` | `(hw: HardwareSpec) => void` | Callback when target hardware changes |
| `dim` | `ModelDimensions` | Model shape needed to size all-reduce / all-to-all payloads |
| `runtime` | `RuntimeDimensions` | Batch and token dimensions |
| `precision` | `PrecisionType` | Bytes-per-element for activation and gradient size calculations |

**Parallelism strategies controlled:**

| Strategy | Abbreviation | Communication primitive | Colour |
|---|---|---|---|
| Tensor Parallelism | TP | Ring All-Reduce (intra-layer) | Purple |
| Pipeline Parallelism | PP | P2P activation sends (cross-node) | Sky |
| Expert Parallelism | EP | All-to-All token dispatch (MoE only) | Amber |
| ZeRO Optimizer Sharding | ZeRO | Gradient + state sharding | Emerald |

EP controls are disabled when `dim.isMoE === false`.

**Cluster scale presets:** Quick-select buttons for 8 / 32 / 128 / 512 GPU configurations (1 / 4 / 16 / 64 nodes × 8 GPUs per node).

**Severity badge:**

| Ratio | Badge | Behaviour |
|---|---|---|
| ≥ high threshold | **High Comm Overhead** | Animated red pulse |
| Moderate | **Moderate Comm Overhead** | Amber |
| Low | **Compute Dominant** | Green |
| No layers | **Idle** | Grey |

The visual bar at the bottom splits the estimated step time into green (compute) vs red (communication) segments.

---

## Data Flow

```
ModelDimensions  ─────────┐
RuntimeDimensions ─────────┼──► scalingMath.ts ──► FlopsEstimatorCard
HardwareSpec ─────────────┤               └──► CommBottleneckCard
DistributedConfig ─────────┘
PrecisionType ─────────────┘

MemoryProfile (pre-computed) ──────────────────► MemoryProfileChart

RooflinePoint[] (pre-computed) ────────────────► RooflineModelChart
ridgePoint / peakCompute ──────────────────────►
```

`MemoryProfile` and `RooflinePoint[]` are computed upstream (in the parent page/panel) before being passed as props, while `FlopsEstimatorCard` and `CommBottleneckCard` call engine functions directly inside the component.

---

## Shared Conventions

- **Dark / Light theme** — all four components read `useTheme()` from [`src/context/ThemeContext`](../../context/ThemeContext.tsx) and swap their Tailwind class sets accordingly.
- **Font mono** — numerical outputs use `font-mono` throughout for alignment and readability.
- **Zero-state** — every card gracefully handles the empty-canvas case (no blocks placed), showing a neutral idle badge instead of zeroes or broken layouts.
- **No external chart library** — `RooflineModelChart` renders its SVG manually for precise log-scale control; all other cards use plain Tailwind-styled `div` elements.
