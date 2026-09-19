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

      await rules.reload();

      let added = 0;
      let skipped = 0;
      let lastAddedLabel = '';
      const warnings = new Set<string>();

      let firstValidWorkspace: vscode.WorkspaceFolder | undefined;

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

      // Auto-open the preview the first time something gets added.
      if (added > 0) {
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