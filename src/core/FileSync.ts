import * as vscode from 'vscode';
import { MergeStore } from './MergeStore';
import { MergeItem } from './types';
import { MAX_FILE_SIZE } from './ignoreRules';

/**
 * Keeps item content in sync with the file system and the active editor.
 *
 * - FileSystemWatcher picks up saves from VS Code, external edits (git,
 *   other editors), and deletions.
 * - onDidChangeTextDocument picks up in-editor typing (unsaved), debounced
 *   per file so the preview doesn't re-render on every keystroke.
 *
 * Nothing is written to disk — this class only reads.
 */
export class FileSync implements vscode.Disposable {
  private static readonly EDIT_DEBOUNCE_MS = 250;

  private watcher: vscode.FileSystemWatcher;
  private disposables: vscode.Disposable[] = [];

  /**
   * One debounce timer per fsPath. Using a single shared timer would
   * drop updates when the user edits multiple files in quick succession
   * (e.g. multi-file refactor / Replace All).
   */
  private editTimers = new Map<string, NodeJS.Timeout>();

  constructor(private store: MergeStore) {
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*');

    this.disposables.push(
      this.watcher,
      this.watcher.onDidChange(uri => void this.syncFromDisk(uri)),
      this.watcher.onDidDelete(uri => this.removeByPath(uri)),
      vscode.workspace.onDidChangeTextDocument(e => this.onEdit(e))
    );
  }

  /** Re-reads a file from disk and updates every matching item. */
  private async syncFromDisk(uri: vscode.Uri): Promise<void> {
    if (!this.store.hasFsPath(uri.fsPath)) {
      return;
    }

    // If the file is open in an editor with unsaved changes, the editor
    // is the source of truth. Don't clobber the user's in-flight edits
    // with the on-disk version — syncFromEditor will pick them up.
    const openDoc = vscode.workspace.textDocuments.find(
      d => d.uri.scheme === 'file' && d.uri.fsPath === uri.fsPath
    );
    if (openDoc?.isDirty) {
      return;
    }

    // Stat before reading so we never pull a huge file into memory.
    let stat: vscode.FileStat;
    try {
      stat = await vscode.workspace.fs.stat(uri);
    } catch {
      // File vanished between the event and the stat — treat as delete.
      this.removeByPath(uri);
      return;
    }

    if (stat.type !== vscode.FileType.File) {
      // Path is no longer a regular file (became a directory or was
      // replaced by a symlink to something else). Drop it.
      this.removeByPath(uri);
      return;
    }

    if (stat.size > MAX_FILE_SIZE) {
      // File outgrew the merge limit — drop it, matching the size cap
      // applied at add time.
      this.removeByPath(uri);
      return;
    }

    let raw: string;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      raw = Buffer.from(bytes).toString('utf8');
    } catch {
      // Read failed between stat and read — treat as delete.
      this.removeByPath(uri);
      return;
    }

    if (raw.includes('\0')) {
      // File turned binary — drop it from the merge.
      this.removeByPath(uri);
      return;
    }

    this.applyContent(this.store.itemsByFsPath(uri.fsPath), raw);
  }

  /** In-editor edits (including unsaved) — debounced per file. */
  private onEdit(e: vscode.TextDocumentChangeEvent): void {
    // Only real files, not virtual documents (e.g. the preview itself).
    if (e.document.uri.scheme !== 'file') {
      return;
    }

    const fsPath = e.document.uri.fsPath;

    if (!this.store.hasFsPath(fsPath)) {
      return;
    }

    const existing = this.editTimers.get(fsPath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.editTimers.delete(fsPath);
      this.syncFromEditor(e.document);
    }, FileSync.EDIT_DEBOUNCE_MS);

    this.editTimers.set(fsPath, timer);
  }

  private syncFromEditor(doc: vscode.TextDocument): void {
    if (!this.store.hasFsPath(doc.uri.fsPath)) {
      return;
    }
    this.applyContent(
      this.store.itemsByFsPath(doc.uri.fsPath),
      doc.getText()
    );
  }

  /** Pushes new content into each item, honouring selection ranges. */
  private applyContent(items: readonly MergeItem[], raw: string): void {
    if (!items.length) {
      return;
    }

    const normalized = raw.replace(/\r\n?/g, '\n');
    const lines = normalized.split('\n');

    const updates = items.map(item => ({
      id: item.id,
      content: sliceForItem(item, lines),
    }));

    this.store.updateContents(updates);
  }

  private removeByPath(uri: vscode.Uri): void {
    this.store.removeByFsPath(uri.fsPath);
  }

  dispose(): void {
    for (const timer of this.editTimers.values()) {
      clearTimeout(timer);
    }
    this.editTimers.clear();

    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

/**
 * Extracts the slice a MergeItem represents from a normalized file text.
 * Whole-file items get the entire text; selection items get their range
 * (clamped to the file length so a shortened file doesn't crash).
 */
function sliceForItem(item: MergeItem, lines: readonly string[]): string {
  if (item.kind !== 'selection' || !item.range) {
    return lines.join('\n');
  }
  const start = Math.max(0, item.range.startLine - 1);
  const end = Math.min(lines.length, item.range.endLine);
  return lines.slice(start, end).join('\n');
}