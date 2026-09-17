# Changelog

All notable changes to the **Code Merge** extension are documented in
this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- `code-merge.ignore` setting for custom ignore patterns.
- Respect `.gitignore` files from the workspace.
- "Reveal in source" command from the tree view.
- Support for multi-cursor selections across multiple files.

---

## [0.1.0] — 2025-XX-XX

### Added
- **Add File** command via Explorer context menu and command palette.
- **Add Folder** command with recursive scan and progress notification.
- **Add Selection** command supporting multi-cursor selections.
- **Code Merge** activity bar view listing all selected items.
- **Auto-generated `.code-merge/merged.md`** with:
  - ASCII project tree including line ranges for selections.
  - Per-item headers showing path, language, and kind.
- **Copy Merged Content** command to copy the full output to the
  clipboard.
- **Clear All** command to remove items for the current workspace.
- **Delete Item** inline action in the tree view.
- **Per-workspace isolation** — each workspace folder keeps its own
  item list and merged file.
- **Built-in ignore rules** for directories, extensions, filenames, and
  a 5 MB size cap.
- **Keyboard shortcuts** for all major commands.
- **Debounced disk writes** to reduce I/O during rapid changes.

### Notes
- Requires VS Code 1.85.0 or newer.
- State is persisted via `workspaceState`; items survive restarts.