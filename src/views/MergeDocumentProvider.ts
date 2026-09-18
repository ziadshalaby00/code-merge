import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';
import { renderMerged } from '../renderers';

export const MERGE_SCHEME = 'code-merge';

export class MergeDocumentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  private emitter = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this.emitter.event;

  private storeSub: vscode.Disposable;

  constructor(private store: MergeStore) {
    // Fires on any store change — including active workspace switches,
    // since MergeStore.setActiveWorkspace() emits onDidChange too.
    this.storeSub = store.onDidChange(() => this.notifyChanged());
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

  /** Asks VS Code to re-query the preview content. */
  notifyChanged(): void {
    this.emitter.fire(MergeDocumentProvider.uri());
  }

  dispose(): void {
    this.storeSub.dispose();
    this.emitter.dispose();
  }
}