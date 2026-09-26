# Sidebar — `ParameterConfigurator`

This folder contains the left-hand **What-If Configurator** panel that is permanently mounted inside the main application layout ([`App.tsx`](../../App.tsx)).  
It is the primary control surface: every slider, selector, and toggle here propagates changes upward via callbacks, causing the canvas, profiler charts, and memory budget to re-evaluate in real-time — hence the **"Live Sync"** badge shown in the header.

---

## File

| File | Purpose |
|---|---|
| [`ParameterConfigurator.tsx`](./ParameterConfigurator.tsx) | The single sidebar component — renders all controls and exposes a clean props-based API to the parent. No internal state beyond what is strictly local to the UI (e.g. the preset dropdown value). |

---

## Component: `ParameterConfigurator`

```tsx
import { ParameterConfigurator } from './components/sidebar/ParameterConfigurator';
```

### Props

| Prop | Type | Description |
|---|---|---|
| `dim` | `ModelDimensions` | Current model architecture dimensions (hidden size, layers, heads, vocab, MoE flags, etc.). Read-only from the sidebar's perspective — mutations go through `onUpdateDim`. |
| `onUpdateDim` | `(dim: ModelDimensions) => void` | Optional callback fired when any model dimension changes. |
| `runtime` | `RuntimeDimensions` | Active runtime configuration: batch size, context length, prompt/generation token counts, and simulation phase. |
| `onUpdateRuntime` | `(runtime: RuntimeDimensions) => void` | Fired on every runtime slider or phase-button change. |
| `precision` | `PrecisionType` | Currently selected numerical precision (`FP32` · `FP16` · `BF16` · `INT8` · `FP4`). |
| `onUpdatePrecision` | `(prec: PrecisionType) => void` | Fired when the user clicks a precision button. |
| `onApplyPreset` | `(preset: ModelPreset) => void` | Fired when the user selects an entry from the Architecture Preset dropdown — carries the full `ModelPreset` object so the parent can replace both `dim` and `runtime` at once. |
| `isCollapsed` | `boolean` | When `true` the sidebar renders `null` (fully hidden). Controlled by the parent toggle. Defaults to `false`. |
| `onToggleCollapse` | `() => void` | Callback for the collapse button inside the panel header — the parent flips its own `isSidebarCollapsed` state. |
| `minEdgeHeight` | `number` | Current minimum vertical spacing (pixels) applied to diagram edges in the canvas. |
| `onUpdateMinEdgeHeight` | `(height: number) => void` | Fired when the spacing slider or a quick-preset button is clicked. |

---

## Control Sections (top → bottom)

### 1 · Header + Live Parameter Count

- Displays the **"What-If Configurator"** title and the **"Live Sync"** badge.
- Shows a live readout of **Total Model Scale** (total parameters, formatted as Trillions / Billions / Millions) derived by calling [`calculateModelParameters(dim)`](../../engine/scalingMath.ts).
- When `dim.isMoE === true`, a second line shows **Active per token** (the top-K expert subset).
- The collapse button (`PanelLeftClose` icon) calls `onToggleCollapse`.

### 2 · Architecture Preset

- A `<select>` dropdown populated from [`PRESET_ARCHITECTURES`](../../engine/presetArchitectures.ts).
- Available presets:
  | ID | Name | Scale |
  |---|---|---|
  | `trillion-speculative-moe` | Example-1T (Fictional Model) | ~1.02 T params (MoE) |
  | `deepseek-v3-moe` | DeepSeek-V3 / R1 | 671 B params (MoE, 256 routed experts) |
  | `llama-3-405b` | Llama-3 405B (Dense) | 405 B params (GQA) |
  | `llama-3-70b` | Llama-3 70B (Dense) | 70 B params |
  | `vit-huge` | ViT-H (Vision Transformer) | ~633 M params |
- If the current `dim` does not match any preset (user has modified sliders manually), the dropdown shows **"Custom Configuration"** as a placeholder option.
- Selecting a preset calls `onApplyPreset(preset)` — the parent applies both `preset.dimensions` and `preset.runtime`.
- A short description badge appears below the dropdown when a known preset is active.

### 3 · Precision & Quantization

A five-button pill bar for selecting the active numerical format:

