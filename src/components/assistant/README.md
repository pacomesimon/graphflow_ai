# `src/components/assistant`

This folder contains the two React components that power **GraphFlow Copilot** — the AI-assisted chat sidebar embedded in the GraphFlow canvas. The Copilot lets users query, diagnose, and mutate a loaded `ModelArchitectureSpec` in plain language, grounded on the live architecture JSON and optionally on user-attached external webpage references (arXiv papers, PyTorch docs, etc.).

---

## Files

### [`AssistantChatDrawer.tsx`](./AssistantChatDrawer.tsx)

The primary, self-contained chat panel. It renders as a fixed right-side drawer over the canvas and is the single entry-point for all Copilot interactions.

#### Props

| Prop | Type | Description |
|---|---|---|
| `isOpen` | `boolean` | Controls drawer visibility. Returns `null` when `false`. |
| `onClose` | `() => void` | Callback to close the drawer (fires on the ✕ button). |
| `currentSpec` | `ModelArchitectureSpec` | The live architecture graph spec passed in from the parent. Serialised to JSON and injected into every system prompt sent to Gemini. |
| `onApplySpec` | `(updatedSpec: ModelArchitectureSpec) => void` | Called when the user clicks **Apply Changes to Graph** on an action card, propagating the Copilot-proposed spec mutation back to the parent canvas. |

#### Key Internal State

| State | Purpose |
|---|---|
| `messages` | Full ordered chat history (`Message[]`). Seeded with an opening greeting that names the active model and its parameter count. |
| `input` | Current value of the text input. |
| `loading` | `true` while the `/api/assistant/chat` fetch is in flight; triggers the animated "Analyzing…" indicator. |
| `attachedLinks` | Array of validated URLs the user has queued to send as web references alongside the next prompt. |
| `isLinkInputOpen` | Whether the link-attachment accordion is expanded. |
| `linkInputValue` / `linkError` | Controlled input and validation feedback for the URL field. |

#### `Message` shape

```ts
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  webReferences?: string[];           // URLs attached by the user when sending this message
  referencedSources?: Array<{ url: string; title: string }>; // Sources the server actually fetched & cited
  action?: {
    action: string;                   // e.g. "UPDATE_SPEC"
    summary: string;                  // Human-readable description of the proposed change
    updatedSpec?: ModelArchitectureSpec;
  } | null;
  applied?: boolean;                  // true after the user clicks "Apply Changes to Graph"
}
```

#### API Contract — `POST /api/assistant/chat`

The component sends:

```json
{
  "messages": [{ "role": "user" | "assistant", "content": "..." }],
  "currentModelSpec": { /* ModelArchitectureSpec */ },
  "webReferences": ["https://arxiv.org/..."]
}
```

The server responds with:

```json
{
  "reply": "Markdown-formatted explanation...",
  "action": { "action": "UPDATE_SPEC", "summary": "...", "updatedSpec": { ... } } | null,
  "referencedSources": [{ "url": "...", "title": "..." }]
}
```

When `action` is non-null and contains an `updatedSpec`, the component renders a **Proposed Architecture Mutation** card beneath the assistant message. Clicking **Apply Changes to Graph** calls `onApplySpec(updatedSpec)` and marks the message as `applied`.

#### Web Reference Attachment Flow

1. User clicks the **Globe** button to open the URL accordion.
2. User types or pastes a URL (auto-prefixed with `https://` if missing) or picks a preset (Llama 3 paper, FlashAttention-3, DeepSeek-V3 MoE, PyTorch GQA Docs).
3. The URL is validated client-side (must be a parseable URL with a hostname containing `.`), then pushed into `attachedLinks`.
4. On send, attached URLs are included in the API request as `webReferences` and cleared from state. The server fetches their content, injects it into the system prompt, and returns `referencedSources` which are rendered as labelled citation links below the assistant reply.

#### Quick Prompts

Four one-click starter prompts are rendered above the input bar:

- *Diagnose dimension mismatches in this model*
- *Convert attention to Grouped Query Attention (GQA)*
- *Optimize architecture to fit on a single H100 (80GB)*
- *Explain the arithmetic intensity and memory wall*

Clicking any of them calls `handleSend(prompt)` directly, bypassing the input field.

#### Theme

Reads `theme` from `ThemeContext` (`'dark' | 'light'`) and applies conditional Tailwind classes throughout. All surfaces, borders, and text colours have both dark and light variants.

---

### [`MarkdownMessage.tsx`](./MarkdownMessage.tsx)

A lightweight Markdown renderer used exclusively to display assistant replies inside `AssistantChatDrawer`.

#### Props

| Prop | Type | Description |
|---|---|---|
| `content` | `string` | Raw Markdown string to render. |
| `isDark` | `boolean` | Theme flag; controls colours for all rendered elements. |

#### Rendering Pipeline

Uses [`react-markdown`](https://github.com/remarkjs/react-markdown) with the [`remark-gfm`](https://github.com/remarkjs/remark-gfm) plugin (GitHub Flavoured Markdown — tables, strikethrough, task lists). Every HTML element produced by `ReactMarkdown` is replaced with a custom Tailwind-styled component:

| Element | Notes |
|---|---|
| `p`, `strong`, `em` | Standard inline typography. |
| `h1` / `h2` / `h3` | Scaled heading hierarchy; `h2` is always `text-sky-400`. |
| `ul` / `ol` / `li` | Sky-accented list markers. |
| `blockquote` | Left sky border, subtle tinted background. |
| `a` | Opens in new tab; appends an `ExternalLink` icon. |
| `table` / `thead` / `th` / `td` | Horizontally scrollable, monospaced, theme-aware table. |
| `code` (inline) | Pill-style monospace badge, sky-tinted. |
| `code` (block / multi-line) | Delegated to the internal `CodeBlock` component. |

#### `CodeBlock` (internal)

Renders fenced code blocks with:
- A header bar showing the **language tag** (in sky) and a **Copy** button.
- Clicking Copy writes to `navigator.clipboard` and shows a green `Check` + "Copied" confirmation for 2 seconds.
- Dark `slate-950` background regardless of the page theme.

---

## Data Flow Summary

```
Parent (App / Canvas)
  │  currentSpec, onApplySpec
  ▼
AssistantChatDrawer
  │  POST /api/assistant/chat
  ▼
server.ts  ──►  Gemini (gemini-3.8-flash)
                 system prompt = currentSpec JSON + fetched webpage content
  │  { reply, action, referencedSources }
  ▼
AssistantChatDrawer  ──►  MarkdownMessage (renders reply)
                     ──►  Action Card  ──►  onApplySpec(updatedSpec)
```
