export type MergeItemKind = 'file' | 'selection';

export interface MergeItem {
  id: string;
  kind: MergeItemKind;
  fsPath: string;
  relativePath: string; 
  language: string;
  content: string;
  range?: { startLine: number; endLine: number };
  addedAt: number;
}