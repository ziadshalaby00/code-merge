## [0.2.0] — 2025-XX-XX

### Added
- **Live sync** — item content is kept in step with the file system and
  the active editor. Edits (including unsaved ones) and external changes
  (git pull, other editors) are reflected in the preview automatically.
- **Editor-buffer awareness** — adding a file reads the in-memory editor
  buffer when available, so unsaved edits show up immediately.
- **Dynamic selection ranges** — selection ranges shift automatically as
  lines are added or removed around them, and clamp (or drop) when the
  file is shortened externally.
- **Symlink safety** — folder scans skip symlinks and track visited
  directories, preventing infinite loops on cyclic links.
- **Size cap on selections** — `Add Selection` now rejects selections
  larger than 5 MB, matching the file-level cap.
- **Selection-aware tree clicks** — clicking a selection item opens the
  source file scrolled to and highlighting its recorded line range.
- **Clear All** action on the preview tab's title bar.
- **Per-file watchers** — only tracked files are watched, avoiding
  inotify exhaustion on large monorepos.

### Changed
- The merged output is now an in-memory **virtual document** served
  under the `code-merge:` URI scheme. Nothing is written to disk.
- **Open Preview** follows the active workspace: the open tab refreshes
  when you switch between folders.
- **Add File** now switches the active workspace even when the target is
  already in the list.

### Removed
- On-disk `.code-merge/merged.md` and the debounced disk-write pipeline.
- `workspaceState` persistence for items and the active workspace.
- `MergeStore` dependency on `ExtensionContext`.

### Notes
- **Breaking:** selections no longer survive a VS Code restart.
- **Breaking:** `.code-merge/merged.md` is no longer generated; use
  **Copy Merged Content** to export the merged output.

---

## [0.1.0] — 2025-XX-XX
...