import * as vscode from 'vscode';
import { MergeItem } from './types';

const STORAGE_KEY = 'codeMerge.items.v1';
const ACTIVE_KEY = 'codeMerge.activeWorkspace.v1';

export class MergeStore implements vscode.Disposable {
  private items: MergeItem[] = [];
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  private activeWorkspaceUri?: string;

  constructor(private ctx: vscode.ExtensionContext) {
    this.items = ctx.workspaceState.get<MergeItem[]>(STORAGE_KEY, []);
    this.activeWorkspaceUri = ctx.workspaceState.get<string>(ACTIVE_KEY);

    // Fallback: if the stored workspace is no longer open (or never set),
    // pick the first workspace folder so preview/copy keep working.
    if (!this.getActiveWorkspace()) {
      const first = vscode.workspace.workspaceFolders?.[0];
      this.activeWorkspaceUri = first?.uri.toString();
    }
  }

  /**
   * Sets the active workspace. Each workspace has its own isolated list of
   * items and its own generated `.code-merge/merged.md`.
   */
  public setActiveWorkspace(uri: vscode.Uri): void {
    const next = uri.toString();
    if (this.activeWorkspaceUri === next) {
      return;
    }
    this.activeWorkspaceUri = next;
    void this.ctx.workspaceState.update(ACTIVE_KEY, next);
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
    this.persist();
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
      this.persist();
    }

    return { added, skipped };
  }

  remove(id: string): void {
    const before = this.items.length;
    this.items = this.items.filter(i => i.id !== id);
    if (this.items.length !== before) {
      this.persist();
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
      this.persist();
    }
  }

  /** Clears items across every workspace. Not wired to any UI by default. */
  clearAll(): void {
    if (!this.items.length) {
      return;
    }
    this.items = [];
    this.persist();
  }

  private persist(): void {
    void this.ctx.workspaceState.update(STORAGE_KEY, this.items);
    this.emitter.fire();
  }

  dispose(): void {
    this.emitter.dispose();
  }
}