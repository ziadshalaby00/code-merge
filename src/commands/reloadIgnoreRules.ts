import * as vscode from 'vscode';
import { IgnoreRules } from '../core/ignoreRules';
import { MergeStore } from '../core/MergeStore';

export function reloadIgnoreRulesCommand(
  rules: IgnoreRules,
  store: MergeStore
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'code-merge.reloadIgnoreRules',
    async () => {
      await rules.reload(store.getActiveWorkspace()?.uri);
      vscode.window.setStatusBarMessage(
        'Code Merge: ignore rules reloaded ✔',
        2500
      );
    }
  );
}