import * as vscode from 'vscode';

/**
 * Opens the VS Code settings UI filtered to this extension's
 * configuration, so users can edit ignore rules visually.
 */
export function openIgnoreSettingsCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    'code-merge.openIgnoreSettings',
    () => {
      void vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:ziadshalaby00.code-merge'
      );
    }
  );
}