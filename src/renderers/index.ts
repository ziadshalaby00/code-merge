import * as vscode from 'vscode';
import { MergeItem } from '../core/types';
import { renderTree } from './treeRenderer';
import { renderPlain } from './plainRenderer';

export function renderMerged(items: readonly MergeItem[]): string {
  if (!items.length) {
    return '// Code Merge: no items yet.';
  }

  const rootName =
    vscode.workspace.workspaceFolders?.[0]?.name ?? 'workspace';

  const tree = renderTree(items, rootName);
  const body = renderPlain(items);

  const header = '// ' + '═'.repeat(60);

  return [
    header,
    '// Project structure',
    header,
    tree,
    '',
    '',
    body,
  ].join('\n');
}