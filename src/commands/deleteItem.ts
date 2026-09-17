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
      store.remove(node.data.id);
      vscode.window.setStatusBarMessage('Code Merge: item removed', 2000);
    }
  );
}