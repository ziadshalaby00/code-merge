import { MergeItem } from '../core/types';

/**
 * Normalizes a code block:
 *  - Converts CRLF / CR to LF so output is consistent across OSes.
 *  - Strips trailing whitespace on each line.
 *  - Trims leading/trailing blank lines.
 */
function normalizeContent(raw: string): string {
  const unified = raw.replace(/\r\n?/g, '\n');
  const lines = unified.split('\n').map(line => line.replace(/[ \t]+$/, ''));
  return lines.join('\n').replace(/^\n+|\n+$/g, '');
}

function headerFor(item: MergeItem): string {
  const range = item.range
    ? ` [L${item.range.startLine}-L${item.range.endLine}]`
    : '';
  const kind = item.kind === 'selection' ? 'selection' : 'file';
  const lang = item.language ? ` (${item.language})` : '';

  return `// ${item.relativePath}${range}${lang} — ${kind}`;
}

export function renderPlain(items: readonly MergeItem[]): string {
  const divider = '─'.repeat(60);

  return items
    .map(item => {
      const header = headerFor(item);
      const content = normalizeContent(item.content);

      return [
        `// ${divider}`,
        header,
        `// ${divider}`,
        content,
      ].join('\n');
    })
    .join('\n\n');
}