| Button | Bytes / param | Notes |
|---|---|---|
| `FP32` | 4 | Full precision |
| `FP16` | 2 | Standard half-precision |
| `BF16` | 2 | Brain float, preferred for training stability |
| `INT8` | 1 | Post-training quantization |
| `FP4` | 0.5 | Extreme quantization |

The selected button is highlighted in sky-600. A helper line below shows the current storage cost per parameter (derived inline, not from `scalingMath`).

> **Note (`types.ts`):** `FP8` is declared as a valid `PrecisionType` in the type system but the sidebar renders only the five options above. `getBytesPerParam` in `scalingMath.ts` currently treats `FP8` identically to `INT8` (1 byte).

### 4 · Diagram Spacing & Edge Height

Controls the vertical stretch of the architecture canvas so that tensor-shape annotations and residual skip curves have enough room.

| Control | Range | Step |
|---|---|---|
| Slider | 35 px → 220 px | 5 px |
| Quick presets | Compact (45) · Default (95) · Relaxed (140) · Expanded (190) | — |

The component enforces a minimum of **32 px** (annotation text height) and shows a live value badge. Changes fire `onUpdateMinEdgeHeight`.

### 5 · Runtime Dimensions (B, S)

Controls the inference/training simulation inputs:

#### Phase Selector (3 toggle buttons)
| Phase | Description |
|---|---|
| `prefill` | Prompt ingestion — high arithmetic intensity, large KV cache write |
| `decode` | Token-by-token generation — memory-bandwidth bound |
| `training` | Forward + backward pass — activations stored for gradient computation |

Fires `onUpdateRuntime({ ...runtime, phase })`.

#### Batch Size (B)
- Range: **1 → 256**, step 1.
- Drives memory pressure in the profiler (activation memory scales with B × S).

#### Context Length (S)
- Range: **2 048 → 524 288 tokens**, step 4 096.
- Tick labels: `2k` · `32k` · `128k` · `512k`.
- KV-cache memory is quadratic in S for standard attention; the profiler visualises this via [`MemoryProfileChart`](../profiler/MemoryProfileChart.tsx).

---

## Collapse Behaviour

When `isCollapsed === true`, `ParameterConfigurator` returns `null` — the element is completely unmounted from the DOM. The parent [`App.tsx`](../../App.tsx) maintains `isSidebarCollapsed` state and exposes a re-open button in the [`TopNavbar`](../navbar/TopNavbar.tsx).

---

## Dependencies

| Import | Used for |
|---|---|
| [`../../types`](../../types.ts) | `ModelDimensions`, `RuntimeDimensions`, `PrecisionType`, `DistributedConfig` |
| [`../../engine/presetArchitectures`](../../engine/presetArchitectures.ts) | `PRESET_ARCHITECTURES`, `ModelPreset` |
| [`../../engine/scalingMath`](../../engine/scalingMath.ts) | `calculateModelParameters` — live param count in the header badge |
| [`../../context/ThemeContext`](../../context/ThemeContext.tsx) | `useTheme` — all Tailwind class switches for dark/light mode |
| `lucide-react` | `Sliders`, `Clock`, `Zap`, `Boxes`, `PanelLeftClose`, `ChevronDown`, `MoveVertical` icons |

---

## Theming

The component reads `theme` from `ThemeContext` and switches between two class sets:

| Context | Background | Text | Accent |
|---|---|---|---|
| Dark | `slate-900/95` | `slate-200` | `sky-400` / `emerald-400` / `cyan-400` |
| Light | `white/95` | `slate-800` | `sky-600` / `emerald-600` / `cyan-600` |

All borders, badges, sliders, and buttons follow the same token system — no hard-coded colours.

---

## Data Flow

```
App.tsx  (owns state)
  │
  ├─► ParameterConfigurator (reads + fires callbacks)
  │       │
  │       ├── onApplyPreset    ──► handleApplyPreset → updates dim + runtime + precision
  │       ├── onUpdateDim      ──► setCurrentDim  ─┐
  │       ├── onUpdateRuntime  ──► setSpec(…)      ├─► triggers re-renders in canvas,
  │       ├── onUpdatePrecision──► setSpec(…)      │   profiler, and memory charts
  │       └── onUpdateMinEdgeHeight ──► setMinEdgeHeight ─┘
  │
  └─► ArchitectureCanvas / Profiler / MemoryProfileChart  (consumers)
```

All state lives in `App.tsx`; the sidebar is a pure **controlled component**.
