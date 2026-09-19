import * as vscode from 'vscode';
import * as path from 'path';
import { MergeStore } from '../core/MergeStore';
import { newId } from '../core/ids';
import { toRelative } from '../core/relativePath';
import { ensurePreviewOpen } from '../views/previewOpener';

export function addSelectionCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand('code-merge.addSelection', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Code Merge: no active editor.');
      return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(
      editor.document.uri
    );
    if (!workspaceFolder) {
      vscode.window.showWarningMessage(
        'Code Merge: the selected code is not inside a workspace.'
      );
      return;
    }

    const selections = editor.selections.filter(sel => !sel.isEmpty);
    if (!selections.length) {
      vscode.window.showWarningMessage('Code Merge: select some code first.');
      return;
    }

    const maxFileSize =
      vscode.workspace
        .getConfiguration('code-merge', workspaceFolder.uri)
        .get<number>('maxFileSizeMB', 5) * 1024 * 1024;

    store.setActiveWorkspace(workspaceFolder.uri);

    const doc = editor.document;
    const ext = path.extname(doc.uri.fsPath).slice(1) || 'txt';
    const relativePath = toRelative(doc.uri);
    const workspaceKey = workspaceFolder.uri.toString();

    let added = 0;
    let skipped = 0;
    let lastLabel = '';

    for (const sel of selections) {
      const startLine = sel.start.line + 1;
      const endLine = sel.end.line + 1;
      const content = doc.getText(sel);

      if (Buffer.byteLength(content, 'utf8') > maxFileSize) {
        vscode.window.showWarningMessage(
          `Code Merge: selection exceeds ${maxFileSize / 1024 / 1024} MB and was skipped.`
        );
        skipped++;
        continue;
      }

      const ok = store.add({
        id: newId(),
        kind: 'selection',
        fsPath: doc.uri.fsPath,
        relativePath,
        workspaceFolder: workspaceKey,
        language: doc.languageId || ext,
        content,
        range: { startLine, endLine },
        addedAt: Date.now(),
      });

      const label = `${path.basename(doc.uri.fsPath)}:${startLine}-${endLine}`;
      lastLabel = label;

      ok ? added++ : skipped++;
    }
    
    // Auto-open the preview whenever the store has items — even if
    // every selection in this batch was a duplicate.
    if (store.count > 0) {
      void ensurePreviewOpen(store);
    }

    if (added && !skipped) {
      const msg =
        added === 1
          ? `Code Merge: added selection from ${lastLabel}`
          : `Code Merge: added ${added} selections`;
      vscode.window.setStatusBarMessage(msg, 3000);
      return;
    }

    if (!added && skipped) {
      const msg =
        skipped === 1
          ? `Code Merge: duplicate selection (${lastLabel})`
          : `Code Merge: ${skipped} duplicate selections skipped`;
      vscode.window.setStatusBarMessage(msg, 3000);
      return;
    }

    vscode.window.setStatusBarMessage(
      `Code Merge: added ${added}, skipped ${skipped} (duplicates)`,
      3000
    );
  });
}