import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';
import type { WorkspaceTreeItem } from '../views/MergeTreeProvider';

export function switchWorkspaceCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand(
    'code-merge.switchWorkspace',
    (node?: WorkspaceTreeItem) => {
      if (!node?.workspaceUri) {
        return;
      }

      store.setActiveWorkspace(node.workspaceUri);

      vscode.window.setStatusBarMessage(
        `Code Merge: switched to "${node.workspaceName}"`,
        2000
      );
    }
  );
}