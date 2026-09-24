import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';
import { StoreChange } from '../core/types';
import { renderMerged } from '../renderers';

export const MERGE_SCHEME = 'code-merge';

export class MergeDocumentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  private emitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.emitter.event;

  private storeSub: vscode.Disposable;

  constructor(private store: MergeStore) {
    this.storeSub = store.onDidChange(change => this.onStoreChange(change));
  }

  private onStoreChange(change: StoreChange): void {
    // The preview renders the active workspace only. Edits in another
    // workspace are invisible here, so don't bother VS Code with a
    // re-query — it would just re-render the same content.
    switch (change.kind) {
      case 'active-workspace-changed':
        this.notifyChanged();
        return;

      case 'items-added':
      case 'items-removed':
      case 'items-cleared':
      case 'content-changed':
      case 'ranges-changed': {
        const activeKey = this.store.getActiveWorkspace()?.uri.toString();
        if (change.workspaceKey === activeKey) {
          this.notifyChanged();
        }
        return;
      }
    }
  }

  /** Single, stable virtual URI. Never changes. */
  static uri(): vscode.Uri {
    return vscode.Uri.from({
      scheme: MERGE_SCHEME,
      path: '/merged.md',
    });
  }

  provideTextDocumentContent(_uri: vscode.Uri): string {
    const folder = this.store.getActiveWorkspace();
    if (!folder) {
      return '// Code Merge: no active workspace.\n';
    }
    return renderMerged(this.store.all, folder.name);
  }

  /**
   * Asks VS Code to re-query the preview content. Still public because
   * `extension.ts` calls it directly when workspace folders change —
   * that path can't go through the store event because nothing in the
   * store necessarily changed.
   */
  notifyChanged(): void {
    this.emitter.fire(MergeDocumentProvider.uri());
  }

  dispose(): void {
    this.storeSub.dispose();
    this.emitter.dispose();
  }
}