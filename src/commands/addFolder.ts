import * as vscode from 'vscode';
import * as path from 'path';
import { MergeStore } from '../core/MergeStore';
import { newId } from '../core/ids';
import { toRelative } from '../core/relativePath';
import { MergeItem } from '../core/types';
import { IgnoreRules } from '../core/ignoreRules';
import type { DirSkipReason } from '../core/ignoreRules';
import { ensurePreviewOpen } from '../views/previewOpener';

interface Collected {
  uri: vscode.Uri;
  size: number;
}

/**
 * Returns the POSIX-style path of `uri` relative to `workspaceRoot`.
 * Returns '' when `uri` is the workspace root itself.
 */
function relToWorkspace(
  uri: vscode.Uri,
  workspaceRoot: vscode.Uri
): string {
  const rel = path.relative(workspaceRoot.fsPath, uri.fsPath);
  return rel.replace(/\\/g, '/');
}

async function collectFiles(
  root: vscode.Uri,
  workspaceRoot: vscode.Uri,
  token: vscode.CancellationToken,
  rules: IgnoreRules
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

      // IMPORTANT: always compute the path relative to the workspace
      // root, so patterns like `src/**` and `**/generated/**` match
      // even when the user started the scan from a subfolder.
      const rel = relToWorkspace(child, workspaceRoot);

      if (type & vscode.FileType.Directory) {
        if (rules.shouldSkipDir(name, rel)) {
          continue;
        }
        await walk(child);
      } else if (type & vscode.FileType.File) {
        const ext = path.extname(name).slice(1);
        if (rules.shouldSkipFile(name, ext, rel)) {
          continue;
        }

        let stat: vscode.FileStat;
        try {
          stat = await vscode.workspace.fs.stat(child);
        } catch {
          continue;
        }

        if (stat.size > rules.maxFileSize) {
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
  folderName: string,
  reason: DirSkipReason
): Promise<boolean> {
  if (reason === 'pattern') {
    const detail =
      `"${folderName}" is ignored by a pattern (from .code-mergeignore, ` +
      `.gitignore, or additionalFilePatterns).\n\n` +
      `No files from inside it will be added, because the pattern ` +
      `matches everything under this folder. To add a specific file, ` +
      `use "Code Merge: Add File" on it instead.`;

    await vscode.window.showWarningMessage(
      `Code Merge: ${detail}`,
      { modal: true },
      'OK'
    );

    // Nothing will be added either way, so there's no point scanning.
    return false;
  }

  const detail =
    `"${folderName}" is normally ignored.\n\n` +
    `Add Anyway will add the non-ignored files inside it ` +
    `(binaries, lockfiles, and other ignored files will still be skipped).`;

  const pick = await vscode.window.showWarningMessage(
    `Code Merge: ${detail}`,
    { modal: true },
    'Add Anyway'
  );
  return pick === 'Add Anyway';
}

export function addFolderCommand(
  store: MergeStore,
  rules: IgnoreRules
): vscode.Disposable {
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

      // Refresh rules from settings + ignore file before scanning.
      await rules.reload(workspaceFolder.uri);

      const rootName = path.basename(uri.fsPath);
      const rootRel = relToWorkspace(uri, workspaceFolder.uri);

      const rootReason = rules.getDirSkipReason(rootName, rootRel);
      if (rootReason) {
        const proceed = await confirmIgnoredRoot(rootName, rootReason);
        if (!proceed) {
          return;
        }
      }

      // Drop any already-tracked item that's now covered by an ignore
      // rule (e.g. the user just added its path to .code-mergeignore).
      // Only prunes on an explicit Add — see prior discussion.
      const isUnderRoot = (rel: string): boolean =>
        rootRel === '' ||
        rel === rootRel ||
        rel.startsWith(rootRel + '/');

      const prunedCount = store.prune(
        workspaceFolder.uri,
        item => isUnderRoot(item.relativePath) && rules.isPathIgnored(item.relativePath)
      );

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Code Merge: scanning "${rootName}"…`,
          cancellable: true,
        },
        async (progress, token) => {
          const files = await collectFiles(
            uri,
            workspaceFolder.uri,
            token,
            rules
          );

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
              const openDoc = vscode.workspace.textDocuments.find(
                d => d.uri.scheme === 'file' && d.uri.fsPath === f.uri.fsPath
              );

              let content: string;

              if (openDoc) {
                content = openDoc.getText();

                if (Buffer.byteLength(content, 'utf8') > rules.maxFileSize) {
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

          // Auto-open the preview whenever the store has items — even if
          // everything in this batch was a duplicate, the user still
          // expects to see the preview if it got closed.
          if (store.count > 0) {
            void ensurePreviewOpen(store);
          }

          vscode.window.setStatusBarMessage(
            `Code Merge: "${rootName}" → added ${added}, skipped ${skippedTotal}` +
              (prunedCount > 0 ? `, removed ${prunedCount} now-ignored` : '') +
              ` (${totalChars.toLocaleString()} chars)`,
            4000
          );
        }
      );
    }
  );
}