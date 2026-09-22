# Code Merge

> Select files, folders, or code snippets and merge them into a single
> live markdown preview — with a project tree, per-file headers, item
> counts, and configurable ignore rules. Perfect for feeding context to
> LLMs (ChatGPT, Claude, Copilot) or sharing code snapshots with your team.

[![GitHub](https://img.shields.io/badge/GitHub-ziadshalaby00-181717?logo=github)](https://github.com/ziadshalaby00/code-merge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-blue?logo=visualstudiocode)](https://code.visualstudio.com/)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/ziadshalaby00.code-merge?label=VS%20Code%20Marketplace&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=ziadshalaby00.code-merge)
[![Open VSX](https://img.shields.io/open-vsx/v/ziadshalaby00/code-merge?label=Open%20VSX)](https://open-vsx.org/extension/ziadshalaby00/code-merge)

<p align="center">
  <img src="https://raw.githubusercontent.com/ziadshalaby00/code-merge/main/images/1.png" width="85%">
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/ziadshalaby00/code-merge/main/images/2.png" width="48%">
  <img src="https://raw.githubusercontent.com/ziadshalaby00/code-merge/main/images/3.png" width="48%">
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/ziadshalaby00/code-merge/main/images/4.png" width="48%">
  <img src="https://raw.githubusercontent.com/ziadshalaby00/code-merge/main/images/5.png" width="48%">
</p>

---

## ✨ Features

- **📁 Add files / folders / selections** — right-click in the Explorer,
  select code in the editor, or use a keyboard shortcut. Folder scans
  follow smart ignore rules (`node_modules`, `.git`, `dist`, binaries,
  lockfiles, …) and skip symlinks to avoid infinite loops.
- **🌲 Project tree** — every merged output starts with an ASCII tree of
  the selected items, including line ranges for selections.
- **🪟 Virtual preview** — a live, in-memory document. Nothing is written
  to disk; the preview updates as you add, remove, or edit items.
- **🔄 Live sync** — edits (including unsaved ones) and external changes
  (git pull, other editors) are picked up automatically. Deleted or
  oversized files are dropped from the list.
- **🛡️ Preview size guard** — the preview closes itself if the merged
  output grows past `code-merge.maxPreviewSizeChars` while you're
  editing, so a runaway edit can't freeze the editor. Reopen it
  manually, or use **Copy Merged Content**.
- **📋 One-click copy** — copy the entire merged content to the clipboard.
- **🔒 Workspace isolation** — each workspace folder gets its own item
  list; the preview follows the active workspace as you switch between
  multi-root folders.
- **🗂️ Workspaces view** — a dedicated sidebar view below Selected Items
  listing every workspace with tracked items. Click a workspace to make
  it active, or hit the `🗑` button to clear only that workspace's
  items — the active workspace and every other workspace stay untouched.
- **⚙️ Configurable ignore rules** — extend the built-in lists via
  VS Code settings, a `.code-mergeignore` file (gitignore syntax), or
  by enabling `.gitignore` support. Ignore files are read from each
  workspace folder's root only.
- **🚀 Auto-open preview** — opens beside the current editor the first
  time you add an item. Disable with `code-merge.autoOpenPreview`.
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
- **Clear** (`$(clear-all)`) — removes every item for the active
  workspace.

Clicking any item in the tree opens its source file. For selections,
the file opens scrolled to and highlighting the recorded range.

In a multi-root workspace, the separate **Workspaces** view (below
Selected Items) lets you switch between workspaces and clear them
individually — see **Switching workspaces** for details.

### Switching workspaces (multi-root)

Below the **Selected Items** view, the **Workspaces** view lists every
workspace folder that currently has tracked items:

- The **active workspace** is shown first, marked with `· active` and
  an open-folder icon.
- **Click a workspace** to switch to it — both the Selected Items view
  and the merged preview update immediately.
- **Hit the `🗑` button** on any workspace to clear its tracked items.
  The active workspace and every other workspace stay untouched.

A workspace disappears from this list automatically once it has no
tracked items left. Removing a folder from a multi-root workspace also
prunes its tracked items, so the view never shows a "ghost" workspace.

### Managing ignore rules

| Action | How |
|---|---|
| Open ignore settings | Command Palette → **Code Merge: Open Ignore Settings** |
| Reload ignore rules | Command Palette or view title → **Code Merge: Reload Ignore Rules** |
| Ignore a path | Right-click file/folder in Explorer → **Code Merge: Ignore This Path** |
| Edit `.code-mergeignore` | Add gitignore-style patterns manually at the workspace root. |

> **Multi-root workspaces:** **Add File** works on one workspace folder
> at a time — selecting files from more than one folder in a single
> action will be rejected. Add them folder by folder.

> **Add Anyway and pattern-ignored folders:** If a folder is ignored by
> a *name* (`node_modules`, `dist`, `additionalDirs`, non-allowlisted
> dot-dirs), **Add Anyway** adds the non-ignored files inside it. If the
> folder is ignored by a *pattern* (from `.code-mergeignore`,
> `.gitignore`, or `additionalFilePatterns`), **Add Anyway** cannot add
> anything — the pattern matches every file underneath. Use
> **Code Merge: Add File** on specific files instead.

> **Ignore files are read from each workspace folder's root only.**
> `.code-mergeignore` and `.gitignore` (when
> `code-merge.ignore.useGitignore` is enabled) are resolved against the
> root of the workspace folder that owns the file being added. Nested
> ignore files are **not** read.

> **Note:** Adding a path to your ignore rules doesn't remove items
> already in the merge list. Re-run **Add Folder** on an ancestor folder
> to prune — the status bar reports how many were removed (e.g.
> `removed 3 now-ignored`).

### Example output

````markdown
// ────────────────────────────────────────────────────────────
// Project structure — my-api (3 files, 2 selections)
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
| `code-merge.maxPreviewSizeChars` | `number` | `1000000` | Maximum total size (characters) of the merged output. If live edits push the content past this limit, the preview closes automatically to keep the editor responsive. It can be reopened manually. |

Built-in ignore rules still cover common directories, extensions,
filenames, symlinks, and the configured size cap.

---

## ⚡ Performance tips

Code Merge is designed to stay responsive even on large projects, but
a few habits keep it snappy in the tens-of-thousands-of-lines range.

### Keep the merged output under the preview limit

The `code-merge.maxPreviewSizeChars` guard (default **1,000,000
characters**) closes the preview automatically when live edits push
the merged content past the limit — this is what protects your editor
from a runaway re-render. If you routinely hit this limit:

- **Track selections instead of whole files.** `Add Selection` on the
  function or class you actually need is dramatically cheaper than
  `Add File` on a 3,000-line source file, and it's usually what you
  want to feed to an LLM anyway.
- **Trim your tracked list.** Remove entries you no longer need. Every
  item participates in the merged output and the project tree.
- **Split the work.** If you're feeding context to an LLM, merge one
  module at a time and use `Copy Merged Content` — you don't have to
  keep the preview open.

### Watch out for very large files

The `code-merge.maxFileSizeMB` setting (default **5 MB**) skips
individual files that are too big, but a 4 MB file still contributes
its full content to the preview. If you know a file is generated or
vendored, prefer:

- Adding it to `.code-mergeignore` (or your project's `.gitignore`
  with `code-merge.ignore.useGitignore` enabled), or
- Using `Code Merge: Ignore This Path` from the Explorer's right-click
  menu.

### Prefer folder-level add with a good ignore list

`Add Folder` walks the tree once and applies your ignore rules — this
is much faster than adding files one by one, and it respects
`node_modules`, `.git`, `dist`, lockfiles, binaries, and anything you
add to `.code-mergeignore`. A well-maintained ignore file is the
single biggest performance lever in a large repo.

### Closing the preview is not the same as clearing the list

If the preview is closed but items are still tracked, edits in those
files still trigger live-sync work in the background. If you're not
actively using a merge, use **Clear All** (or **Clear Workspace** in
the Workspaces view) rather than just closing the tab.

### When the preview gets slow, copy instead

For a large merge you only need once, use **Copy Merged Content**
(`Ctrl+Alt+C` / `Cmd+Alt+C`) instead of keeping the preview tab open.
The copy is rendered once; the preview re-renders on every relevant
edit.

## 📋 Requirements

- VS Code **1.85.0** or newer.
- The extension bundles the `ignore` npm package; no user-installed
  dependencies are required.
