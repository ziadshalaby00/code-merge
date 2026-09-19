# Code Merge

> Select files, folders, or code snippets and merge them into a single
> markdown preview — with a project tree and per-file headers. Perfect
> for feeding context to LLMs (ChatGPT, Claude, Copilot) or sharing code
> snapshots with your team.


[![GitHub](https://img.shields.io/badge/GitHub-ziadshalaby00-181717?logo=github)](https://github.com/ziadshalaby00/code-merge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blue?logo=visualstudiocode)](https://code.visualstudio.com/)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/ziadshalaby00.code-merge?label=VS%20Code%20Marketplace&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=ziadshalaby00.code-merge)
[![Open VSX](https://img.shields.io/open-vsx/v/ziadshalaby00/code-merge?label=Open%20VSX)](https://open-vsx.org/extension/ziadshalaby00/code-merge)


<p>
  <img src="https://raw.githubusercontent.com/ziadshalaby00/code-merge/main/images/s4.png" width="48%" alt="Copy merged content">
  <img src="https://raw.githubusercontent.com/ziadshalaby00/code-merge/main/images/s1.png" width="48%" alt="Add folder to merge">
</p>
<p>
  <img src="https://raw.githubusercontent.com/ziadshalaby00/code-merge/main/images/s2.png" width="48%" alt="Preview merged output">
  <img src="https://raw.githubusercontent.com/ziadshalaby00/code-merge/main/images/s3.png" width="48%" alt="Add selection">
</p>

---

## ✨ Features

- **📁 Add files** — right-click any file in the Explorer, or use the keyboard.
- **📂 Add folders** — recursively scan a folder with smart ignore rules
  (`node_modules`, `.git`, `dist`, `.venv`, binaries, lockfiles, …).
  Symlinks are skipped, so cyclic links never hang the scan.
- **✂️ Add selections** — grab a range of lines from the current editor
  (supports multi-cursor with `Ctrl+D`).
- **🌲 Project tree** — every merged output starts with an ASCII tree of
  the selected items, including line ranges for selections.
- **🪟 Virtual preview** — the merged output is a live, in-memory
  document. Nothing is written to your workspace; the preview updates
  as you add, remove, or edit items.
- **🔄 Live sync** — edits (including unsaved ones) and external changes
  (git pull, other editors) are picked up automatically. Files that are
  deleted or that exceed the configured max size are dropped from the list.
- **📋 One-click copy** — copy the entire merged content to the clipboard.
- **🔒 Workspace isolation** — each workspace folder gets its own item
  list. The preview follows the active workspace as you switch between
  multi-root folders.
- **⚙️ Configurable ignore rules** — extend the built-in ignore lists via
  VS Code settings, a `.code-mergeignore` file (gitignore syntax), or by
  enabling `.gitignore` support. Commands to open settings, reload rules,
  and ignore a path from the Explorer are included.
- **🚀 Auto-open preview** — the merged preview opens automatically beside
  the current editor the first time you add an item. Disable it with
  `code-merge.autoOpenPreview`.
- **💾 Session-only state** — the selection list lives entirely in memory
  and resets when VS Code restarts. No disk writes, no state to clean up.

---

## 🚀 Usage

### Adding items

| Action | How |
|---|---|
| Add a file | Right-click file in Explorer → **Code Merge: Add File** |
| Add a folder | Right-click folder in Explorer → **Code Merge: Add Folder** |
| Add a selection | Select code → right-click → **Code Merge: Add Selection** |

### Viewing & exporting

Open the **Code Merge** view from the Activity Bar to see all selected
items. From there you can:

- **Preview** (`$(open-preview)`) — opens the merged output as a
  read-only virtual document beside the current editor.
- **Copy** (`$(copy)`) — copies the full merged output to the clipboard.
- **Clear** (`$(clear-all)`) — removes every item for the current
  workspace.

Clicking any item in the tree opens its source file. For selections,
the file opens scrolled to and highlighting the recorded range.

### Managing ignore rules

| Action | How |
|---|---|
| Open ignore settings | Command Palette → **Code Merge: Open Ignore Settings** |
| Reload ignore rules | Command Palette or view title → **Code Merge: Reload Ignore Rules** |
| Ignore a path | Right-click file/folder in Explorer → **Code Merge: Ignore This Path** |
| Edit `.code-mergeignore` | Add gitignore-style patterns manually at the workspace root. |

### Example output

````markdown
// ────────────────────────────────────────────────────────────
// Project structure — my-api
// ────────────────────────────────────────────────────────────

my-api/
├── src/
│   ├── index.ts  [full]
│   ├── routes/
│   │   └── auth.ts  [L10-L25, L40-L50]
│   └── db.ts  [full]
└── README.md  [full]

// ────────────────────────────────────────────────────────────
// src/index.ts (typescript) — file
// ────────────────────────────────────────────────────────────
import express from 'express';
...

// ────────────────────────────────────────────────────────────
// src/routes/auth.ts [L10-L25] (typescript) — selection
// ────────────────────────────────────────────────────────────
export function login(req, res) {
  ...
}
````

---

## ⌨️ Keyboard shortcuts

| Command | Windows / Linux | macOS |
|---|---|---|
| Add Selection | `Ctrl+Alt+M` | `Cmd+Alt+M` |
| Add File | `Ctrl+Alt+F` | `Cmd+Alt+F` |
| Add Folder | `Ctrl+Alt+Shift+F` | `Cmd+Alt+Shift+F` |
| Open Preview | `Ctrl+Alt+P` | `Cmd+Alt+P` |
| Copy Merged Content | `Ctrl+Alt+C` | `Cmd+Alt+C` |

All shortcuts can be rebound from **Keyboard Shortcuts** (`Ctrl+K Ctrl+S`).

---

## ⚙️ Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| `code-merge.ignore.additionalDirs` | `string[]` | `[]` | Extra directory names to skip on top of the built-in list. |
| `code-merge.ignore.additionalExtensions` | `string[]` | `[]` | Extra file extensions to skip, e.g. `pdf`, `zip`, `parquet`. |
| `code-merge.ignore.additionalFilePatterns` | `string[]` | `[]` | Extra gitignore-style patterns, e.g. `*.log`, `secrets/*`. |
| `code-merge.ignore.dotDirAllowlist` | `string[]` | `[".github", ".gitlab", ".devcontainer"]` | Dot-directories that should be traversed instead of skipped. |
| `code-merge.ignore.file` | `string` | `.code-mergeignore` | Per-project ignore file (gitignore syntax). Leave empty to disable. |
| `code-merge.ignore.useGitignore` | `boolean` | `false` | Also honor the workspace `.gitignore` file. |
| `code-merge.maxFileSizeMB` | `number` | `5` | Maximum size (in MB) for a file or selection to be merged. |
| `code-merge.autoOpenPreview` | `boolean` | `true` | Automatically open the merged preview when items are added, if it isn't already open. |

Built-in ignore rules still cover common directories, extensions,
filenames, symlinks, and the configured size cap.

---

## 📋 Requirements

- VS Code **1.85.0** or newer.
- The extension bundles the `ignore` npm package; no user-installed
  dependencies are required.
