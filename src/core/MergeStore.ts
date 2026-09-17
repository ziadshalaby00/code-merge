import * as vscode from 'vscode';
import { MergeItem } from './types';

const STORAGE_KEY = 'codeMerge.items.v1';

export class MergeStore implements vscode.Disposable {
  private items: MergeItem[] = [];
  private emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  private activeWorkspaceUri?: string;

  constructor(private ctx: vscode.ExtensionContext) {
    this.items = ctx.workspaceState.get<MergeItem[]>(STORAGE_KEY, []);
    this.activeWorkspaceUri = ctx.workspaceState.get<string>(
      `${STORAGE_KEY}.activeWorkspace`
    );
  }

  public setActiveWorkspace(uri: vscode.Uri): void {
    this.activeWorkspaceUri = uri.toString();
    void this.ctx.workspaceState.update(
      `${STORAGE_KEY}.activeWorkspace`,
      this.activeWorkspaceUri
    );
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
    return this.items;
  }

  get count(): number {
    return this.items.length;
  }

  private isDuplicate(item: MergeItem): boolean {
    return this.items.some(
      i =>
        i.fsPath === item.fsPath &&
        i.kind === item.kind &&
        i.range?.startLine === item.range?.startLine &&
        i.range?.endLine === item.range?.endLine
    );
  }

  add(item: MergeItem): boolean {
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
      if (this.isDuplicate(item)) {
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
    this.items = this.items.filter(i => i.id !== id);
    this.persist();
  }

  clear(): void {
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