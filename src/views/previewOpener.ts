import * as vscode from 'vscode';
import { MergeDocumentProvider } from './MergeDocumentProvider';
import { MergeStore } from '../core/MergeStore';

export function isPreviewOpen(): boolean {
  const target = MergeDocumentProvider.uri().toString();

  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (
        tab.input instanceof vscode.TabInputText &&
        tab.input.uri.toString() === target
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Locks the active editor group and converts its preview tab into a
 * pinned one. Shared between the manual "Open Preview" command and
 * the auto-open path, so both leave the tab in the same state.
 */
export async function lockAndKeep(): Promise<void> {
  try {
    await vscode.commands.executeCommand('workbench.action.lockEditorGroup');
    await vscode.commands.executeCommand('workbench.action.keepEditor');
  } catch {
    // Internal commands may not exist in all VS Code versions.
  }
}

export async function ensurePreviewOpen(
  store: MergeStore
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('code-merge');
  if (!cfg.get<boolean>('autoOpenPreview', true)) {
    return;
  }

  if (isPreviewOpen()) {
    return;
  }

  const folder = store.getActiveWorkspace();
  if (!folder) {
    return;
  }

  const previous = vscode.window.activeTextEditor;

  const uri = MergeDocumentProvider.uri();
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
}