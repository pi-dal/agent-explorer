# Agent Explorer

An explorer for agent session logs that runs in the browser or as a desktop app. Open a JSONL or runtime log file and browse the full session across three linked views: a chronological timeline, a conversation view, and an event detail inspector.

Parsing runs entirely in the browser — nothing is uploaded.

## Features

- **Flexible layout** — resizable timeline, conversation, and detail views
- **Auto-detecting parsers** — automatically select the most sensible parser for the opened file
- **Folder workspaces** — open any XiaoBa project, logs, sessions, date, or channel folder; browse its preserved directory tree and resolve referenced prompt files locally
- **Desktop continuity** — restore the most recently opened log or workspace and refresh it automatically as files change
- **Layout continuity** — remember the native window size, position, maximized state, and three-pane widths across launches
- **Native macOS lifecycle** — hide on window close, reopen from the Dock, and reserve `Cmd+Q` for fully quitting the app
- **Live log following** — automatically refresh an individually opened desktop log as the owning agent appends new events
- **Safe live refresh** — retain the last valid session while a watched log is temporarily empty or incomplete during a rewrite
- **Atomic-write resilience** — keep following a log when its writer replaces the file with a renamed temporary file
- **Native desktop controls** — standard application menus and shortcuts for opening logs and folders, plus reveal the current log in Finder or Explorer
- **System file integration** — open `.jsonl` and `.log` sessions directly from Finder, Explorer, or the Linux desktop
- **Signed desktop updates** — check quietly after startup, then let the user choose when to download, install, and restart
- **XiaoBa sample** — load a built-in trace covering turns, prompts, tools, subagents, memory search, and distillation
- **Timeline** — filter by category, search, keyboard navigation (↑/↓), and optional highlighting of events that share the same request
- **Conversation** — virtualized message list with user/assistant bubbles, thinking blocks, and expandable tool call / result cards with pair highlighting
- **Detail panel** — session metadata, event summary, token usage & estimated cost, and raw JSON viewer
- **Theme** — light / dark mode with system preference support

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 23+
- [pnpm](https://pnpm.io/) 10+
- [Rust](https://www.rust-lang.org/tools/install) stable and the [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) for desktop development

The repository includes `mise.toml` for the expected Node.js, pnpm, and Rust toolchains.

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Open the URL printed by Vite (typically `http://localhost:5173`).

To run the desktop app instead:

```bash
pnpm desktop:dev
```

Desktop shortcuts:

| Action | Shortcut |
|--------|----------|
| Open log file | `Cmd/Ctrl+O` |
| Open workspace folder | `Cmd/Ctrl+Shift+O` |
| Show current log in Finder/Explorer | `Cmd/Ctrl+Shift+R` |

### Other scripts

```bash
pnpm build          # production web build
pnpm desktop:build  # native desktop bundle
pnpm preview        # preview the production web build
pnpm test           # run tests
pnpm lint           # run oxlint
```

Desktop installers are built for macOS, Windows, and Linux in GitHub Actions. See [Desktop Distribution](docs/DISTRIBUTION.md) for artifact formats, release tags, and signing configuration.

The desktop app performs a silent update check shortly after startup. It never downloads an update automatically: use the status-bar update control or **Check for Updates** in the application menu, then explicitly choose to install and restart.

## Supported file formats

The app inspects the first lines of a JSONL file and picks the best-matching adapter. If no format scores above the detection threshold, loading fails with an error.

| Format | Description |
|--------|-------------|
| Claude Code transcript | Per-line `user` / `assistant` events with `message.content` blocks |
| Codex rollout | Envelope records such as `session_meta`, `turn_context`, `event_msg`, and `response_item` |
| XiaoBa sessions | Persisted message contexts, per-turn logs, runtime `.log` files, branch execution logs, prompt traces, and subagent tool events |

Support of more file formats is on the way.

## License

MIT — see [LICENSE](LICENSE).
