import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';
import { renderMerged } from '../renderers';

export function copyAllCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand(
    'code-merge.copyAll',
    async () => {
      if (!store.count) {
        vscode.window.showInformationMessage(
          'Code Merge: nothing to copy.'
        );
        return;
      }

      const text = renderMerged(store.all);

      await vscode.env.clipboard.writeText(text);

      const size = text.length;
      vscode.window.setStatusBarMessage(
        `Code Merge: copied ${size.toLocaleString()} chars ✔`,
        2500
      );
    }
  );
}