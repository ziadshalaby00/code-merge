import * as vscode from 'vscode';
import { MergeDocumentProvider } from './MergeDocumentProvider';
import { MergeStore } from '../core/MergeStore';

/**
 * Returns true when the merged preview tab is currently open in any
 * editor group. Cheap check — uses tab API, no file I/O.
 */
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
 * Opens the merged preview beside the current editor **only if it isn't
 * already open**. Respects the `code-merge.autoOpenPreview` setting.
 *
 * Called by the add commands after a successful insert, so the preview
 * appears on its own the first time the user adds something — without
 * stealing focus and without re-opening on every subsequent add.
 */
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

  const uri = MergeDocumentProvider.uri();
  const doc = await vscode.workspace.openTextDocument(uri);

  await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.Beside,
    preview: false,
    // Keep focus where the user is (Explorer / editor). Auto-open
    // should be a side effect, not a focus theft.
    preserveFocus: true,
  });
}