import { MergeItem } from '../core/types';
import { renderTree } from './treeRenderer';
import { renderPlain } from './plainRenderer';

export function renderMerged(items: readonly MergeItem[], rootName = 'workspace' ): string {
  if (!items.length) {
    return '// Code Merge: no items yet.';
  }

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