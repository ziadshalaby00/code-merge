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
      const warnings = new Set<string>();

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

        store.setActiveWorkspace(workspaceFolder.uri);

        const ok = store.add({
          id: newId(),
          kind: 'file',
          fsPath: target.fsPath,
          relativePath: toRelative(target),
          workspaceFolder: workspaceFolder.uri.toString(),
          language: ext,
          content,
          addedAt: Date.now(),
        });

        ok ? added++ : skipped++;
      }

      for (const w of warnings) {
        vscode.window.showWarningMessage(`Code Merge: ${w}`);
      }

      const msg = `Code Merge: added ${added}, skipped ${skipped} (duplicates/folders/errors)`;
      vscode.window.setStatusBarMessage(msg, 3000);
    }
  );
}