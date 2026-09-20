import * as vscode from 'vscode';
import { MergeDocumentProvider } from '../views/MergeDocumentProvider';
import { MergeStore } from '../core/MergeStore';
import {
  lockAndKeep,
  resetPreviewSizeWarning,
} from '../views/previewOpener';

export function openPreviewCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand('code-merge.openPreview', async () => {
    const folder = store.getActiveWorkspace();
    if (!folder) {
      vscode.window.showWarningMessage(
        'Code Merge: open a folder first to use the merged preview.'
      );
      return;
    }

    // Manual open — allow a fresh size warning if a later edit pushes
    // the content over the limit again.
    resetPreviewSizeWarning(folder.uri);

    const uri = MergeDocumentProvider.uri();
    const previous = vscode.window.activeTextEditor;

    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (
          tab.input instanceof vscode.TabInputText &&
          tab.input.uri.toString() === uri.toString()
        ) {
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, {
            viewColumn: group.viewColumn,
            preview: false,
            preserveFocus: false,
          });
          await lockAndKeep();

          if (previous) {
            await vscode.window.showTextDocument(previous.document, {
              viewColumn: previous.viewColumn,
              preserveFocus: false,
            });
          }
          return;
        }
      }
    }

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
      preserveFocus: false,
    });

    await lockAndKeep();

    if (previous) {
      await vscode.window.showTextDocument(previous.document, {
        viewColumn: previous.viewColumn,
        preserveFocus: false,
      });
    }
  });
}