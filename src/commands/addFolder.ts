import * as vscode from 'vscode';
import * as path from 'path';
import { MergeStore } from '../core/MergeStore';
import { newId } from '../core/ids';
import { toRelative } from '../core/relativePath';
import {
  shouldSkipDir,
  shouldSkipFile,
  MAX_FILE_SIZE,
} from '../core/ignoreRules';

interface Collected {
  uri: vscode.Uri;
  size: number;
}

async function collectFiles(
  root: vscode.Uri,
  token: vscode.CancellationToken
): Promise<Collected[]> {
  const result: Collected[] = [];

  async function walk(dir: vscode.Uri): Promise<void> {
    if (token.isCancellationRequested) {
      return;
    }

    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(dir);
    } catch {
      return;
    }

    for (const [name, type] of entries) {
      if (token.isCancellationRequested) {
        return;
      }

      const child = vscode.Uri.joinPath(dir, name);

      if (type === vscode.FileType.Directory) {
        if (shouldSkipDir(name)) {
          continue;
        }
        await walk(child);
      } else if (type === vscode.FileType.File) {
        const ext = path.extname(name).slice(1);
        if (shouldSkipFile(name, ext)) {
          continue;
        }

        let stat: vscode.FileStat;
        try {
          stat = await vscode.workspace.fs.stat(child);
        } catch {
          continue;
        }

        if (stat.size > MAX_FILE_SIZE) {
          continue;
        }

        result.push({ uri: child, size: stat.size });
      }
    }
  }

  await walk(root);
  return result;
}

export function addFolderCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand(
    'code-merge.addFolder',
    async (uri?: vscode.Uri) => {
      if (!uri) {
        vscode.window.showWarningMessage('Code Merge: no folder selected.');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Code Merge: scanning folder…',
          cancellable: true,
        },
        async (progress, token) => {
          const files = await collectFiles(uri, token);

          if (token.isCancellationRequested) {
            return;
          }

          if (!files.length) {
            vscode.window.showInformationMessage(
              'Code Merge: no suitable files found in this folder.'
            );
            return;
          }

          let added = 0;
          let skipped = 0;
          let total = 0;

          for (let i = 0; i < files.length; i++) {
            if (token.isCancellationRequested) {
              break;
            }

            const f = files[i];

            progress.report({
              increment: 100 / files.length,
              message: `${i + 1} / ${files.length}`,
            });

            try {
              const bytes = await vscode.workspace.fs.readFile(f.uri);
              const content = Buffer.from(bytes).toString('utf8');

              if (content.includes('\u0000')) {
                skipped++;
                continue;
              }

              const ext = path.extname(f.uri.fsPath).slice(1) || 'txt';

              const ok = store.add({
                id: newId(),
                kind: 'file',
                fsPath: f.uri.fsPath,
                relativePath: toRelative(f.uri),
                language: ext,
                content,
                addedAt: Date.now(),
              });

              if (ok) {
                added++;
                total += content.length;
              } else {
                skipped++;
              }
            } catch {
              skipped++;
            }
          }

          const folderName = path.basename(uri.fsPath);
          vscode.window.setStatusBarMessage(
            `Code Merge: "${folderName}" → added ${added}, skipped ${skipped} (${total.toLocaleString()} chars)`,
            4000
          );
        }
      );
    }
  );
}