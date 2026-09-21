## [0.6.0] — 2026-09-21

### Added
- **Workspaces view** — a second sidebar view under the same Code Merge
  activity bar container, listing every workspace folder that currently
  has at least one tracked item. The active workspace is shown first
  with a `· active` marker, followed by the rest in alphabetical order.
- **Click a workspace to switch** — clicking a workspace in the
  Workspaces view makes it the active one; both the Selected Items view
  and the merged preview update immediately.
- **Per-workspace clear** — a `🗑` button on each workspace item clears
  only that workspace's tracked items, leaving the active workspace and
  every other workspace untouched.
- **`code-merge.switchWorkspace`** and **`code-merge.clearWorkspace`**
  commands (available in the Command Palette and the Workspaces view
  context menu).

### Changed
- **`MergeStore` gained three new helpers** — `getWorkspacesWithItems()`,
  `countForWorkspace(uri)`, and `clearWorkspace(uri)` — and the existing
  `clear()` now reuses `clearWorkspace()` internally.
- **`package.json` now contributes two views** under the `codeMerge`
  activity bar container: `codeMerge.items` ("Selected Items") and
  `codeMerge.workspaces` ("Workspaces"). The Workspaces view is declared
  after the items view, so it renders below it by default.
- **`view/item/context` menu entries now match on `viewItem` context
  values** (`mergeItem` and `mergeWorkspace`) so inline actions only
  appear on the correct tree item type.

### Fixed
- **Items belonging to a removed workspace are now pruned
  automatically.** When a folder is removed from a multi-root workspace,
  `onDidChangeWorkspaceFolders` clears any tracked items that belonged
  to it. Previously the Workspaces view kept showing the "ghost"
  workspace, and clicking it set an active workspace that no longer
  existed — the UI said "switched to …" while `openPreview` / `copyAll`
  / `clearAll` immediately answered "no active workspace".
- **Active workspace fallback is now more robust** — if the active
  workspace was just removed and at least one folder remains, the first
  remaining folder becomes active automatically.
- **Removed a duplicate `registerTreeDataProvider('codeMerge.items', …)`
  call** from `extension.ts` that was previously registered twice, which
  could swallow the first registration depending on VS Code version.

### Notes
- **`switchWorkspace` is intentionally not in the right-click menu.**
  Clicking the workspace item (or pressing Enter after focusing it)
  already switches — adding a redundant context-menu entry only adds
  noise.
- **Removed workspaces don't come back with their items.** If you
  remove a folder from a multi-root workspace and later add it back,
  its previously-tracked items are gone (session-only state, as
  documented for `0.2.0`).

---

## [0.5.0] — 2026-09-20

### Added
- **Preview size guard** — new setting `code-merge.maxPreviewSizeChars`
  (default 5,000,000 characters). If live edits push the merged output
  past this limit while the preview is open, the preview tab closes
  automatically and a one-time warning is shown, so further edits don't
  trigger a full re-render and slow down the editor. The preview can
  still be reopened manually; opening it again resets the warning so
  you'll be told if the content is still too large.

### Changed
- **`MergeStore` rewritten with indexed lookups.** Items are now stored
  in `idIndex` / `itemIndex` / `fsPathIndex` maps, plus a running
  per-workspace content-size counter. Duplicate detection, `hasFsPath`,
  `itemsByFsPath`, and `addMany` are now O(1) / O(n) instead of
  O(n) / O(n²) — noticeably faster when adding large folders.
- **Preview helpers consolidated.** `isPreviewOpen`, `lockAndKeep`,
  `ensurePreviewOpen`, `enforcePreviewSizeLimit`, and
  `resetPreviewSizeWarning` now all live in `views/previewOpener.ts`.
  `commands/openPreview.ts` only registers the command. This fixes a
  subtle issue where the auto-open path (Add File / Add Folder /
  Add Selection) bypassed the size-warning reset, which could leave the
  preview silently closing on every subsequent edit.
- **`FileSync` no longer imports from `commands/`.** The size guard is
  imported from `views/previewOpener` instead, restoring the
  `core → views` (never `core → commands`) dependency direction.
- **`IgnoreRules.reload()` is now atomic.** All new values (additional
  dirs, extensions, dot-dir allowlist, pattern matcher, max size) are
  built into local variables first, then swapped onto `this` in a single
  synchronous step. Any in-flight folder scan either sees the complete
  old snapshot or the complete new one — never a partially updated rule
  set.
- **`Add File` caches `fs.stat` results within a single invocation.**
  The pre-scan and the add loop now share one `statCache`, so each
  target's metadata is read at most once instead of twice. Noticeable
  on multi-select batches over network drives or large folders.
- **`Add Folder` no longer offers "Add Anyway" for pattern-ignored
  folders.** When a folder is matched by a pattern (from
  `.code-mergeignore`, `.gitignore`, or `additionalFilePatterns`),
  the confirmation dialog now shows only "OK" and returns immediately —
  because a pattern that matches the folder also matches everything
  underneath, so scanning would yield zero files anyway. Dialog text
  updated to say "No files from inside it will be added" instead of
  "Add Anyway will NOT add any files from inside it".
- **`escapeMd` in the tree tooltip simplified.** The markdown escape
  regex now only covers the characters that can actually appear inside
  the `**bold**` and `` `code` `` spans used in the tooltip
  (`\`, `` ` ``, `*`, `_`, `[`, `]`). Fewer backslashes leak into
  tooltip text for file paths that contain punctuation.

### Fixed
- **Selection ranges now survive overlapping edits correctly.**
  `adjustRange` recomputes `startLine` and `endLine` independently when
  an edit lands on top of a tracked range. If the edit's start falls
  inside the range, the new start anchors to the edit's start line; if
  the edit's replaced span reaches past the range's end, the new end
  anchors to where the inserted text ends. Previously the start was kept
  stale and only the end was adjusted, which could leave a selection
  pointing at the wrong lines after a partial overwrite.
- **Manual "Open Preview" now restores focus to the previous editor.**
  When the preview tab was already open, the command used to pin it and
  return without refocusing the editor you came from. It now reopens
  that editor at its original view column, matching the behaviour of
  the auto-open path.
- **Auto-open preview now locks/pins the tab the same way the manual
  "Open Preview" command does**, and restores focus to the editor you
  were working in.

### Notes
- **The size guard only ever closes a preview that a live edit pushed
  over the limit.** The first add of a large folder still opens the
  preview normally — the guard only kicks in on subsequent edits.
- **Ignore-rule reloads are atomic by design.** A folder scan that's
  already in flight when you change a setting will finish using the
  previous rule set; the next scan picks up the new one.

---

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