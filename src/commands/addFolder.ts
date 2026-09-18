import * as vscode from 'vscode';
import * as path from 'path';
import { MergeStore } from '../core/MergeStore';
import { newId } from '../core/ids';
import { toRelative } from '../core/relativePath';
import { MergeItem } from '../core/types';
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

  const visited = new Set<string>();

  async function walk(dir: vscode.Uri): Promise<void> {
    if (token.isCancellationRequested) {
      return;
    }

    const key = dir.fsPath;
    if (visited.has(key)) {
      return;
    }
    visited.add(key);

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

      if (type & vscode.FileType.SymbolicLink) {
        continue;
      }

      const child = vscode.Uri.joinPath(dir, name);

      if (type & vscode.FileType.Directory) {
        if (shouldSkipDir(name)) {
          continue;
        }
        await walk(child);
      } else if (type & vscode.FileType.File) {
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

async function confirmIgnoredRoot(
  folderName: string
): Promise<boolean> {
  const pick = await vscode.window.showWarningMessage(
    `Code Merge: "${folderName}" is normally ignored. Add it anyway?`,
    { modal: true },
    'Add Anyway'
  );
  return pick === 'Add Anyway';
}

export function addFolderCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand(
    'code-merge.addFolder',
    async (uri?: vscode.Uri) => {
      if (!uri) {
        vscode.window.showWarningMessage('Code Merge: no folder selected.');
        return;
      }

      let stat: vscode.FileStat;
      try {
        stat = await vscode.workspace.fs.stat(uri);
      } catch {
        vscode.window.showWarningMessage(
          'Code Merge: cannot access the selected folder.'
        );
        return;
      }

      if (stat.type !== vscode.FileType.Directory) {
        vscode.window.showWarningMessage(
          'Code Merge: the selection is not a folder.'
        );
        return;
      }

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {
        vscode.window.showWarningMessage(
          'Code Merge: the selected folder is not inside a workspace.'
        );
        return;
      }

      const rootName = path.basename(uri.fsPath);
      if (shouldSkipDir(rootName)) {
        const proceed = await confirmIgnoredRoot(rootName);
        if (!proceed) {
          return;
        }
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Code Merge: scanning "${rootName}"…`,
          cancellable: true,
        },
        async (progress, token) => {
          const files = await collectFiles(uri, token);

          if (token.isCancellationRequested) {
            return;
          }

          if (!files.length) {
            vscode.window.showInformationMessage(
              `Code Merge: no suitable files found in "${rootName}".`
            );
            return;
          }

          const pending: MergeItem[] = [];
          let readErrors = 0;
          let totalChars = 0;

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
              // Prefer the in-memory editor buffer when the file is open,
              // so unsaved edits are picked up. Fall back to disk otherwise.
              const openDoc = vscode.workspace.textDocuments.find(
                d => d.uri.scheme === 'file' && d.uri.fsPath === f.uri.fsPath
              );

              let content: string;

              if (openDoc) {
                content = openDoc.getText();

                if (Buffer.byteLength(content, 'utf8') > MAX_FILE_SIZE) {
                  readErrors++;
                  continue;
                }
              } else {
                const bytes = await vscode.workspace.fs.readFile(f.uri);
                content = Buffer.from(bytes).toString('utf8');
              }

              if (content.includes('\u0000')) {
                readErrors++;
                continue;
              }

              const ext = path.extname(f.uri.fsPath).slice(1) || 'txt';

              pending.push({
                id: newId(),
                kind: 'file',
                fsPath: f.uri.fsPath,
                relativePath: toRelative(f.uri),
                workspaceFolder: workspaceFolder.uri.toString(),
                language: ext,
                content,
                addedAt: Date.now(),
              });

              totalChars += content.length;
            } catch {
              readErrors++;
            }
          }

          if (token.isCancellationRequested) {
            vscode.window.setStatusBarMessage(
              'Code Merge: folder scan cancelled.',
              3000
            );
            return;
          }

          if (!pending.length) {
            vscode.window.showInformationMessage(
              `Code Merge: no readable files in "${rootName}".`
            );
            return;
          }

          store.setActiveWorkspace(workspaceFolder.uri);

          const { added, skipped } = store.addMany(pending);
          const skippedTotal = skipped + readErrors;

          vscode.window.setStatusBarMessage(
            `Code Merge: "${rootName}" → added ${added}, skipped ${skippedTotal} (${totalChars.toLocaleString()} chars)`,
            4000
          );
        }
      );
    }
  );
}