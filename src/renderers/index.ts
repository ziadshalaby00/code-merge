import { MergeItem } from '../core/types';
import { renderTree } from './treeRenderer';
import { renderPlain } from './plainRenderer';

/**
 * Summarizes an item list as "12 files, 3 selections" (or just one
 * side if the other is zero). Also handles the singular case.
 */
function summarize(items: readonly MergeItem[]): string {
  let files = 0;
  let selections = 0;

  for (const item of items) {
    if (item.kind === 'selection') {
      selections++;
    } else {
      files++;
    }
  }

  const parts: string[] = [];

  if (files > 0) {
    parts.push(`${files} ${files === 1 ? 'file' : 'files'}`);
  }
  if (selections > 0) {
    parts.push(
      `${selections} ${selections === 1 ? 'selection' : 'selections'}`
    );
  }

  return parts.join(', ');
}

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
  const count = summarize(items);

  const output = [
    `// ${divider}`,
    `// Project structure — ${rootName} (${count})`,
    `// ${divider}`,
    '',
    tree,
    '',
    '',
    body,
    '',
  ].join('\n');

  return output;
}