import * as vscode from 'vscode';
import { MergeItem, MergeRange } from './types';

/**
 * In-memory store for merge items.
 *
 * Nothing is persisted — by design. Every VS Code session starts with an
 * empty list. The active workspace defaults to the first workspace folder
 * and can be changed by any command that acts on a specific folder.
 */
export class MergeStore implements vscode.Disposable {
  private items: MergeItem[] = [];

  private itemIndex = new Map<string, MergeItem>();
  private idIndex = new Map<string, MergeItem>();
  private fsPathIndex = new Map<string, MergeItem[]>();

  /**
   * Running total of `content.length` per workspace, kept in sync
   * incrementally on every insert/remove/content update — never
   * recomputed from scratch. Backs the preview-size guard
   * (see `views/previewOpener.ts`) so checking "is this workspace's
   * merged output too big?" is an O(1) lookup, not a full scan.
   */
  private contentSize = new Map<string, number>();

  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  private activeWorkspaceUri?: string;

  constructor() {
    this.activeWorkspaceUri =
      vscode.workspace.workspaceFolders?.[0]?.uri.toString();
  }

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

  get allFsPaths(): string[] {
    return [...this.fsPathIndex.keys()];
  }

  /**
   * Total tracked content size (characters) for `workspaceUri`.
   * O(1) — backed by the running counter in `contentSize`.
   */
  getContentSize(workspaceUri: vscode.Uri): number {
    return this.contentSize.get(workspaceUri.toString()) ?? 0;
  }

  private keyOf(item: MergeItem): string {
    const start = item.range?.startLine ?? '';
    const end = item.range?.endLine ?? '';
    return `${item.workspaceFolder}|${item.fsPath}|${item.kind}|${start}|${end}`;
  }

  private isDuplicate(item: MergeItem): boolean {
    return this.itemIndex.has(this.keyOf(item));
  }

  /** Adjusts the running size counter for a workspace by `delta`. */
  private addSize(workspaceFolder: string, delta: number): void {
    if (delta === 0) {
      return;
    }
    const current = this.contentSize.get(workspaceFolder) ?? 0;
    const next = current + delta;
    if (next <= 0) {
      this.contentSize.delete(workspaceFolder);
    } else {
      this.contentSize.set(workspaceFolder, next);
    }
  }

  private insert(item: MergeItem): void {
    this.items.push(item);
    this.itemIndex.set(this.keyOf(item), item);
    this.idIndex.set(item.id, item);

    const bucket = this.fsPathIndex.get(item.fsPath);
    if (bucket) {
      bucket.push(item);
    } else {
      this.fsPathIndex.set(item.fsPath, [item]);
    }

    this.addSize(item.workspaceFolder, item.content.length);
  }

  private unindex(item: MergeItem): void {
    this.itemIndex.delete(this.keyOf(item));
    this.idIndex.delete(item.id);

    const bucket = this.fsPathIndex.get(item.fsPath);
    if (bucket) {
      const next = bucket.filter(i => i.id !== item.id);
      if (next.length) {
        this.fsPathIndex.set(item.fsPath, next);
      } else {
        this.fsPathIndex.delete(item.fsPath);
      }
    }

    this.addSize(item.workspaceFolder, -item.content.length);
  }

  add(item: MergeItem): boolean {
    if (!item.workspaceFolder) {
      return false;
    }
    if (this.isDuplicate(item)) {
      return false;
    }
    this.insert(item);
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
      this.insert(item);
      added++;
    }

    if (added > 0) {
      this.emitter.fire();
    }

    return { added, skipped };
  }

  remove(id: string): void {
    const item = this.idIndex.get(id);
    if (!item) {
      return;
    }
    const idx = this.items.indexOf(item);
    if (idx !== -1) {
      this.items.splice(idx, 1);
    }
    this.unindex(item);
    this.emitter.fire();
  }

  itemsByFsPath(fsPath: string): MergeItem[] {
    return this.fsPathIndex.get(fsPath) ?? [];
  }

  hasFsPath(fsPath: string): boolean {
    return this.fsPathIndex.has(fsPath);
  }

  /**
   * Bulk-updates item content. Fires a single change event if anything
   * actually changed. Used by the file-sync layer — the running size
   * counter is adjusted by exactly the character delta of each change,
   * so there's no need to inspect what was added/removed.
   */
  updateContents(
    updates: readonly { id: string; content: string }[]
  ): void {
    let changed = false;
    for (const { id, content } of updates) {
      const item = this.idIndex.get(id);
      if (!item || item.content === content) {
        continue;
      }
      this.addSize(item.workspaceFolder, content.length - item.content.length);
      item.content = content;
      changed = true;
    }
    if (changed) {
      this.emitter.fire();
    }
  }

  updateRanges(
    updates: readonly { id: string; range: MergeRange | null }[]
  ): void {
    let changed = false;
    const toRemove: MergeItem[] = [];

    for (const { id, range } of updates) {
      const item = this.idIndex.get(id);
      if (!item) {
        continue;
      }

      if (range === null) {
        toRemove.push(item);
        changed = true;
        continue;
      }

      if (
        item.range?.startLine !== range.startLine ||
        item.range?.endLine !== range.endLine
      ) {
        this.itemIndex.delete(this.keyOf(item));
        item.range = range;
        this.itemIndex.set(this.keyOf(item), item);
        changed = true;
      }
    }

    if (toRemove.length) {
      const toRemoveIds = new Set(toRemove.map(i => i.id));
      this.items = this.items.filter(i => !toRemoveIds.has(i.id));
      for (const item of toRemove) {
        this.unindex(item);
      }
    }

    if (changed) {
      this.emitter.fire();
    }
  }

  prune(
    workspaceUri: vscode.Uri,
    shouldRemove: (item: MergeItem) => boolean
  ): number {
    const key = workspaceUri.toString();
    const before = this.items.length;
    this.items = this.items.filter(i => {
      if (i.workspaceFolder !== key || !shouldRemove(i)) {
        return true;
      }
      this.unindex(i);
      return false;
    });
    const removed = before - this.items.length;

    if (removed > 0) {
      this.emitter.fire();
    }

    return removed;
  }

  removeByFsPath(fsPath: string): void {
    const before = this.items.length;
    this.items = this.items.filter(i => {
      if (i.fsPath !== fsPath) {
        return true;
      }
      this.unindex(i);
      return false;
    });
    if (this.items.length !== before) {
      this.emitter.fire();
    }
  }

  clear(): void {
    const key = this.activeWorkspaceUri;
    if (!key) {
      return;
    }
    const before = this.items.length;
    this.items = this.items.filter(i => {
      if (i.workspaceFolder !== key) {
        return true;
      }
      this.unindex(i);
      return false;
    });
    if (this.items.length !== before) {
      this.emitter.fire();
    }
  }

  dispose(): void {
    this.emitter.dispose();
  }
}