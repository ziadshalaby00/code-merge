import * as vscode from 'vscode';
import { MergeStore } from './core/MergeStore';
import { addFileCommand } from './commands/addFile';
import { addSelectionCommand } from './commands/addSelection';
import { deleteItemCommand } from './commands/deleteItem';
import { openPreviewCommand } from './commands/openPreview';
import {
  MergeTreeProvider,
  WorkspacesTreeProvider,
} from './views/MergeTreeProvider';
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
import { clearWorkspaceCommand } from './commands/clearWorkspace';
import { switchWorkspaceCommand } from './commands/switchWorkspace';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Code Merge');

  const store = new MergeStore();
  const rules = new IgnoreRules(output);
  const tree = new MergeTreeProvider(store);
  const workspacesTree = new WorkspacesTreeProvider(store);
  const docProvider = new MergeDocumentProvider(store);
  const fileSync = new FileSync(store, rules);

  void rules.reload(store.getActiveWorkspace()?.uri);

  context.subscriptions.push(
    output,
    store,
    tree,
    workspacesTree,
    docProvider,
    fileSync,

    // Commands
    addFolderCommand(store, rules),
    addFileCommand(store, rules),
    addSelectionCommand(store),
    deleteItemCommand(store),
    openPreviewCommand(store),
    copyAllCommand(store),
    clearAllCommand(store),
    switchWorkspaceCommand(store),
    clearWorkspaceCommand(store),
    ignorePathCommand(),
    openIgnoreSettingsCommand(),
    reloadIgnoreRulesCommand(rules, store),

    // Tree views
    vscode.window.registerTreeDataProvider('codeMerge.items', tree),
    vscode.window.registerTreeDataProvider(
      'codeMerge.workspaces',
      workspacesTree
    ),

    // Virtual document provider for the merged preview
    vscode.workspace.registerTextDocumentContentProvider(
      MERGE_SCHEME,
      docProvider
    ),

    // React to settings changes
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('code-merge')) {
        void rules.reload(store.getActiveWorkspace()?.uri);
      }
    }),

    // React to workspace-folder add/remove
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      const currentUris = new Set(
        (vscode.workspace.workspaceFolders ?? []).map(f =>
          f.uri.toString()
        )
      );

      // Prune items belonging to workspaces that no longer exist.
      // Without this, the Workspaces view keeps showing removed folders,
      // and switchWorkspace "succeeds" while getActiveWorkspace() returns
      // undefined — leaving openPreview / copyAll / clearAll with a
      // confusing "no active workspace" error.
      for (const uriStr of store.getWorkspacesWithItems()) {
        if (!currentUris.has(uriStr)) {
          store.clearWorkspace(vscode.Uri.parse(uriStr));
        }
      }

      // If the active workspace was just removed, fall back to the first
      // remaining folder (or leave it unset if there are none left).
      if (!store.getActiveWorkspace()) {
        const first = vscode.workspace.workspaceFolders?.[0];
        if (first) {
          store.setActiveWorkspace(first.uri);
        }
      }

      // Safety net: refresh the preview even when nothing was pruned and
      // no active switch happened (e.g. folder added → preview header
      // might need to re-resolve).
      docProvider.notifyChanged();
    })
  );
}

export function deactivate(): void {
  // All disposables are handled by context.subscriptions.
} 