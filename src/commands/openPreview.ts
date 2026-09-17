import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';
import { renderMerged } from '../renderers';

const OUTPUT_REL_PATH = '.code-merge/merged.md';

async function getOutputUri(
  store: MergeStore
): Promise<vscode.Uri | undefined> {
  const folder = store.getActiveWorkspace();
  if (!folder) {
    return undefined;
  }
  return vscode.Uri.joinPath(folder.uri, OUTPUT_REL_PATH);
}

/**
 * Writes the active workspace's merged output to disk.
 * Skips the write if the file is currently open and dirty, to avoid
 * clobbering the user's unsaved edits.
 */
export async function writeMergedFile(store: MergeStore): Promise<void> {
  const folder = store.getActiveWorkspace();
  if (!folder) {
    return;
  }

  const uri = vscode.Uri.joinPath(folder.uri, OUTPUT_REL_PATH);

  const openDoc = vscode.workspace.textDocuments.find(
    doc => doc.uri.toString() === uri.toString()
  );
  if (openDoc?.isDirty) {
    return;
  }

  // Snapshot the items first so a concurrent store mutation doesn't produce
  // a half-rendered file.
  const items = [...store.all];
  const content = renderMerged(items, folder.name);

  const dir = vscode.Uri.joinPath(uri, '..');
  try {
    await vscode.workspace.fs.createDirectory(dir);
  } catch {
    // Directory already exists — safe to ignore.
  }

  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
}

export function openPreviewCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand('code-merge.openPreview', async () => {
    const folder = store.getActiveWorkspace();
    if (!folder) {
      vscode.window.showWarningMessage(
        'Code Merge: open a folder first to use the merged file.'
      );
      return;
    }

    const uri = vscode.Uri.joinPath(folder.uri, OUTPUT_REL_PATH);

    const openDoc = vscode.workspace.textDocuments.find(
      doc => doc.uri.toString() === uri.toString()
    );

    if (openDoc?.isDirty) {
      vscode.window.showWarningMessage(
        'Code Merge: merged.md has unsaved changes. Preview was not regenerated.'
      );
    } else {
      try {
        await writeMergedFile(store);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(
          `Code Merge: failed to write merged.md — ${message}`
        );
        return;
      }
    }

    const previous = vscode.window.activeTextEditor;

    // If the merged file is already open in a tab, just focus that tab.
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
          return;
        }
      }
    }

    // Otherwise open a fresh tab beside the current editor.
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, {
      viewColumn: vscode.ViewColumn.Beside,
      preview: false,
      preserveFocus: false,
    });

    await lockAndKeep();

    // Return focus to where the user was.
    if (previous) {
      await vscode.window.showTextDocument(previous.document, {
        viewColumn: previous.viewColumn,
        preserveFocus: false,
      });
    }
  });
}

/**
 * Best-effort: pin the preview tab so it doesn't get replaced by the next
 * file the user opens. These are internal VS Code commands, so failures
 * are swallowed — the preview still works without them.
 */
async function lockAndKeep(): Promise<void> {
  try {
    await vscode.commands.executeCommand('workbench.action.lockEditorGroup');
    await vscode.commands.executeCommand('workbench.action.keepEditor');
  } catch {
    // Internal commands may not exist in all VS Code versions.
  }
}