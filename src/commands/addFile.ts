import * as vscode from 'vscode';
import * as path from 'path';
import { MergeStore } from '../core/MergeStore';
import { newId } from '../core/ids';
import { toRelative } from '../core/relativePath';
import { IgnoreRules } from '../core/ignoreRules';
import { ensurePreviewOpen } from '../views/previewOpener';

export function addFileCommand(
  store: MergeStore,
  rules: IgnoreRules
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'code-merge.addFile',
    async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
      const targets = uris && uris.length ? uris : uri ? [uri] : [];

      if (!targets.length) {
        vscode.window.showWarningMessage('Code Merge: no file selected.');
        return;
      }

      // Reject multi-workspace selections up front. Add File is a
      // single-workspace operation: ignore rules are resolved against one
      // workspace, and only that workspace's items are visible in the tree
      // and preview. Letting a mixed selection through would apply the wrong
      // rules to some files and silently hide others.
      const workspaceUris = new Set<string>();
      const workspaceNames: string[] = [];
      for (const target of targets) {
        const folder = vscode.workspace.getWorkspaceFolder(target);
        if (!folder) {
          continue;
        }
        const key = folder.uri.toString();
        if (!workspaceUris.has(key)) {
          workspaceUris.add(key);
          workspaceNames.push(folder.name);
        }
      }

      if (workspaceUris.size > 1) {
        vscode.window.showWarningMessage(
          `Code Merge: selected files span ${workspaceUris.size} workspace folders ` +
            `(${workspaceNames.join(', ')}). Add files from one workspace at a time.`
        );
        return;
      }

      // Use the first target that's actually inside a workspace to load
      // ignore rules — don't bail out just because targets[0] happens to
      // be outside one; other targets in a multi-select may still be valid.
      const firstWorkspaceFolder = targets
        .map(t => vscode.workspace.getWorkspaceFolder(t))
        .find((f): f is vscode.WorkspaceFolder => !!f);

      if (!firstWorkspaceFolder) {
        vscode.window.showWarningMessage(
          'Code Merge: none of the selected files are inside a workspace.'
        );
        return;
      }

      await rules.reload(firstWorkspaceFolder.uri);

      let added = 0;
      let skipped = 0;
      let lastAddedLabel = '';
      const warnings = new Set<string>();

      let firstValidWorkspace: vscode.WorkspaceFolder | undefined;

      // Pre-scan: figure out which targets are covered by an ignore rule,
      // so we can ask the user once (not per-file) before adding any of
      // them.
      const ignoredFsPaths = new Set<string>();
      for (const target of targets) {
        try {
          const stat = await vscode.workspace.fs.stat(target);
          if (stat.type !== vscode.FileType.File) {
            continue;
          }
          const targetWorkspace = vscode.workspace.getWorkspaceFolder(target);
          if (!targetWorkspace) {
            continue;
          }
          if (rules.isPathIgnored(toRelative(target))) {
            ignoredFsPaths.add(target.fsPath);
          }
        } catch {
          // Unreadable target — let the main loop below report it.
        }
      }

      let allowIgnored = false;
      if (ignoredFsPaths.size > 0) {
        const msg =
          ignoredFsPaths.size === 1
            ? 'Code Merge: 1 selected file is normally ignored. Add it anyway?'
            : `Code Merge: ${ignoredFsPaths.size} selected files are normally ignored. Add them anyway?`;
        const pick = await vscode.window.showWarningMessage(
          msg,
          { modal: true },
          'Add Anyway'
        );
        allowIgnored = pick === 'Add Anyway';
      }

      for (const target of targets) {
        let stat: vscode.FileStat;
        try {
          stat = await vscode.workspace.fs.stat(target);
        } catch {
          skipped++;
          continue;
        }

        if (stat.type !== vscode.FileType.File) {
          skipped++;
          continue;
        }

        // Reject ignored files before doing any further work (size check,
        // content read) — the user already declined to add them.
        if (ignoredFsPaths.has(target.fsPath) && !allowIgnored) {
          skipped++;
          continue;
        }

        if (stat.size > rules.maxFileSize) {
          warnings.add(
            `Some files exceeded the max size (${rules.maxFileSize / 1024 / 1024} MB) and were skipped.`
          );
          skipped++;
          continue;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(target);
        if (!workspaceFolder) {
          warnings.add(
            'Some files are not inside a workspace and were skipped.'
          );
          skipped++;
          continue;
        }

        if (!firstValidWorkspace) {
          firstValidWorkspace = workspaceFolder;
        }

        const openDoc = vscode.workspace.textDocuments.find(
          d => d.uri.scheme === 'file' && d.uri.fsPath === target.fsPath
        );

        let content: string;

        if (openDoc) {
          content = openDoc.getText();

          if (Buffer.byteLength(content, 'utf8') > rules.maxFileSize) {
            warnings.add(
              `Some files exceeded the max size (${rules.maxFileSize / 1024 / 1024} MB) and were skipped.`
            );
            skipped++;
            continue;
          }
        } else {
          let bytes: Uint8Array;
          try {
            bytes = await vscode.workspace.fs.readFile(target);
          } catch {
            skipped++;
            continue;
          }
          content = Buffer.from(bytes).toString('utf8');
        }

        if (content.includes('\0')) {
          warnings.add('Binary files are not supported and were skipped.');
          skipped++;
          continue;
        }

        const ext = path.extname(target.fsPath).slice(1) || 'txt';
        const relativePath = toRelative(target);

        const ok = store.add({
          id: newId(),
          kind: 'file',
          fsPath: target.fsPath,
          relativePath,
          workspaceFolder: workspaceFolder.uri.toString(),
          language: ext,
          content,
          addedAt: Date.now(),
        });

        if (ok) {
          added++;
          lastAddedLabel = relativePath;
        } else {
          skipped++;
        }
      }

      if (firstValidWorkspace) {
        store.setActiveWorkspace(firstValidWorkspace.uri);
      }

      for (const w of warnings) {
        vscode.window.showWarningMessage(`Code Merge: ${w}`);
      }

      // Auto-open the preview whenever the store has items — even if
      // everything in this batch was a duplicate, the user still
      // expects to see the preview if it got closed.
      if (store.count > 0) {
        void ensurePreviewOpen(store);
      }

      if (added && !skipped) {
        const msg =
          added === 1
            ? `Code Merge: added ${lastAddedLabel}`
            : `Code Merge: added ${added} files`;
        vscode.window.setStatusBarMessage(msg, 3000);
        return;
      }

      if (!added && skipped) {
        const switched = firstValidWorkspace
          ? ` — switched to "${firstValidWorkspace.name}"`
          : '';
        vscode.window.setStatusBarMessage(
          `Code Merge: nothing added (${skipped} skipped)${switched}`,
          3000
        );
        return;
      }

      vscode.window.setStatusBarMessage(
        `Code Merge: added ${added}, skipped ${skipped} (duplicates/folders/errors)`,
        3000
      );
    }
  );
}