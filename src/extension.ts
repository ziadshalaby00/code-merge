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

export function activate(context: vscode.ExtensionContext) {
  const store = new MergeStore(context);
  const tree = new MergeTreeProvider(store);

  context.subscriptions.push(
    store,
    addFolderCommand(store),
    addFileCommand(store),
    addSelectionCommand(store),
    deleteItemCommand(store),
    openPreviewCommand(store),
    copyAllCommand(store),
    clearAllCommand(store),
    vscode.window.registerTreeDataProvider('codeMerge.items', tree),

    store.onDidChange(() => {
      void syncIfClean(store);
    })
  );
}

async function syncIfClean(store: MergeStore): Promise<void> {
  const folder = store.getActiveWorkspace();

  if (!folder) {
    return;
  }

  const uri = vscode.Uri.joinPath(
    folder.uri,
    '.code-merge/merged.md'
  );

  const openDoc = vscode.workspace.textDocuments.find(
    d => d.uri.toString() === uri.toString()
  );

  if (openDoc?.isDirty) {
    return;
  }

  await writeMergedFile(store);
}

export function deactivate() {}