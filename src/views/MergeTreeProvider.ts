import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';
import { MergeItem, MergeRange, StoreChange } from '../core/types';
import * as path from 'path';

const TOOLTIP_PREVIEW_CHARS = 400;

/**
 * Escapes markdown special characters so the tooltip renders correctly
 * regardless of what the user's file paths or content contain.
 */
function escapeMd(text: string): string {
  return text.replace(/[\\`*_[\]]/g, '\\$&');
}

function tooltipFor(data: MergeItem): vscode.MarkdownString {
  const lines: string[] = [];

  lines.push(`**${escapeMd(data.relativePath)}**`);
  lines.push('');

  const kindLabel = data.kind === 'selection' ? 'Selection' : 'File';
  lines.push(`Kind: \`${kindLabel}\``);

  if (data.range) {
    lines.push(
      `Range: \`L${data.range.startLine}-L${data.range.endLine}\``
    );
  }

  if (data.language) {
    lines.push(`Language: \`${escapeMd(data.language)}\``);
  }

  const preview =
    data.content.length > TOOLTIP_PREVIEW_CHARS
      ? data.content.slice(0, TOOLTIP_PREVIEW_CHARS) + '\n…'
      : data.content;

  lines.push('');
  lines.push('```' + data.language);
  lines.push(preview);
  lines.push('```');

  const md = new vscode.MarkdownString(lines.join('\n'));
  md.supportThemeIcons = false;
  md.isTrusted = false;

  return md;
}

function itemLabel(data: MergeItem): string {
  if (data.kind === 'selection' && data.range) {
    return `${data.relativePath}:${data.range.startLine}-${data.range.endLine}`;
  }
  return data.relativePath;
}

/**
 * Converts a MergeItem range (1-based inclusive) to a VS Code Range
 * (0-based, end-exclusive). The end column is maxed out so the whole
 * last line is included in the selection.
 */
function rangeToSelection(range: MergeRange): vscode.Range {
  const start = new vscode.Position(range.startLine - 1, 0);
  const end = new vscode.Position(
    range.endLine - 1,
    Number.MAX_SAFE_INTEGER
  );
  return new vscode.Range(start, end);
}

export class MergeTreeItem extends vscode.TreeItem {
  constructor(public readonly data: MergeItem) {
    super(itemLabel(data), vscode.TreeItemCollapsibleState.None);

    this.id = data.id;
    this.description = data.kind === 'selection' ? 'selection' : '';
    this.contextValue = 'mergeItem';
    this.tooltip = tooltipFor(data);

    this.iconPath = new vscode.ThemeIcon(
      data.kind === 'selection' ? 'selection' : 'file'
    );

    // Clicking opens the source file. For selections, scroll to and
    // highlight the recorded range so the user lands exactly where
    // they made the selection.
    const args: [vscode.Uri, vscode.TextDocumentShowOptions?] = [
      vscode.Uri.file(data.fsPath),
    ];

    if (data.range) {
      args.push({
        selection: rangeToSelection(data.range),
      });
    }

    this.command = {
      command: 'vscode.open',
      title: 'Open',
      arguments: args,
    };
  }
}

export class WorkspaceTreeItem extends vscode.TreeItem {
  constructor(
    public readonly workspaceUri: vscode.Uri,
    public readonly workspaceName: string,
    public readonly itemCount: number,
    public readonly isActive: boolean
  ) {
    super(
      workspaceName,
      vscode.TreeItemCollapsibleState.None
    );

    this.id = `workspace:${workspaceUri.toString()}`;
    this.description = isActive
      ? `${itemCount} item${itemCount === 1 ? '' : 's'} · active`
      : `${itemCount} item${itemCount === 1 ? '' : 's'}`;
    this.contextValue = 'mergeWorkspace';

    this.iconPath = new vscode.ThemeIcon(
      isActive ? 'root-folder-opened' : 'root-folder'
    );

    this.tooltip = new vscode.MarkdownString(
      isActive
        ? `**${workspaceName}** — currently active`
        : `**${workspaceName}**\n\nClick to switch to this workspace.`
    );

    // Clicking the item swaps the active workspace.
    this.command = {
      command: 'code-merge.switchWorkspace',
      title: 'Switch Workspace',
      arguments: [this],
    };
  }
}

export class MergeTreeProvider
  implements vscode.TreeDataProvider<MergeTreeItem>, vscode.Disposable
{
  private emitter = new vscode.EventEmitter<MergeTreeItem | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  private storeSub: vscode.Disposable;

  /**
   * Cached TreeItem per item id. VS Code's tree diffing uses
   * `TreeItem.id` to match items across refreshes, so returning the
   * same object for unchanged items lets it skip rebuilding their
   * tooltip / label / command. Without this cache, every store event
   * would build a fresh `MergeTreeItem` for every tracked item, which
   * is expensive for the tooltip MarkdownString alone.
   *
   * Entries are invalidated entry-by-entry, only for the ids whose
   * rendered representation actually changed:
   *   - content-changed → tooltip embeds a content slice
   *   - ranges-changed  → label and tooltip embed the line range
   *   - items-removed   → element is gone entirely
   *   - items-cleared   → whole workspace wiped
   *
   * Changes in a non-active workspace invalidate the cache but do not
   * fire — the tree isn't currently showing those items, and when the
   * user switches to that workspace the cache will be clean.
   */
  private itemCache = new Map<string, MergeTreeItem>();

  constructor(private store: MergeStore) {
    this.storeSub = store.onDidChange(change => this.onStoreChange(change));
  }

  private onStoreChange(change: StoreChange): void {
    const activeKey = this.store.getActiveWorkspace()?.uri.toString();
    const affectsActive =
      change.kind === 'active-workspace-changed' ||
      change.kind === 'items-cleared' ||
      change.workspaceKey === activeKey;

    switch (change.kind) {
      case 'active-workspace-changed':
        // Visible subset changes; cached TreeItems remain valid for
        // the items that are visible in the new workspace too.
        this.emitter.fire(undefined);
        return;

      case 'items-cleared':
        // The whole workspace was wiped. We don't track per-workspace
        // caches, so drop everything — items from other workspaces
        // will be lazily rebuilt on the next getChildren() call.
        this.itemCache.clear();
        if (change.workspaceKey === activeKey) {
          this.emitter.fire(undefined);
        }
        return;

      case 'items-added':
        // New items have new ids — nothing to invalidate in the cache.
        if (affectsActive) {
          this.emitter.fire(undefined);
        }
        return;

      case 'items-removed':
        for (const id of change.ids) {
          this.itemCache.delete(id);
        }
        if (affectsActive) {
          this.emitter.fire(undefined);
        }
        return;

      case 'content-changed':
      case 'ranges-changed':
        for (const id of change.ids) {
          this.itemCache.delete(id);
        }
        if (affectsActive) {
          this.emitter.fire(undefined);
        }
        return;
    }
  }

  getTreeItem(el: MergeTreeItem): vscode.TreeItem {
    return el;
  }

  getChildren(): MergeTreeItem[] {
    const sorted = [...this.store.all].sort((a, b) => {
      const pathCmp = a.relativePath.localeCompare(b.relativePath);
      if (pathCmp !== 0) {
        return pathCmp;
      }
      const aStart = a.range?.startLine ?? -1;
      const bStart = b.range?.startLine ?? -1;
      return aStart - bStart;
    });

    return sorted.map(item => {
      const cached = this.itemCache.get(item.id);
      if (cached) {
        return cached;
      }
      const fresh = new MergeTreeItem(item);
      this.itemCache.set(item.id, fresh);
      return fresh;
    });
  }

  dispose(): void {
    this.storeSub.dispose();
    this.emitter.dispose();
    this.itemCache.clear();
  }
}

export class WorkspacesTreeProvider
  implements vscode.TreeDataProvider<WorkspaceTreeItem>, vscode.Disposable
{
  private emitter = new vscode.EventEmitter<WorkspaceTreeItem | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  private storeSub: vscode.Disposable;

  constructor(private store: MergeStore) {
    this.storeSub = store.onDidChange(change => this.onStoreChange(change));
  }

  private onStoreChange(change: StoreChange): void {
    switch (change.kind) {
      case 'content-changed':
      case 'ranges-changed':
        // Neither the per-workspace item counts nor the "active"
        // marker change on a content/range edit, so this view has
        // nothing to re-render. Skip the refresh entirely.
        return;
      default:
        this.emitter.fire(undefined);
        return;
    }
  }

  getTreeItem(el: WorkspaceTreeItem): vscode.TreeItem {
    return el;
  }

  getChildren(): WorkspaceTreeItem[] {
    const active = this.store.getActiveWorkspace();
    const activeKey = active?.uri.toString();

    const wsItems = this.store.getWorkspacesWithItems().map(uriStr => {
      const uri = vscode.Uri.parse(uriStr);
      const folder = vscode.workspace.workspaceFolders?.find(
        f => f.uri.toString() === uriStr
      );
      const name = folder?.name ?? path.basename(uri.fsPath);
      const count = this.store.countForWorkspace(uriStr);
      return new WorkspaceTreeItem(uri, name, count, uriStr === activeKey);
    });

    wsItems.sort((a, b) => {
      if (a.isActive !== b.isActive) {
        return a.isActive ? -1 : 1;
      }
      return a.workspaceName.localeCompare(b.workspaceName);
    });

    return wsItems;
  }

  dispose(): void {
    this.storeSub.dispose();
    this.emitter.dispose();
  }
}