import * as vscode from 'vscode';
import { MergeStore } from '../core/MergeStore';
import { MergeItem, MergeRange } from '../core/types';

const TOOLTIP_PREVIEW_CHARS = 400;

/**
 * Escapes markdown special characters so the tooltip renders correctly
 * regardless of what the user's file paths or content contain.
 */
function escapeMd(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&');
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

export class MergeTreeProvider
  implements vscode.TreeDataProvider<MergeTreeItem>, vscode.Disposable
{
  private emitter = new vscode.EventEmitter<MergeTreeItem | undefined>();
  readonly onDidChangeTreeData = this.emitter.event;

  private storeSub: vscode.Disposable;

  constructor(private store: MergeStore) {
    this.storeSub = store.onDidChange(() => this.emitter.fire(undefined));
  }

  getTreeItem(el: MergeTreeItem): vscode.TreeItem {
    return el;
  }

  getChildren(): MergeTreeItem[] {
    const sorted = [...this.store.all].sort((a, b) => {
      // Selections before files is debatable; pick something stable:
      // sort by relativePath first, then by start line.
      const pathCmp = a.relativePath.localeCompare(b.relativePath);
      if (pathCmp !== 0) {
        return pathCmp;
      }
      const aStart = a.range?.startLine ?? -1;
      const bStart = b.range?.startLine ?? -1;
      return aStart - bStart;
    });

    return sorted.map(item => new MergeTreeItem(item));
  }

  dispose(): void {
    this.storeSub.dispose();
    this.emitter.dispose();
  }
}