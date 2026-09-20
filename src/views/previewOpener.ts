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

// ────────────────────────────────────────────────────────────
// Preview size guard
// ────────────────────────────────────────────────────────────

/**
 * Workspaces (by URI string) that have already been warned about
 * exceeding the size limit while the preview was open. Cleared when
 * the size drops back under the limit, or when the preview is
 * reopened (manually or automatically) — so the next time an edit
 * pushes it over the limit again, the user gets a fresh warning.
 */
const warnedWorkspaces = new Set<string>();

function getMaxPreviewSizeChars(): number {
  return vscode.workspace
    .getConfiguration('code-merge')
    .get<number>('maxPreviewSizeChars', 5_000_000);
}

/** Call when the preview is (re)opened, to allow a fresh warning later. */
export function resetPreviewSizeWarning(workspaceUri: vscode.Uri): void {
  warnedWorkspaces.delete(workspaceUri.toString());
}

async function closePreviewTab(): Promise<void> {
  const target = MergeDocumentProvider.uri().toString();

  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (
        tab.input instanceof vscode.TabInputText &&
        tab.input.uri.toString() === target
      ) {
        await vscode.window.tabGroups.close(tab);
        return;
      }
    }
  }
}

/**
 * Called after a live-sync content update for `workspaceUri`. If the
 * tracked content now exceeds the configured limit and the preview
 * tab is open, closes it (so further edits don't trigger a full
 * re-render) and warns once per "oversized session".
 *
 * Does nothing if the preview is already closed — so the very first
 * add of a large folder, which opens the preview via
 * `ensurePreviewOpen` regardless of size, is never affected by this
 * guard; it only ever closes a preview that a live edit pushed over
 * the limit.
 */
export async function enforcePreviewSizeLimit(
  store: MergeStore,
  workspaceUri: vscode.Uri
): Promise<void> {
  const key = workspaceUri.toString();
  const size = store.getContentSize(workspaceUri);
  const limit = getMaxPreviewSizeChars();

  if (size <= limit) {
    warnedWorkspaces.delete(key);
    return;
  }

  // Only close the preview if it's currently showing *this* workspace —
  // the preview always reflects the active workspace, so an oversized
  // edit in an inactive one shouldn't touch it.
  const active = store.getActiveWorkspace();
  if (!active || active.uri.toString() !== key) {
    return;
  }

  if (!isPreviewOpen()) {
    return;
  }

  await closePreviewTab();

  if (!warnedWorkspaces.has(key)) {
    warnedWorkspaces.add(key);
    vscode.window.showWarningMessage(
      `Code Merge: the merged output exceeds ${(limit / 1_000_000).toFixed(1)}M characters. ` +
        `The live preview was closed to avoid slowing down your editor. You can reopen it ` +
        `manually, or use "Copy Merged Content" — it will close again if you keep editing.`
    );
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

  // Fresh open — reset the size-warning flag so a future live edit
  // that pushes the content over the limit warns again. This is what
  // makes the auto-open path behave the same as the manual one.
  resetPreviewSizeWarning(folder.uri);

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