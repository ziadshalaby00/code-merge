import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';

export function clearAllCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand('code-merge.clearAll', async () => {
    if (!store.count) {
      vscode.window.showInformationMessage('Code Merge: nothing to clear.');
      return;
    }

    const pick = await vscode.window.showWarningMessage(
      `Clear all ${store.count} item(s)? This cannot be undone.`,
      { modal: true },
      'Clear All'
    );

    if (pick === 'Clear All') {
      store.clear();
      vscode.window.setStatusBarMessage('Code Merge: cleared all', 2000);
    }
  });
}