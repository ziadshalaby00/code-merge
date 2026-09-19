## [0.3.0] — 2025-XX-XX

### Added
- **Configurable ignore rules** — new settings under `code-merge.ignore.*`
  and `code-merge.maxFileSizeMB`.
- **`.code-mergeignore` support** — per-project ignore file using
  gitignore syntax.
- **Optional `.gitignore` integration** via `code-merge.ignore.useGitignore`.
- **New commands**:
  - `Code Merge: Open Ignore Settings`
  - `Code Merge: Reload Ignore Rules`
  - `Code Merge: Ignore This Path`
- **Auto-open preview** — the merged preview opens automatically the first
  time an item is added. Controlled by `code-merge.autoOpenPreview`.
- **Output channel** — `Code Merge` output channel for ignore-rule
  diagnostics.
- **`previewOpener.ts`** — helper to open the preview without stealing
  focus or re-opening it on every add.
- **`ignore` dependency** — gitignore-style pattern matching.

### Changed
- `IgnoreRules` is now a dynamic, reloadable service instead of static
  constants.
- `FileSync`, `addFile`, `addFolder`, and `addSelection` now use the shared
  `IgnoreRules` instance and respect runtime settings.
- `tsconfig.json` adds `esModuleInterop` and `skipLibCheck` for CJS
  interop.
- `package.json` now contributes configuration and depends on `ignore`.
- Version bumped to `0.3.0`.

### Fixed
- Ignore patterns now match relative to the workspace root even when
  scanning a subfolder.
- Dot-directory allowlist is configurable while preserving the default
  `.github`, `.gitlab`, `.devcontainer` behaviour.

---

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