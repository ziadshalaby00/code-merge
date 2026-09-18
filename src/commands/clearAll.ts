import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';

export function clearAllCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand('code-merge.clearAll', async () => {
    const folder = store.getActiveWorkspace();
    if (!folder) {
      vscode.window.showWarningMessage('Code Merge: no active workspace.');
      return;
    }

    const count = store.count;
    if (!count) {
      vscode.window.showInformationMessage(
        `Code Merge: "${folder.name}" has nothing to clear.`
      );
      return;
    }

    const pick = await vscode.window.showWarningMessage(
      `Clear all ${count} item(s) from "${folder.name}"? This cannot be undone.`,
      { modal: true },
      'Clear All'
    );

    if (pick !== 'Clear All') {
      return;
    }

    store.clear();

    vscode.window.setStatusBarMessage(
      `Code Merge: cleared "${folder.name}"`,
      2000
    );
  });
}