# Changelog

All notable changes to the **Code Merge** extension are documented in
this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Live sync** — item content is kept in step with the file system and
  the active editor. Edits (including unsaved ones) and external changes
  (git pull, other editors) are reflected in the preview automatically.
- **Symlink safety** — folder scans skip symlinks and track visited
  directories, preventing infinite loops on cyclic links.
- **Size cap on selections** — `Add Selection` now rejects selections
  larger than 5 MB, matching the file-level cap.
- **Selection-aware tree clicks** — clicking a selection item opens the
  source file scrolled to and highlighting its recorded line range.
- **Clear All** action on the preview tab's title bar.

### Changed
- The merged output is now an in-memory **virtual document** served
  under the `code-merge:` URI scheme. Nothing is written to disk.
- **Open Preview** follows the active workspace: the open tab refreshes
  when you switch between folders.
- **Add File** now switches the active workspace even when the target is
  already in the list, matching `Add Selection` and `Add Folder`.
- File-system watcher events are ignored while the matching file is open
  with unsaved changes, so in-flight edits are never clobbered by an
  on-disk version.

### Removed
- On-disk `.code-merge/merged.md` and the debounced disk-write pipeline.
- `workspaceState` persistence for items and the active workspace.
  Selections are now session-only and reset when VS Code restarts.
- `MergeStore` dependency on `ExtensionContext`.

### Notes
- **Breaking:** selections no longer survive a VS Code restart.
- **Breaking:** `.code-merge/merged.md` is no longer generated; use
  **Copy Merged Content** to export the merged output.

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
- **Copy Merged Content** command to copy the full output to the
  clipboard.
- **Clear All** command to remove items for the current workspace.
- **Delete Item** inline action in the tree view.
- **Per-workspace isolation** — each workspace folder keeps its own
  item list.
- **Built-in ignore rules** for directories, extensions, filenames, and
  a 5 MB size cap.
- **Keyboard shortcuts** for all major commands.

### Notes
- Requires VS Code 1.85.0 or newer.