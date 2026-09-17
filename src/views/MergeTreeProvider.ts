import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';
import { MergeItem } from '../core/types';

export class MergeTreeItem extends vscode.TreeItem {
  constructor(public readonly data: MergeItem) {
    const label =
      data.kind === 'selection' && data.range
        ? `${data.relativePath} : ${data.range.startLine}-${data.range.endLine}`
        : data.relativePath;

    super(label, vscode.TreeItemCollapsibleState.None);

    this.id = data.id;
    this.description = data.kind === 'selection' ? 'selection' : '';
    this.contextValue = 'mergeItem';

    this.tooltip = new vscode.MarkdownString(
      [
        `**${data.fsPath}**`,
        '',
        `Kind: \`${data.kind}\``,
        data.range ? `Range: \`L${data.range.startLine}-L${data.range.endLine}\`` : '',
        '',
        '```' + data.language,
        data.content.slice(0, 400) + (data.content.length > 400 ? '\n…' : ''),
        '```',
      ].join('\n')
    );

    this.iconPath = new vscode.ThemeIcon(
      data.kind === 'selection' ? 'selection' : 'file'
    );
  }
}

export class MergeTreeProvider implements vscode.TreeDataProvider<MergeTreeItem> {
  private emitter = new vscode.EventEmitter<MergeTreeItem | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private store: MergeStore) {
    store.onDidChange(() => this.emitter.fire(undefined));
  }

  getTreeItem(el: MergeTreeItem): vscode.TreeItem {
    return el;
  }

  getChildren(): MergeTreeItem[] {
    return this.store.all.map(i => new MergeTreeItem(i));
  }
}