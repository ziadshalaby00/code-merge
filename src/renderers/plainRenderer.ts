import { MergeItem } from '../core/types';

export function renderPlain(items: readonly MergeItem[]): string {
  return items
    .map((it) => {
      const loc = it.range
        ? ` [L${it.range.startLine}-L${it.range.endLine}]`
        : '';
      const bar = '// ' + '─'.repeat(60);
      return [
        bar,
        `// ${it.relativePath}${loc}`,
        bar,
        it.content.replace(/\s+$/, ''),
      ].join('\n');
    })
    .join('\n\n');
}