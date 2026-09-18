import * as vscode from 'vscode';
import * as path from 'path';
import { MergeStore } from './MergeStore';
import { MergeItem, MergeRange } from './types';
import { MAX_FILE_SIZE } from './ignoreRules';

export class FileSync implements vscode.Disposable {
  private static readonly EDIT_DEBOUNCE_MS = 250;

  private disposables: vscode.Disposable[] = [];

  /** One debounce timer per fsPath (multi-file edits don't clobber). */
  private editTimers = new Map<string, NodeJS.Timeout>();

  /**
   * files the user actually added are watched, and only for as long as
   * they remain in the store.
   */
  private watchers = new Map<string, vscode.FileSystemWatcher>();

  constructor(private store: MergeStore) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => this.onEdit(e)),
      // Whenever items are added/removed, resync our watcher set.
      store.onDidChange(() => this.reconcileWatchers())
    );

    // Initial sync with whatever's already tracked (usually empty at
    // activation, but harmless and future-proof).
    this.reconcileWatchers();
  }

  /**
   * Adds watchers for newly tracked files and disposes watchers for
   * files that are no longer tracked. Cheap when nothing changed.
   */
  private reconcileWatchers(): void {
    const wanted = new Set(this.store.allFsPaths);

    // New files: create a watcher.
    for (const fsPath of wanted) {
      if (this.watchers.has(fsPath)) {
        continue;
      }

      const dir = vscode.Uri.file(path.dirname(fsPath));
      const pattern = new vscode.RelativePattern(
        dir,
        path.basename(fsPath)
      );
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      watcher.onDidChange(uri => void this.syncFromDisk(uri));
      watcher.onDidDelete(uri => this.removeByPath(uri));

      this.watchers.set(fsPath, watcher);
    }

    // Removed files: dispose the watcher.
    for (const [fsPath, watcher] of [...this.watchers]) {
      if (!wanted.has(fsPath)) {
        watcher.dispose();
        this.watchers.delete(fsPath);
      }
    }
  }

  private async syncFromDisk(uri: vscode.Uri): Promise<void> {
    if (!this.store.hasFsPath(uri.fsPath)) {
      return;
    }

    const openDoc = vscode.workspace.textDocuments.find(
      d => d.uri.scheme === 'file' && d.uri.fsPath === uri.fsPath
    );
    if (openDoc?.isDirty) {
      return;
    }

    let stat: vscode.FileStat;
    try {
      stat = await vscode.workspace.fs.stat(uri);
    } catch {
      this.removeByPath(uri);
      return;
    }

    if (stat.type !== vscode.FileType.File) {
      this.removeByPath(uri);
      return;
    }

    if (stat.size > MAX_FILE_SIZE) {
      this.removeByPath(uri);
      return;
    }

    let raw: string;
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      raw = Buffer.from(bytes).toString('utf8');
    } catch {
      this.removeByPath(uri);
      return;
    }

    if (raw.includes('\0')) {
      this.removeByPath(uri);
      return;
    }

    this.clampSelectionRanges(uri.fsPath, raw);
    this.applyContent(this.store.itemsByFsPath(uri.fsPath), raw);
  }

  private onEdit(e: vscode.TextDocumentChangeEvent): void {
    if (e.document.uri.scheme !== 'file') {
      return;
    }

    const fsPath = e.document.uri.fsPath;

    if (!this.store.hasFsPath(fsPath)) {
      return;
    }

    this.adjustSelectionRanges(fsPath, e.contentChanges);

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

  private adjustSelectionRanges(
    fsPath: string,
    changes: readonly vscode.TextDocumentContentChangeEvent[]
  ): void {
    const items = this.store.itemsByFsPath(fsPath);
    const selections = items.filter(i => i.kind === 'selection' && i.range);
    if (!selections.length) {
      return;
    }

    const updates: { id: string; range: MergeRange | null }[] = [];
    for (const item of selections) {
      let range: MergeRange | null = item.range!;
      for (const change of changes) {
        if (!range) {
          break;
        }
        range = adjustRange(range, change);
      }
      updates.push({ id: item.id, range });
    }

    this.store.updateRanges(updates);
  }

  private clampSelectionRanges(fsPath: string, raw: string): void {
    const items = this.store.itemsByFsPath(fsPath);
    const selections = items.filter(i => i.kind === 'selection' && i.range);
    if (!selections.length) {
      return;
    }

    const lineCount = raw.split('\n').length;
    const updates: { id: string; range: MergeRange | null }[] = [];

    for (const item of selections) {
      const r = item.range!;
      if (r.startLine > lineCount) {
        updates.push({ id: item.id, range: null });
      } else if (r.endLine > lineCount) {
        updates.push({
          id: item.id,
          range: { startLine: r.startLine, endLine: lineCount },
        });
      }
    }

    if (updates.length) {
      this.store.updateRanges(updates);
    }
  }

  private syncFromEditor(doc: vscode.TextDocument): void {
    if (!this.store.hasFsPath(doc.uri.fsPath)) {
      return;
    }
    this.applyContent(this.store.itemsByFsPath(doc.uri.fsPath), doc.getText());
  }

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

    for (const w of this.watchers.values()) {
      w.dispose();
    }
    this.watchers.clear();

    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function adjustRange(
  range: MergeRange,
  change: vscode.TextDocumentContentChangeEvent
): MergeRange | null {
  const start0 = range.startLine - 1;
  const end0 = range.endLine - 1;

  const cs = change.range.start.line;
  const ce = change.range.end.line;

  const newNewlines = (change.text.match(/\n/g) || []).length;
  const delta = newNewlines - (ce - cs);

  if (delta === 0) {
    return range;
  }

  if (ce <= start0) {
    return {
      startLine: range.startLine + delta,
      endLine: range.endLine + delta,
    };
  }

  if (cs > end0) {
    return range;
  }

  const newEnd0 = end0 + delta;
  if (newEnd0 < start0) {
    return null;
  }

  return {
    startLine: range.startLine,
    endLine: newEnd0 + 1,
  };
}

function sliceForItem(item: MergeItem, lines: readonly string[]): string {
  if (item.kind !== 'selection' || !item.range) {
    return lines.join('\n');
  }
  const start = Math.max(0, item.range.startLine - 1);
  const end = Math.min(lines.length, item.range.endLine);
  return lines.slice(start, end).join('\n');
}