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
  }

  public setActiveWorkspace(uri: vscode.Uri): void {
    this.activeWorkspaceUri = uri.toString();
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

  add(item: MergeItem): boolean {
    const dup = this.items.some(
      i =>
        i.fsPath === item.fsPath &&
        i.kind === item.kind &&
        i.range?.startLine === item.range?.startLine &&
        i.range?.endLine === item.range?.endLine
    );
    if (dup) {
      return false;
    }
    this.items.push(item);
    this.persist();
    return true;
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