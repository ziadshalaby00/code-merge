import * as vscode from 'vscode';
import { MergeStore } from './core/MergeStore';
import { addFileCommand } from './commands/addFile';
import { addSelectionCommand } from './commands/addSelection';
import { deleteItemCommand } from './commands/deleteItem';
import { openPreviewCommand } from './commands/openPreview';
import { MergeTreeProvider } from './views/MergeTreeProvider';
import {
  MergeDocumentProvider,
  MERGE_SCHEME,
} from './views/MergeDocumentProvider';
import { copyAllCommand } from './commands/copyAll';
import { clearAllCommand } from './commands/clearAll';
import { addFolderCommand } from './commands/addFolder';
import { FileSync } from './core/FileSync';

export function activate(context: vscode.ExtensionContext): void {
  const store = new MergeStore();
  const tree = new MergeTreeProvider(store);
  const docProvider = new MergeDocumentProvider(store);
  const fileSync = new FileSync(store);

  context.subscriptions.push(
    store,
    tree,
    docProvider,
    fileSync,
    addFolderCommand(store),
    addFileCommand(store),
    addSelectionCommand(store),
    deleteItemCommand(store),
    openPreviewCommand(store),
    copyAllCommand(store),
    clearAllCommand(store),
    vscode.window.registerTreeDataProvider('codeMerge.items', tree),
    vscode.workspace.registerTextDocumentContentProvider(
      MERGE_SCHEME,
      docProvider
    ),

    // Keep the active workspace valid when folders are opened/closed.
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if (!store.getActiveWorkspace()) {
        const first = vscode.workspace.workspaceFolders?.[0];
        if (first) {
          // Fires store.onDidChange → provider refreshes.
          store.setActiveWorkspace(first.uri);
          return;
        }
      }
      // No active workspace at all — force a refresh so the preview
      // shows the "no active workspace" message.
      docProvider.notifyChanged();
    })
  );
}

export function deactivate(): void {
  // All disposables are handled by context.subscriptions.
}