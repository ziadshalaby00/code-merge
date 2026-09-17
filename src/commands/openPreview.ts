import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';
import { renderMerged } from '../renderers';

const OUTPUT_REL_PATH = '.code-merge/merged.md';

async function getOutputUri(store: MergeStore ): Promise<vscode.Uri | undefined> {
  const folder = store.getActiveWorkspace();

  if (!folder) {
    return undefined;
  }

  return vscode.Uri.joinPath(folder.uri, OUTPUT_REL_PATH);
}

export async function writeMergedFile(store: MergeStore): Promise<void> {
  const uri = await getOutputUri(store);
  if (!uri) {
    return;
  }

  const openDoc = vscode.workspace.textDocuments.find(
    doc => doc.uri.toString() === uri.toString()
  );

  if (openDoc?.isDirty) {
    return;
  }

  const dir = vscode.Uri.joinPath(uri, '..');

  try {
    await vscode.workspace.fs.createDirectory(dir);
  } catch {}

  const content = renderMerged(store.all);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
}

export function openPreviewCommand(store: MergeStore): vscode.Disposable {
  return vscode.commands.registerCommand('code-merge.openPreview', async () => {
    const uri = await getOutputUri(store);
    if (!uri) {
      vscode.window.showWarningMessage(
        'Code Merge: open a folder first to use the merged file.'
      );
      return;
    }

    const openDoc = vscode.workspace.textDocuments.find(
      doc => doc.uri.toString() === uri.toString()
    );

    if (openDoc?.isDirty) {
      vscode.window.showWarningMessage(
        'Code Merge: merged.md has unsaved changes. Preview was not regenerated.'
      );
    } else {
      await writeMergedFile(store);
    }

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
          await vscode.commands.executeCommand(
            'workbench.action.lockEditorGroup'
          );
          await vscode.commands.executeCommand('workbench.action.keepEditor');
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

    await vscode.commands.executeCommand('workbench.action.lockEditorGroup');

    await vscode.commands.executeCommand('workbench.action.keepEditor');

    if (previous) {
      await vscode.window.showTextDocument(previous.document, {
        viewColumn: previous.viewColumn,
        preserveFocus: false,
      });
    }
  });
}