import { MergeItem } from '../core/types';
import { renderTree } from './treeRenderer';
import { renderPlain } from './plainRenderer';

/**
 * Renders the merged markdown for a single workspace.
 *
 * @param items    Items belonging to one workspace (already filtered).
 * @param rootName Name shown as the root of the project tree.
 *                 Typically the workspace folder name.
 */
export function renderMerged(
  items: readonly MergeItem[],
  rootName: string
): string {
  if (!items.length) {
    return `// Code Merge: no items selected in "${rootName}" yet.\n`;
  }

  const tree = renderTree(items, rootName);
  const body = renderPlain(items);

  const divider = '─'.repeat(60);

  const output = [
    `// ${divider}`,
    `// Project structure — ${rootName}`,
    `// ${divider}`,
    '',
    tree,
    '',
    '',
    body,
    '', // trailing newline for POSIX-friendliness
  ].join('\n');

  return output;
}