import { MergeItem } from '../core/types';

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  /** True if a full-file item exists at this path. */
  hasFullFile: boolean;
  /** Selections pointing at this path, formatted as `L{start}-L{end}`. */
  ranges: { start: number; end: number }[];
}

function sortRanges(
  ranges: { start: number; end: number }[]
): { start: number; end: number }[] {
  return [...ranges].sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    return a.end - b.end;
  });
}

function formatRanges(
  hasFullFile: boolean,
  ranges: { start: number; end: number }[]
): string {
  const parts: string[] = [];

  if (hasFullFile) {
    parts.push('full');
  }

  for (const r of sortRanges(ranges)) {
    parts.push(`L${r.start}-L${r.end}`);
  }

  if (!parts.length) {
    return '';
  }

  return `  [${parts.join(', ')}]`;
}

export function renderTree(
  items: readonly MergeItem[],
  rootName: string
): string {
  const root: TreeNode = {
    name: '',
    children: new Map(),
    hasFullFile: false,
    ranges: [],
  };

  for (const item of items) {
    const parts = item.relativePath.split('/').filter(Boolean);
    let node = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          children: new Map(),
          hasFullFile: false,
          ranges: [],
        });
      }
      node = node.children.get(part)!;

      if (i === parts.length - 1) {
        if (item.kind === 'file') {
          node.hasFullFile = true;
        } else if (item.range) {
          node.ranges.push({
            start: item.range.startLine,
            end: item.range.endLine,
          });
        }
      }
    }
  }

  const lines: string[] = [`${rootName}/`];

  const walk = (node: TreeNode, prefix: string): void => {
    const children = [...node.children.values()].sort((a, b) => {
      const aFolder = a.children.size > 0;
      const bFolder = b.children.size > 0;
      if (aFolder !== bFolder) {
        return aFolder ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    children.forEach((child, i) => {
      const last = i === children.length - 1;
      const connector = last ? '└── ' : '├── ';
      const isFolder = child.children.size > 0;
      const folder = isFolder ? '/' : '';
      const ranges = formatRanges(child.hasFullFile, child.ranges);

      lines.push(`${prefix}${connector}${child.name}${folder}${ranges}`);
      walk(child, prefix + (last ? '    ' : '│   '));
    });
  };

  walk(root, '');
  return lines.join('\n');
}