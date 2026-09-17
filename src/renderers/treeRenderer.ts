import { MergeItem } from '../core/types';

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  isFile: boolean;
  ranges: string[];
}

export function renderTree(
  items: readonly MergeItem[],
  rootName: string
): string {
  const root: TreeNode = {
    name: '',
    children: new Map(),
    isFile: false,
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
          isFile: false,
          ranges: [],
        });
      }
      node = node.children.get(part)!;
      if (i === parts.length - 1) {
        node.isFile = true;
        if (item.range) {
          node.ranges.push(`L${item.range.startLine}-L${item.range.endLine}`);
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
      const ranges = child.ranges.length
        ? `  [${child.ranges.join(', ')}]`
        : '';

      lines.push(`${prefix}${connector}${child.name}${folder}${ranges}`);
      walk(child, prefix + (last ? '    ' : '│   '));
    });
  };

  walk(root, '');
  return lines.join('\n');
}