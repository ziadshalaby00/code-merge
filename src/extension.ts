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
import { ignorePathCommand } from './commands/ignorePath';
import { openIgnoreSettingsCommand } from './commands/openIgnoreSettings';
import { reloadIgnoreRulesCommand } from './commands/reloadIgnoreRules';
import { FileSync } from './core/FileSync';
import { IgnoreRules } from './core/ignoreRules';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Code Merge');

  const store = new MergeStore();
  const rules = new IgnoreRules(output);
  const tree = new MergeTreeProvider(store);
  const docProvider = new MergeDocumentProvider(store);
  const fileSync = new FileSync(store, rules);

  void rules.reload(store.getActiveWorkspace()?.uri);

  context.subscriptions.push(
    output,
    store,
    tree,
    docProvider,
    fileSync,
    addFolderCommand(store, rules),
    addFileCommand(store, rules),
    addSelectionCommand(store),
    deleteItemCommand(store),
    openPreviewCommand(store),
    copyAllCommand(store),
    clearAllCommand(store),
    ignorePathCommand(),
    openIgnoreSettingsCommand(),
    reloadIgnoreRulesCommand(rules, store),
    vscode.window.registerTreeDataProvider('codeMerge.items', tree),
    vscode.workspace.registerTextDocumentContentProvider(
      MERGE_SCHEME,
      docProvider
    ),

    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('code-merge')) {
        void rules.reload(store.getActiveWorkspace()?.uri);
      }
    }),

    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if (!store.getActiveWorkspace()) {
        const first = vscode.workspace.workspaceFolders?.[0];
        if (first) {
          store.setActiveWorkspace(first.uri);
          return;
        }
      }
      docProvider.notifyChanged();
    })
  );
}

export function deactivate(): void {
  // All disposables are handled by context.subscriptions.
}