export const MERGE_ITEM_KINDS = ['file', 'selection'] as const;
export type MergeItemKind = (typeof MERGE_ITEM_KINDS)[number];

export interface MergeRange {
  /** 1-based line number of the first line (inclusive). */
  startLine: number;
  /** 1-based line number of the last line (inclusive). */
  endLine: number;
}

export interface MergeItem {
  /** Stable UUID — unique across all workspaces. */
  id: string;

  /** Whether this is a whole file or a code selection. */
  kind: MergeItemKind;

  /** Absolute path on disk (used for opening, dedup, and re-reads). */
  fsPath: string;

  /**
   * Path relative to the workspace root, always POSIX-style (`/`).
   * Shown in the tree view and in the merged output header.
   */
  relativePath: string;

  /**
   * Language identifier — either a VS Code languageId (for selections)
   * or the file extension without the dot (for whole files).
   */
  language: string;

  /**
   * Current content of the item.
   *
   * Captured at add time and kept in sync with the file system and the
   * active editor by FileSync. For selections, this is only the sliced
   * range, not the whole file.
   */
  content: string;

  /**
   * URI string of the owning workspace folder.
   * Every item belongs to exactly one workspace; the store filters by this.
   */
  workspaceFolder: string;

  /** Present only when `kind === 'selection'`. */
  range?: MergeRange;

  /** Timestamp (ms) when the item was added — used for stable sorting. */
  addedAt: number;
}