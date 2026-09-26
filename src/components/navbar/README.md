# `TopNavbar` — GraphFlow-AI Top Navigation Bar

> **Location:** `src/components/navbar/TopNavbar.tsx`

The top navigation bar is the single, persistent control strip rendered at the top of the entire application. It is `56 px` tall (`h-14`), sits at `z-index 30`, and is the first element the user interacts with to change the application's global state.

---

## Exports

| Export | Kind | Description |
|---|---|---|
| `ActiveViewMode` | `type` | Union of the four valid view identifiers: `'canvas' \| 'roofline' \| 'distributed' \| 'bento'` |
| `TopNavbar` | `React.FC` | The navbar component itself |

---

## Props (`TopNavbarProps`)

| Prop | Type | Required | Description |
|---|---|---|---|
| `viewMode` | `ActiveViewMode` | ✅ | The currently active view; used to highlight the correct switcher button |
| `onSetViewMode` | `(mode: ActiveViewMode) => void` | ✅ | Callback to change the active view in the parent (`App`) |
| `spec` | `ModelArchitectureSpec` | ✅ | The live architecture specification; used to derive the model tag/parameter count badge and to serialise the JSON export |
| `onImportConfig` | `(configJson: string) => void` | ✅ | Callback invoked with the raw JSON string read from an imported `.json` file |
| `isSidebarCollapsed` | `boolean` | ✅ | Whether the left `ParameterConfigurator` sidebar is collapsed; controls which sidebar-toggle icon is shown |
| `onToggleSidebar` | `() => void` | ✅ | Callback that flips the sidebar collapsed state in `App` |

---

## Layout — Three Zones

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  [≡ Config]  [⚙ GraphFlow-AI  1.0B]  │  [Bento] [Graph] [Roofline] [Topology]  │  [🌙] [↓ Export] [↑ Import] [Share]  │
└─────────────────────────────────────────────────────────────────────────────────────┘
       LEFT                                       CENTER                                          RIGHT
```

### Left — Brand & Sidebar Toggle

| Element | Behaviour |
|---|---|
| **Sidebar toggle button** | Renders `PanelLeft` + `"Config"` label when the sidebar is collapsed; renders `PanelLeftClose` when expanded. Clicking calls `onToggleSidebar`. |
| **App logo** | Sky-600 rounded tile with a `Cpu` icon. |
| **App name** | `GraphFlow` in bold + `-AI` in sky-500. |
| **Model badge** | Displays `spec.tag` if present, otherwise formats `spec.summary.totalParameters` as `"X.XB"` (billions). |
| **Tagline** | `"Modular PyTorch Deep Learning Architect"` — hidden on small screens (`hidden sm:block`). |

### Center — View Mode Switcher

A pill-shaped button group that controls which main view is rendered by `App`. The active button is highlighted with a `bg-sky-600 text-white` style; inactive buttons dim to match the current theme. All four views share the same `ActiveViewMode` type.

| Button | `ActiveViewMode` value | Icon | Tooltip |
|---|---|---|---|
| **Studio Bento** | `'bento'` | `Columns` | Split-screen canvas + analytical dashboards |
| **Graph Canvas** | `'canvas'` | `Layers` | Full-screen interactive modular graph |
| **Roofline** | `'roofline'` | `Activity` | Dynamic Roofline Model & Compute Analyzer |
| **Topology** | `'distributed'` | `Network` | Cluster hardware & communication latency profiler |

### Right — Action Controls

| Control | Icon | Behaviour |
|---|---|---|
| **Theme Toggle** | `Sun` / `Moon` | Calls `toggleTheme()` from `ThemeContext`. Persists choice to `localStorage` under the key `graphflow_theme`. Shows `"Light"` / `"Dark"` label on `sm:` and wider screens. |
| **Export JSON** | `Download` | Serialises the current `spec` object to a formatted JSON string and triggers a browser download. The filename is derived from `spec.name` (lowercased, non-alphanumeric chars replaced with `-`), e.g. `deepseek-v3-spec.json`. |
| **Import JSON** | `Upload` | Programmatically clicks a hidden `<input type="file" accept=".json">`, reads the selected file as text, then calls `onImportConfig` with the raw string. Parsing is delegated to the parent. |
| **Share** | `Share2` / `Check` | Copies `window.location.href` to the clipboard via the Clipboard API. The icon briefly switches to an emerald `Check` and the label changes to `"Copied"` for 2 seconds, then resets. |

---

## Internal State

| State | Type | Default | Purpose |
|---|---|---|---|
| `copied` | `boolean` | `false` | Drives the transient "Copied" feedback on the Share button |

All other state (view mode, sidebar collapse, theme) is lifted to `App` or `ThemeContext`.

---

## Theme Integration

The component consumes [`useTheme`](../../context/ThemeContext.tsx) to read `{ theme, toggleTheme }`. It derives a boolean `isDark = theme === 'dark'` and uses it throughout for Tailwind class branching (`bg-slate-900` vs `bg-white`, etc.). This keeps the component fully reactive to theme changes without any local CSS variables.

---

## Usage (from `App.tsx`)

```tsx
import { TopNavbar, ActiveViewMode } from './components/navbar/TopNavbar';

<TopNavbar
  viewMode={viewMode}
  onSetViewMode={setViewMode}
  spec={spec}
  onImportConfig={handleImportConfig}
  isSidebarCollapsed={isSidebarCollapsed}
  onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
/>
```

---

## Dependencies

| Module | Role |
|---|---|
| `lucide-react` | All icons: `Share2`, `Download`, `Upload`, `Cpu`, `Layers`, `Activity`, `Network`, `Check`, `Columns`, `Sun`, `Moon`, `PanelLeftClose`, `PanelLeft` |
| `../../types` | `ModelArchitectureSpec`, `RuntimeDimensions`, `PrecisionType`, `DistributedConfig` (imported but used via `spec`) |
| `../../context/ThemeContext` | `useTheme()` hook for theme reading and toggling |

---

## Responsive Behaviour

| Screen size | Differences |
|---|---|
| All | Four view-mode buttons always visible; icons always shown |
| `< sm` | Tagline hidden; sidebar "Config" label hidden; "Light/Dark" label hidden; "Export JSON" text hidden; "Import" text hidden |
| `>= sm` | All labels visible |
| `< md` | "Studio Bento" text label hidden (icon only) |
| `>= md` | All four view-mode labels visible |
