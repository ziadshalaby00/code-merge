import * as vscode from 'vscode';
import { MergeItem } from './types';

/**
 * In-memory store for merge items.
 *
 * Nothing is persisted — by design. Every VS Code session starts with an
 * empty list. The active workspace defaults to the first workspace folder
 * and can be changed by any command that acts on a specific folder.
 */
export class MergeStore implements vscode.Disposable {
  private items: MergeItem[] = [];
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  private activeWorkspaceUri?: string;

  constructor() {
    // No persistence: each activation starts fresh. Default the active
    // workspace to the first folder (if any) so preview/copy work
    // immediately.
    this.activeWorkspaceUri =
      vscode.workspace.workspaceFolders?.[0]?.uri.toString();
  }

  /**
   * Sets the active workspace. Each workspace has its own isolated list
   * of items; the preview, tree view, and copy command reflect this
   * workspace until it is switched again.
   */
  public setActiveWorkspace(uri: vscode.Uri): void {
    const next = uri.toString();
    if (this.activeWorkspaceUri === next) {
      return;
    }
    this.activeWorkspaceUri = next;
    this.emitter.fire();
  }

  public getActiveWorkspace(): vscode.WorkspaceFolder | undefined {
    if (!this.activeWorkspaceUri) {
      return undefined;
    }
    return vscode.workspace.workspaceFolders?.find(
      folder => folder.uri.toString() === this.activeWorkspaceUri
    );
  }

  /**
   * Items belonging to the **active workspace only**.
   * This is what the tree view, preview, and copy commands consume.
   */
  get all(): readonly MergeItem[] {
    const key = this.activeWorkspaceUri;
    if (!key) {
      return [];
    }
    return this.items.filter(i => i.workspaceFolder === key);
  }

  get count(): number {
    return this.all.length;
  }

  private isDuplicate(item: MergeItem): boolean {
    return this.items.some(
      i =>
        i.workspaceFolder === item.workspaceFolder &&
        i.fsPath === item.fsPath &&
        i.kind === item.kind &&
        i.range?.startLine === item.range?.startLine &&
        i.range?.endLine === item.range?.endLine
    );
  }

  add(item: MergeItem): boolean {
    if (!item.workspaceFolder) {
      return false;
    }
    if (this.isDuplicate(item)) {
      return false;
    }
    this.items.push(item);
    this.emitter.fire();
    return true;
  }

  addMany(newItems: MergeItem[]): { added: number; skipped: number } {
    let added = 0;
    let skipped = 0;

    for (const item of newItems) {
      if (!item.workspaceFolder || this.isDuplicate(item)) {
        skipped++;
        continue;
      }
      this.items.push(item);
      added++;
    }

    if (added > 0) {
      this.emitter.fire();
    }

    return { added, skipped };
  }

  remove(id: string): void {
    const before = this.items.length;
    this.items = this.items.filter(i => i.id !== id);
    if (this.items.length !== before) {
      this.emitter.fire();
    }
  }

  /**
   * Returns items (across all workspaces) whose fsPath matches.
   * Used by the file-sync layer to find what to update.
   */
  itemsByFsPath(fsPath: string): MergeItem[] {
    return this.items.filter(i => i.fsPath === fsPath);
  }

  /** Fast existence check — avoids allocating an array for non-tracked files. */
  hasFsPath(fsPath: string): boolean {
    return this.items.some(i => i.fsPath === fsPath);
  }

  /**
   * Bulk-updates item content. Fires a single change event if anything
   * actually changed. Used by the file-sync layer.
   */
  updateContents(
    updates: readonly { id: string; content: string }[]
  ): void {
    let changed = false;
    for (const { id, content } of updates) {
      const item = this.items.find(i => i.id === id);
      if (!item || item.content === content) {
        continue;
      }
      item.content = content;
      changed = true;
    }
    if (changed) {
      this.emitter.fire();
    }
  }

  /**
   * Removes every item (across all workspaces) pointing at fsPath.
   * Fires a change event if anything was removed.
   */
  removeByFsPath(fsPath: string): void {
    const before = this.items.length;
    this.items = this.items.filter(i => i.fsPath !== fsPath);
    if (this.items.length !== before) {
      this.emitter.fire();
    }
  }

  /**
   * Clears items **only for the active workspace**.
   * Other workspaces are untouched.
   */
  clear(): void {
    const key = this.activeWorkspaceUri;
    if (!key) {
      return;
    }
    const before = this.items.length;
    this.items = this.items.filter(i => i.workspaceFolder !== key);
    if (this.items.length !== before) {
      this.emitter.fire();
    }
  }

  dispose(): void {
    this.emitter.dispose();
  }
}