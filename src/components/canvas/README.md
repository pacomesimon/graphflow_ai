# `src/components/canvas`

Interactive React Flow–based canvas for visually building, inspecting, and managing neural-network architectures. All files here are pure presentational/interaction components; computation math lives in `src/engine/`, type contracts live in `src/types/`.

---

## Files at a glance

| File | Purpose |
|---|---|
| [`ArchitectureCanvas.tsx`](#architecturecanvastsx) | Root canvas component — wires React Flow with the full architecture spec |
| [`CustomNodes.tsx`](#customnodestsx) | React Flow node renderers for modular blocks and repetition groups |
| [`CustomEdges.tsx`](#customedgestsx) | React Flow edge renderer for typed tensor-flow connections |
| [`AddBlockDrawer.tsx`](#addblockdrawertsx) | Slide-in drawer for browsing the block catalog or creating a custom block type |
| [`BlockInspectorModal.tsx`](#blockinspectormodaltsx) | Modal for editing a single block's hyperparameters with a live metrics preview |
| [`ModelJsonModal.tsx`](#modaljsontsx) | Modal for viewing, editing, copying, downloading, and applying a full `ModelArchitectureSpec` as JSON |

---

## `ArchitectureCanvas.tsx`

### What it does
The **top-level canvas orchestrator**. It wraps the entire `ReactFlowProvider` and hosts:

- All modal/drawer open-state (`isAddBlockOpen`, `isJsonModalOpen`, `isAssistantOpen`, `isGroupModalOpen`).
- Conversion from the flat `ModelArchitectureSpec` spec (blocks + connections + repetitionGroups) into React Flow `nodes` + `edges` via `convertSpecToFlowGraph`.
- Every mutation handler that takes a user action → updates the spec → calls `recomputeSpecMetrics` → bubbles up via `onUpdateSpec`.
- The floating left toolbar (edge-height slider, re-render button, validation badge, mismatch test toggle, group-layers button).
- The floating right toolbar (Add Block, Copilot Assistant, JSON Spec, Clear All).
- The `Group Repetitive Layers` inline modal.
- An empty-state overlay when `spec.blocks.length === 0`.

### Props (`ArchitectureCanvasProps`)

| Prop | Type | Required | Description |
|---|---|---|---|
| `spec` | `ModelArchitectureSpec` | ✅ | The full architecture data model to render |
| `onUpdateSpec` | `(spec) => void` | ✅ | Called whenever any mutation changes the spec |
| `customBlocks` | `CustomBlockDefinition[]` | ✅ | User-saved custom block type definitions |
| `onSaveCustomBlock` | `(block) => void` | ✅ | Persists a newly created custom block type |
| `minEdgeHeight` | `number` | optional | Minimum vertical spacing between nodes (default `95`) |
| `onUpdateMinEdgeHeight` | `(h) => void` | optional | Called when the edge-height slider moves |
| `hardware` | `HardwareSpec` | optional | Hardware spec used for metric recomputation (default `DEFAULT_HARDWARE`) |
| `onReRender` | `() => void` | optional | Notifies parent to refresh external panels (roofline, topology) |

### Key internal logic

- **`FlowFitter`** — a tiny child component that calls `fitView` after a short delay whenever `specId` or `nodeCount` changes. This ensures the viewport auto-centres after preset loads or block mutations.
- **`handleAddBlock`** — creates a new `ModularBlock` from a template, calculates its initial metrics relative to the last existing block's `outputShape`, auto-connects to it, then recomputes the summary.
- **`handleDeleteBlock` / `handleDuplicateBlock`** — mutate `spec.blocks`, clean up related `connections` and `repetitionGroups`, recompute.
- **`handleUpdateGroupRepetitions` / `handleUpdateGroupName` / `handleUngroup`** — mutate `spec.repetitionGroups`; ungrouping copies the group's `repetitions` back into each block's `repeatLayers`.
- **`onNodesChange`** — applies React Flow node changes, then clamps child-node positions inside their parent group container box so blocks cannot be dragged outside the group border.
- **`onConnect`** — converts a React Flow edge connection into a typed `BlockConnection` (detects residual connections from `sourceHandle === 'residual-out'`).
- **`handleReRender`** — full pipeline refresh: recompute all metrics → regenerate the flow graph → fit view → notify parent.
- **`handleToggleMismatchTest`** — developer tool that injects or resolves an artificial dimension mismatch to verify the validation display.

### Public export

```tsx
export const ArchitectureCanvas: React.FC<ArchitectureCanvasProps>
```

This is a thin wrapper that adds `<ReactFlowProvider>` around `ArchitectureCanvasInner` so the hook `useReactFlow()` works inside.

---

## `CustomNodes.tsx`

### What it does
Defines the two React Flow **custom node types** registered in `ArchitectureCanvas`:

| Export | `nodeType` key | Description |
|---|---|---|
| `ModularBlockNode` | `"modularBlock"` | Renders a single `ModularBlock` with metrics, handles, and action buttons |
| `RepetitionGroupNode` | `"repetitionGroup"` | Renders a `RepetitionGroup` container box with an inline repetition multiplier |

### `ModularBlockNode`

Reads `data` as `ModularBlockNodeData` (contains a `ModularBlock` + callbacks).

Has **three specialised rendering paths**:

1. **`op.ResidualOrigin`** — compact "Identity Tap" card. Exposes one `target` handle (top) and two `source` handles: `out` (bottom, main stream) and `residual-out` (left, skip branch).
2. **`op.Add` / `category === 'operation'`** — compact "Residual Sum" card. Exposes two `target` handles (`in` top, `residual-in` left) and one `source` handle (`out` bottom).
3. **All other categories** — full card with:
   - Category icon and colour-coded `moduleType` badge.
   - Parameter digest line (module-specific human-readable summary).
   - Tensor shape row (`In → Out`).
   - Dimension-mismatch alert banner (rose highlight + `AlertTriangle`).
   - 2-column metrics grid: **Parameters** and **Arithmetic Intensity** (FLOP/B).
   - Footer: bandwidth-bound/compute-bound dot + GPU/Node assignment badge.
   - Three action buttons: Inspect (`Sliders`), Duplicate (`Copy`), Delete (`Trash2`).
   - Three `Handle` points: top `in`, left `residual-in` (35%), left `residual-out` (65%), bottom `out`.

**Category → colour mapping:**

| Category | Colour |
|---|---|
| `attention` | amber |
| `ffn` | violet |
| `moe` | purple |
| `conv` | emerald |
| `embedding` | blue |
| `norm` | cyan |
| `head` | rose |
| `ssm` | teal |
| `operation` | emerald |

### `RepetitionGroupNode`

Renders as a full-height/width container box with:

- A **rose dashed border** background layer (non-interactive).
- A **floating top header bar** showing group name (click-to-rename inline), per-layer params, total params, and an Ungroup button.
- A **bottom-left multiplier widget** — the `N ×` badge that can be clicked to open an inline stepper (`+`/`−` buttons + number input). Exactly mirrors the DeepSeek V3/R1 architecture diagram style.

All repetition/name changes are committed via `nodeData.onUpdateRepetitions` and `nodeData.onUpdateGroupName` callbacks injected by `ArchitectureCanvas`.

---

## `CustomEdges.tsx`

### What it does
Defines a single React Flow **custom edge type**:

| Export | `edgeType` key | Description |
|---|---|---|
| `TensorFlowEdge` | `"tensorFlow"` | Styled SVG edge with tensor-shape label and four visual states |

### Edge states

| State | Trigger | Visual |
|---|---|---|
| **Normal** | Default | Sky-blue smooth-step path with arrowhead |
| **Selected** | Edge is selected | Thicker sky-blue stroke |
| **Mismatch** | `data.isMismatch` | Rose-red glowing stroke + animated ping badge: `Mismatch: <detail>` |
| **Cut (All-Reduce)** | `data.isCut` | Rose dashed stroke + `All-Reduce Link` badge |
| **Residual** | `data.isResidual` OR `sourcePosition/targetPosition === 'left'` | Emerald dashed Bézier curve routed through left corridor + pulsing `Residual Stream (x)` badge |

### Residual path geometry
Residual connections use a hand-crafted cubic Bézier instead of the standard `getSmoothStepPath`. It routes left of all intermediate nodes:
- `bendX = min(sourceX, targetX) − arcClearance` where `arcClearance` scales with vertical span.
- Control-point offsets are proportional to span and clamped so the curve never inverts.
- A minimum visual span of `32px` prevents the label badge from overlapping the handles.

### Label rendering
Labels are rendered via `<EdgeLabelRenderer>` as absolutely positioned `div`s at `(labelX, labelY)`. Each state has its own badge style; no label is rendered if the tensor label is empty and no special state applies.

---

## `AddBlockDrawer.tsx`

### What it does
A **full-height right slide-in drawer** (fixed overlay) for adding blocks to the canvas.

### Two tabs

**Catalog tab** (`Existing Blocks`)
- Lists all blocks from `PREDEFINED_BLOCK_LIBRARY` combined with user-saved `customBlocks`.
- Search bar filters by `name`, `moduleType`, or `description`.
- Category filter pills: `all`, `attention`, `ffn`, `moe`, `conv`, `norm`, `embedding`, `ssm`.
- Each block card shows: icon, name, `moduleType` badge, description, parameter defaults, and formula summary, plus an **Add Block** button that calls `onAddBlock(blk)` and closes the drawer.

**Create tab** (`Create New Block Type`)
- A form with fields: display name, module identifier (e.g. `nn.FlashAttention3`), category select, description, JSON parameters schema (textarea), and formula summary.
- On submit, creates a `CustomBlockDefinition` with auto-generated `id` and a `paramSchema` derived from the JSON keys.
- Calls `onSaveCustomBlock` (persist) and `onAddBlock` (immediately place) before closing.

### Props (`AddBlockDrawerProps`)

| Prop | Type | Description |
|---|---|---|
| `isOpen` | `boolean` | Whether the drawer is visible |
| `onClose` | `() => void` | Close callback |
| `onAddBlock` | `(template) => void` | Called with the chosen block template |
| `customBlocks` | `CustomBlockDefinition[]` | User-saved blocks to show in the catalog |
| `onSaveCustomBlock` | `(block) => void` | Persists a newly authored custom block definition |

---

## `BlockInspectorModal.tsx`

### What it does
A **centred modal** that opens when a node is clicked/inspected. Allows editing any `ModularBlock`'s hyperparameters with a **live metrics preview** that recalculates on every keystroke.

### Features

- Syncs local state (`name`, `repeatLayers`, `params`, `assignedGPU`, `assignedNode`, `notes`) from the incoming `block` prop via `useEffect`.
- Calls `calculateBlockMetrics` with the current local params on every render to produce `previewMetrics`.
- If the block belongs to a `RepetitionGroup` (`groupInfo` prop), shows the group name + repetition count and exposes a stepper to call `onUpdateGroupRepetitions`.
- Displays per-block stats: parameters, FLOPs, VRAM, arithmetic intensity.
- On save, merges the recalculated `inputShape`, `outputShape`, and `stats` back into the `ModularBlock` before calling `onUpdateBlock`.

### Props (`BlockInspectorModalProps`)

| Prop | Type | Description |
|---|---|---|
| `block` | `ModularBlock \| null` | The block to inspect |
| `isOpen` | `boolean` | Visibility flag |
| `onClose` | `() => void` | Close callback |
| `onUpdateBlock` | `(block) => void` | Save callback |
| `onDeleteBlock` | `(id) => void` | Optional delete callback |
| `onDuplicateBlock` | `(id) => void` | Optional duplicate callback |
| `runtime` | `RuntimeDimensions` | Current batch size / sequence length |
| `precision` | `PrecisionType` | Current precision mode (FP16, BF16, FP8, …) |
| `hardware` | `HardwareSpec` | Hardware spec for metrics calculation |
| `groupInfo` | `{ groupId, groupName, repetitions } \| null` | Non-null when block is inside a repetition group |
| `onUpdateGroupRepetitions` | `(groupId, newReps) => void` | Updates the group's N× multiplier |

---

## `ModelJsonModal.tsx`

### What it does
A **large centred modal** (85 vh) that exposes the entire `ModelArchitectureSpec` as prettified JSON.

### Modes

| Mode | Trigger | Behaviour |
|---|---|---|
| **View** | Default | Read-only `<pre>` with syntax colour (emerald in dark mode) |
| **Edit** | "Edit Mode" button | Editable `<textarea>` allowing raw JSON modification |

### Actions

- **Copy** — copies `jsonText` to clipboard, shows a 2-second "Copied" confirmation.
- **Download** — creates a Blob URL and triggers `<a>.click()` to save as `<model-name>-spec.json`.
- **Apply JSON to Graph** — parses the textarea content, validates that `blocks` and `connections` arrays exist, calls `onApplyJsonSpec(parsed)`, shows success/error alert banners.

### Footer
Always shows `Total Params` (in B) and `VRAM Footprint` (in GB) from `spec.summary`.

### Props (`ModelJsonModalProps`)

| Prop | Type | Description |
|---|---|---|
| `spec` | `ModelArchitectureSpec` | The architecture to display |
| `isOpen` | `boolean` | Visibility flag |
| `onClose` | `() => void` | Close callback |
| `onApplyJsonSpec` | `(spec) => void` | Called when "Apply JSON to Graph" succeeds |

---

## Data flow overview

```
ArchitectureCanvas (props: spec, onUpdateSpec)
  │
  ├─ convertSpecToFlowGraph()  →  nodes[] + edges[]
  │     (engine/graphManager)
  │
  ├─ ReactFlow
  │     nodeTypes: { modularBlock: ModularBlockNode, repetitionGroup: RepetitionGroupNode }
  │     edgeTypes: { tensorFlow: TensorFlowEdge }
  │
  ├─ [user action] → handleXxx() → recomputeSpecMetrics() → onUpdateSpec()
  │
  ├─ <AddBlockDrawer />       opens on "Add Block" button
  ├─ <BlockInspectorModal />  opens on node click / inspect action
  ├─ <ModelJsonModal />       opens on "JSON Spec" button
  └─ <AssistantChatDrawer />  opens on "Copilot Assistant" button
```

---

## Dependencies

| Package | Used for |
|---|---|
| `@xyflow/react` | `ReactFlow`, `Handle`, `BaseEdge`, `EdgeLabelRenderer`, `getSmoothStepPath`, `useReactFlow` |
| `lucide-react` | All icons across every component |
| `../../context/ThemeContext` | `useTheme()` — dark/light mode throughout |
| `../../types` | `ModelArchitectureSpec`, `ModularBlock`, `BlockConnection`, `RepetitionGroup`, `CustomBlockDefinition`, `RuntimeDimensions`, `PrecisionType`, `HardwareSpec`, node data interfaces |
| `../../engine/graphManager` | `convertSpecToFlowGraph` |
| `../../engine/modularMath` | `calculateBlockMetrics`, `computeModelArchitectureSummary`, `validateConnections`, `recomputeSpecMetrics` |
| `../../engine/blockLibrary` | `PREDEFINED_BLOCK_LIBRARY`, `PredefinedBlockTemplate` |
| `../../engine/hardwareSpecs` | `DEFAULT_HARDWARE` |
| `../assistant/AssistantChatDrawer` | AI copilot chat drawer |
