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

      for (const target of targets) {
        const stat = await vscode.workspace.fs.stat(target);
        if (stat.size > MAX_FILE_SIZE) {
          vscode.window.showWarningMessage(
            `Code Merge: file is too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB).`
          );
          return;
        }
        
        if (stat.type !== vscode.FileType.File) {
          skipped++;
          continue;
        }

        const bytes = await vscode.workspace.fs.readFile(target);
        const content = Buffer.from(bytes).toString('utf8');
        
        if (content.includes('\0')) {
          vscode.window.showWarningMessage(
            'Code Merge: binary files are not supported.'
          );
          return;
        }
        
        const ext = path.extname(target.fsPath).slice(1) || 'txt';

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(target);
        if (!workspaceFolder) {
          vscode.window.showWarningMessage(
            'Code Merge: the selected file is not inside a workspace.'
          );
          return;
        }

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

      const msg = `Code Merge: added ${added}, skipped ${skipped} (duplicates/folders)`;
      vscode.window.setStatusBarMessage(msg, 3000);
    }
  );
}