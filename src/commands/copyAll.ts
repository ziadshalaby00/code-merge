import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';
import { renderMerged } from '../renderers';

export function copyAllCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand('code-merge.copyAll', async () => {
    const folder = store.getActiveWorkspace();
    if (!folder) {
      vscode.window.showWarningMessage(
        'Code Merge: open a folder first to copy the merged content.'
      );
      return;
    }

    const items = [...store.all];
    if (!items.length) {
      vscode.window.showInformationMessage(
        'Code Merge: nothing to copy.'
      );
      return;
    }

    const text = renderMerged(items, folder.name);

    try {
      await vscode.env.clipboard.writeText(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(
        `Code Merge: failed to copy to clipboard — ${message}`
      );
      return;
    }

    vscode.window.setStatusBarMessage(
      `Code Merge: copied ${text.length.toLocaleString()} chars ✔`,
      2500
    );
  });
}