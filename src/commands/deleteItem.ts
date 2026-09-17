import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';
import { MergeTreeItem } from '../views/MergeTreeProvider';

export function deleteItemCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand(
    'code-merge.deleteItem',
    (node?: MergeTreeItem) => {
      if (!node?.data?.id) {
        return;
      }

      const active = store.getActiveWorkspace();
      if (!active) {
        vscode.window.showWarningMessage('Code Merge: no active workspace.');
        return;
      }

      // Defensive: make sure the clicked item actually belongs to the
      // active workspace. If the user switched workspaces after the tree
      // was rendered, this prevents deleting the wrong entry.
      if (node.data.workspaceFolder !== active.uri.toString()) {
        vscode.window.showWarningMessage(
          'Code Merge: item belongs to a different workspace. Refresh the view.'
        );
        return;
      }

      const label = node.data.range
        ? `${node.data.relativePath}:${node.data.range.startLine}-${node.data.range.endLine}`
        : node.data.relativePath;

      try {
        store.remove(node.data.id);
        vscode.window.setStatusBarMessage(
          `Code Merge: removed ${label}`,
          2000
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(
          `Code Merge: failed to remove item — ${message}`
        );
      }
    }
  );
}