import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';
import type { WorkspaceTreeItem } from '../views/MergeTreeProvider';

export function clearWorkspaceCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand(
    'code-merge.clearWorkspace',
    async (node?: WorkspaceTreeItem) => {
      if (!node?.workspaceUri) {
        return;
      }

      const count = node.itemCount;
      if (!count) {
        vscode.window.showInformationMessage(
          `Code Merge: "${node.workspaceName}" has nothing to clear.`
        );
        return;
      }

      const pick = await vscode.window.showWarningMessage(
        `Clear all ${count} item(s) from "${node.workspaceName}"? This cannot be undone.`,
        { modal: true },
        'Clear All'
      );

      if (pick !== 'Clear All') {
        return;
      }

      const removed = store.clearWorkspace(node.workspaceUri);

      vscode.window.setStatusBarMessage(
        `Code Merge: cleared ${removed} item(s) from "${node.workspaceName}"`,
        2500
      );
    }
  );
}