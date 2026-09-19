import * as vscode from 'vscode';
import { IgnoreRules } from '../core/ignoreRules';

export function reloadIgnoreRulesCommand(
  rules: IgnoreRules
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'code-merge.reloadIgnoreRules',
    async () => {
      await rules.reload();
      vscode.window.setStatusBarMessage(
        'Code Merge: ignore rules reloaded ✔',
        2500
      );
    }
  );
}