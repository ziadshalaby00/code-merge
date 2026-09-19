## [0.4.0] — 2026-09-19

### Added
- **Item count in preview status messages** — folder scans now report
  how many previously-tracked items were removed for now matching an
  ignore rule (e.g. `added 5, skipped 2, removed 3 now-ignored`).
- **Add Anyway confirmation for ignored folders** — when adding a
  folder that's normally ignored, the dialog now explains what will
  actually happen:
  - for **name-ignored** folders (`node_modules`, `dist`, anything in
    `code-merge.ignore.additionalDirs`, or non-allowlisted dot-dirs),
    the non-ignored files inside will still be added;
  - for **pattern-ignored** folders (`docs/` in `.code-mergeignore`,
    `.gitignore`, or `code-merge.ignore.additionalFilePatterns`),
    Add Anyway will not add anything, because the pattern matches
    every file underneath.
- **Ignored-file warning for Add File** — adding one or more files
  that are normally ignored now asks for confirmation once per batch,
  matching the Add Folder behaviour. Declining skips them; accepting
  adds them.

### Changed
- **`Add File` now rejects selections that span multiple workspace
  folders.** Previously, a multi-root selection applied the first
  workspace's ignore rules to every file, and only the first
  workspace's items were visible in the tree and preview — the rest
  were added silently but stayed hidden. Add files from one workspace
  folder at a time.
- **`Add Selection` no longer reloads ignore rules.** It only needs
  the configured max file size, which it now reads directly from
  settings. This avoids touching the pattern matcher for a command
  that doesn't use it.
- **Ignore-rule reloads on startup and on settings changes now happen
  exactly once.** Previously they fired twice — once from `FileSync`
  and once from `extension.ts`.

### Fixed
- **Ignore rules now resolve against the workspace folder actually
  being scanned**, not always the first folder in a multi-root
  workspace. Affects both `.code-mergeignore` and `.gitignore`.
- **Auto-open preview now triggers even when every item in a batch
  was a duplicate** — previously, re-adding an already-tracked folder
  after manually closing the preview tab would silently do nothing.
- **Auto-open preview now locks/pins the tab the same way the manual
  "Open Preview" command does**, and restores focus to the editor
  you were working in.
- **Already-tracked items are now pruned when a rescanned folder
  matches a newly-added ignore rule.** Previously, adding a path to
  `.code-mergeignore` only prevented *future* additions; items already
  in the merge list stayed until manually removed.
- **Prune now runs after the Add Anyway confirmation.** Previously
  the prune ran before the user was asked; cancelling the prompt
  still removed already-tracked items.
- **Prune is now scoped to the folder being added.** Adding `src/`
  no longer removes tracked items under `dist/`, even when `dist/`
  is ignored.
- **Folder-skip diagnostics log correctly.** `shouldSkipDir` was
  returning early for built-in / additional / dot-dir matches without
  writing to the Code Merge output channel; every skip reason now
  logs.
- **Folder-ignore reason detection now prefers patterns over
  built-in names.** When a folder is both built-in ignored (e.g.
  `dist`) and matched by an explicit pattern, the confirmation dialog
  now correctly describes the pattern behaviour.

### Notes
- **`Add Folder` pruning happens before the scan completes.** If you
  cancel the folder scan after confirming, any already-tracked items
  under that folder that now match an ignore rule will already have
  been removed.
- **Ignore files are read from each workspace folder's root only.**
  `.code-mergeignore` (and `.gitignore`, when
  `code-merge.ignore.useGitignore` is enabled) are resolved against
  the root of the workspace folder that owns the file being added —
  never against nested subfolders, and never against the directory
  that contains a `.code-workspace` file. In a multi-root workspace,
  each folder uses its own ignore files.

---

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
- **Item count in the structure header** — the merged output now shows a
  summary like `Project structure — my-api (12 files, 3 selections)`
  so you can see at a glance how much is being merged.
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