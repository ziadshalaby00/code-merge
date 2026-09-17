import * as vscode from 'vscode';
import * as path from 'path';
import { MergeStore } from '../core/MergeStore';
import { newId } from '../core/ids';
import { toRelative } from '../core/relativePath';

export function addSelectionCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand('code-merge.addSelection', () => {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      vscode.window.showWarningMessage('Code Merge: no active editor.');
      return;
    }

    const sel = editor.selection;

    if (sel.isEmpty) {
      vscode.window.showWarningMessage('Code Merge: select some code first.');
      return;
    }

    const doc = editor.document;
    const content = doc.getText(sel);
    const ext = path.extname(doc.uri.fsPath).slice(1) || 'txt';

    const startLine = sel.start.line + 1;
    const endLine = sel.end.line + 1;

    const ok = store.add({
      id: newId(),
      kind: 'selection',
      fsPath: doc.uri.fsPath,
      relativePath: toRelative(doc.uri),
      language: doc.languageId || ext,
      content,
      range: { startLine, endLine },
      addedAt: Date.now(),
    });

    const label = `${path.basename(doc.uri.fsPath)}:${startLine}-${endLine}`;

    if (ok) {
      vscode.window.setStatusBarMessage(
        `Code Merge: added selection from ${label}`,
        3000
      );
    } else {
      vscode.window.setStatusBarMessage(
        `Code Merge: duplicate selection (${label})`,
        3000
      );
    }
  });
}