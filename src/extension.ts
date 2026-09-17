import * as vscode from 'vscode';
import { MergeStore } from './core/MergeStore';
import { addFileCommand } from './commands/addFile';
import { addSelectionCommand } from './commands/addSelection';
import { deleteItemCommand } from './commands/deleteItem';
import { openPreviewCommand, writeMergedFile } from './commands/openPreview';
import { MergeTreeProvider } from './views/MergeTreeProvider';
import { copyAllCommand } from './commands/copyAll';
import { clearAllCommand } from './commands/clearAll';
import { addFolderCommand } from './commands/addFolder';

const SYNC_DEBOUNCE_MS = 150;

export function activate(context: vscode.ExtensionContext): void {
  const store = new MergeStore(context);
  const tree = new MergeTreeProvider(store);

  // Debounced auto-sync: every mutation (add/remove/clear/switch workspace)
  // schedules a single write of the active workspace's merged.md.
  let syncTimer: NodeJS.Timeout | undefined;

  const scheduleSync = (): void => {
    if (syncTimer) {
      clearTimeout(syncTimer);
    }
    syncTimer = setTimeout(() => {
      syncTimer = undefined;
      void syncIfClean(store).catch(err => {
        console.error('[code-merge] auto-sync failed:', err);
      });
    }, SYNC_DEBOUNCE_MS);
  };

  context.subscriptions.push(
    store,
    tree,
    addFolderCommand(store),
    addFileCommand(store),
    addSelectionCommand(store),
    deleteItemCommand(store),
    openPreviewCommand(store),
    copyAllCommand(store),
    clearAllCommand(store),
    vscode.window.registerTreeDataProvider('codeMerge.items', tree),

    store.onDidChange(scheduleSync),

    // If the user removes all workspace folders (or closes the window),
    // flush any pending write so we don't lose the last state.
    new vscode.Disposable(() => {
      if (syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = undefined;
      }
    })
  );
}

/**
 * Writes `.code-merge/merged.md` for the active workspace — but only if the
 * target document is not currently dirty in an editor (to avoid clobbering
 * the user's unsaved edits).
 */
async function syncIfClean(store: MergeStore): Promise<void> {
  const folder = store.getActiveWorkspace();
  if (!folder) {
    return;
  }

  const uri = vscode.Uri.joinPath(folder.uri, '.code-merge/merged.md');

  const openDoc = vscode.workspace.textDocuments.find(
    d => d.uri.toString() === uri.toString()
  );

  if (openDoc?.isDirty) {
    return;
  }

  await writeMergedFile(store);
}

export function deactivate(): void {
  // All disposables are handled by context.subscriptions.
}