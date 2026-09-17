import * as vscode from 'vscode';
import * as path from 'path';
import { MergeStore } from '../core/MergeStore';
import { newId } from '../core/ids';
import { toRelative } from '../core/relativePath';
import { MAX_FILE_SIZE } from '../core/ignoreRules';

export function addFileCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand(
    'code-merge.addFile',
    async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
      const targets = uris && uris.length ? uris : uri ? [uri] : [];

      if (!targets.length) {
        vscode.window.showWarningMessage('Code Merge: no file selected.');
        return;
      }

      let added = 0;
      let skipped = 0;
      let lastAddedLabel = '';
      const warnings = new Set<string>();
      const successfulWorkspaces: vscode.Uri[] = [];

      for (const target of targets) {
        // Stat with guard: file may have been deleted/moved since the
        // context menu was opened.
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

        if (stat.size > MAX_FILE_SIZE) {
          warnings.add(
            `Some files exceeded the max size (${MAX_FILE_SIZE / 1024 / 1024} MB) and were skipped.`
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

        let bytes: Uint8Array;
        try {
          bytes = await vscode.workspace.fs.readFile(target);
        } catch {
          skipped++;
          continue;
        }

        const content = Buffer.from(bytes).toString('utf8');
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
          if (
            !successfulWorkspaces.some(
              w => w.toString() === workspaceFolder.uri.toString()
            )
          ) {
            successfulWorkspaces.push(workspaceFolder.uri);
          }
        } else {
          skipped++;
        }
      }

      // Only switch the active workspace once we know something was added.
      // Picks the workspace of the first successfully added file so
      // subsequent preview/copy target the right project.
      if (successfulWorkspaces.length) {
        store.setActiveWorkspace(successfulWorkspaces[0]);
      }

      for (const w of warnings) {
        vscode.window.showWarningMessage(`Code Merge: ${w}`);
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
        vscode.window.setStatusBarMessage(
          `Code Merge: nothing added (${skipped} skipped)`,
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