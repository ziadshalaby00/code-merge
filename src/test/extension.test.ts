import * as assert from 'assert';
import * as vscode from 'vscode';

import { MergeStore } from '../core/MergeStore';
import { MergeItem } from '../core/types';
import { renderMerged } from '../renderers';
import { renderTree } from '../renderers/treeRenderer';
import { renderPlain } from '../renderers/plainRenderer';
import { shouldSkipDir, shouldSkipFile } from '../core/ignoreRules';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type FullMemento = vscode.Memento & {
  setKeysForSync(keys: readonly string[]): void;
};

/** In-memory Memento with the full interface expected by ExtensionContext. */
function makeMemento(): FullMemento {
  const memory = new Map<string, unknown>();
  return {
    keys: () => [...memory.keys()],
    get: <T>(key: string, defaultValue?: T): T => {
      return (memory.has(key) ? memory.get(key) : defaultValue) as T;
    },
    update: async (key: string, value: unknown): Promise<void> => {
      if (value === undefined) {
        memory.delete(key);
      } else {
        memory.set(key, value);
      }
    },
    setKeysForSync: () => {
      // No-op in tests: we don't need cross-device sync.
    },
  };
}

/** Minimal in-memory ExtensionContext for unit testing. */
function makeCtx(): vscode.ExtensionContext {
  const workspaceState = makeMemento();
  const globalState = makeMemento();

  return {
    subscriptions: [],
    workspaceState,
    globalState,
    extensionUri: vscode.Uri.file('/tmp/code-merge-test'),
    extensionPath: '/tmp/code-merge-test',
    environmentVariableCollection: {} as never,
    asAbsolutePath: (p: string) => p,
    storageUri: undefined,
    storagePath: undefined,
    globalStorageUri: vscode.Uri.file('/tmp/code-merge-test/global'),
    globalStoragePath: '/tmp/code-merge-test/global',
    logUri: vscode.Uri.file('/tmp/code-merge-test/log'),
    logPath: '/tmp/code-merge-test/log',
    extensionMode: vscode.ExtensionMode.Test,
    secrets: {} as never,
    extension: {} as never,
    languageModelAccessInformation: {} as never,
  };
}

const WS_A = 'file:///workspace/a';
const WS_B = 'file:///workspace/b';

function makeItem(overrides: Partial<MergeItem> = {}): MergeItem {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    kind: 'file',
    fsPath: '/workspace/a/src/index.ts',
    relativePath: 'src/index.ts',
    language: 'typescript',
    content: 'export const x = 1;',
    workspaceFolder: WS_A,
    addedAt: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite: ignoreRules
// ---------------------------------------------------------------------------

suite('ignoreRules', () => {
  test('skips common build/VCS directories', () => {
    for (const dir of ['node_modules', '.git', 'dist', 'build', '__pycache__']) {
      assert.strictEqual(shouldSkipDir(dir), true, `expected ${dir} to be skipped`);
    }
  });

  test('allows CI dot-directories', () => {
    assert.strictEqual(shouldSkipDir('.github'), false);
    assert.strictEqual(shouldSkipDir('.gitlab'), false);
    assert.strictEqual(shouldSkipDir('.devcontainer'), false);
  });

  test('skips arbitrary dot-directories', () => {
    assert.strictEqual(shouldSkipDir('.foo'), true);
    assert.strictEqual(shouldSkipDir('.cache'), true);
  });

  test('allows normal source directories', () => {
    assert.strictEqual(shouldSkipDir('src'), false);
    assert.strictEqual(shouldSkipDir('lib'), false);
  });

  test('skips lockfiles regardless of extension', () => {
    assert.strictEqual(shouldSkipFile('package-lock.json', 'json'), true);
    assert.strictEqual(shouldSkipFile('yarn.lock', 'lock'), true);
    assert.strictEqual(shouldSkipFile('Cargo.lock', 'lock'), true);
  });

  test('skips .env variants', () => {
    assert.strictEqual(shouldSkipFile('.env', ''), true);
    assert.strictEqual(shouldSkipFile('.env.local', 'local'), true);
  });

  test('skips binary/media extensions', () => {
    assert.strictEqual(shouldSkipFile('logo.png', 'png'), true);
    assert.strictEqual(shouldSkipFile('data.wasm', 'wasm'), true);
    assert.strictEqual(shouldSkipFile('app.exe', 'exe'), true);
  });

  test('allows normal source files', () => {
    assert.strictEqual(shouldSkipFile('index.ts', 'ts'), false);
    assert.strictEqual(shouldSkipFile('README.md', 'md'), false);
  });
});

// ---------------------------------------------------------------------------
// Suite: MergeStore
// ---------------------------------------------------------------------------

suite('MergeStore', () => {
  test('adds and reads back an item', () => {
    const store = new MergeStore(makeCtx());
    const ok = store.add(makeItem({ id: 'a1' }));
    assert.strictEqual(ok, true);
    assert.strictEqual(store.count, 1);
  });

  test('rejects duplicate files', () => {
    const store = new MergeStore(makeCtx());
    const item = makeItem({ id: 'a1' });
    assert.strictEqual(store.add(item), true);
    assert.strictEqual(store.add({ ...item, id: 'a2' }), false);
    assert.strictEqual(store.count, 1);
  });

  test('allows two selections at different ranges', () => {
    const store = new MergeStore(makeCtx());
    const base = makeItem({
      kind: 'selection',
      range: { startLine: 1, endLine: 5 },
    });
    assert.strictEqual(store.add({ ...base, id: 's1' }), true);
    assert.strictEqual(
      store.add({ ...base, id: 's2', range: { startLine: 10, endLine: 15 } }),
      true
    );
    assert.strictEqual(store.count, 2);
  });

  test('rejects duplicate selections with identical range', () => {
    const store = new MergeStore(makeCtx());
    const base = makeItem({
      kind: 'selection',
      range: { startLine: 1, endLine: 5 },
    });
    assert.strictEqual(store.add({ ...base, id: 's1' }), true);
    assert.strictEqual(store.add({ ...base, id: 's2' }), false);
  });

  test('addMany returns added/skipped counts', () => {
    const store = new MergeStore(makeCtx());
    const result = store.addMany([
      makeItem({ id: 'a1' }),
      makeItem({ id: 'a2' }), // duplicate of a1
      makeItem({ id: 'a3', fsPath: '/workspace/a/other.ts', relativePath: 'other.ts' }),
    ]);
    assert.strictEqual(result.added, 2);
    assert.strictEqual(result.skipped, 1);
    assert.strictEqual(store.count, 2);
  });

  test('isolates items per workspace', () => {
    const store = new MergeStore(makeCtx());

    store.setActiveWorkspace(vscode.Uri.parse(WS_A));
    store.add(makeItem({ id: 'a1', workspaceFolder: WS_A }));

    store.setActiveWorkspace(vscode.Uri.parse(WS_B));
    assert.strictEqual(store.count, 0, 'B should be empty after switching');

    store.add(
      makeItem({
        id: 'b1',
        workspaceFolder: WS_B,
        fsPath: '/workspace/b/main.ts',
        relativePath: 'main.ts',
      })
    );
    assert.strictEqual(store.count, 1);
    assert.strictEqual(store.all[0].workspaceFolder, WS_B);

    store.setActiveWorkspace(vscode.Uri.parse(WS_A));
    assert.strictEqual(store.count, 1);
    assert.strictEqual(store.all[0].workspaceFolder, WS_A);
  });

  test('clear removes only active-workspace items', () => {
    const store = new MergeStore(makeCtx());

    store.setActiveWorkspace(vscode.Uri.parse(WS_A));
    store.add(makeItem({ id: 'a1', workspaceFolder: WS_A }));

    store.setActiveWorkspace(vscode.Uri.parse(WS_B));
    store.add(
      makeItem({
        id: 'b1',
        workspaceFolder: WS_B,
        fsPath: '/workspace/b/main.ts',
        relativePath: 'main.ts',
      })
    );

    store.setActiveWorkspace(vscode.Uri.parse(WS_A));
    store.clear();

    assert.strictEqual(store.count, 0);
    store.setActiveWorkspace(vscode.Uri.parse(WS_B));
    assert.strictEqual(store.count, 1, 'B should be untouched');
  });

  test('remove targets a single id', () => {
    const store = new MergeStore(makeCtx());
    store.addMany([
      makeItem({ id: 'a1' }),
      makeItem({ id: 'a2', fsPath: '/workspace/a/x.ts', relativePath: 'x.ts' }),
    ]);
    store.remove('a1');
    assert.strictEqual(store.count, 1);
    assert.strictEqual(store.all[0].id, 'a2');
  });

  test('emits change events on mutation', () => {
    const store = new MergeStore(makeCtx());
    store.setActiveWorkspace(vscode.Uri.parse(WS_A));

    let events = 0;
    store.onDidChange(() => events++);

    store.add(makeItem({ id: 'a1' }));
    store.add(makeItem({ id: 'a2', fsPath: '/workspace/a/y.ts', relativePath: 'y.ts' }));
    store.remove('a1');
    store.clear();

    assert.ok(events >= 4, `expected >=4 events, got ${events}`);
  });
});

// ---------------------------------------------------------------------------
// Suite: renderers
// ---------------------------------------------------------------------------

suite('renderers', () => {
  test('renderMerged returns empty-state message for no items', () => {
    const out = renderMerged([], 'my-project');
    assert.ok(out.includes('no items selected'));
    assert.ok(out.includes('my-project'));
  });

  test('renderTree renders folders before files', () => {
    const items: MergeItem[] = [
      makeItem({ id: '1', relativePath: 'README.md', kind: 'file' }),
      makeItem({ id: '2', relativePath: 'src/index.ts', kind: 'file' }),
    ];
    const tree = renderTree(items, 'proj');
    const readmeIdx = tree.indexOf('README.md');
    const srcIdx = tree.indexOf('src/');
    assert.ok(srcIdx !== -1 && readmeIdx !== -1);
    assert.ok(srcIdx < readmeIdx, 'folder should come before file');
  });

  test('renderTree sorts selection ranges numerically', () => {
    const items: MergeItem[] = [
      makeItem({
        id: '1',
        relativePath: 'a.ts',
        kind: 'selection',
        range: { startLine: 100, endLine: 120 },
      }),
      makeItem({
        id: '2',
        relativePath: 'a.ts',
        kind: 'selection',
        range: { startLine: 10, endLine: 20 },
      }),
    ];
    const tree = renderTree(items, 'proj');
    const i10 = tree.indexOf('L10-L20');
    const i100 = tree.indexOf('L100-L120');
    assert.ok(i10 < i100, 'L10 should sort before L100');
  });

  test('renderTree shows "full" for whole-file items', () => {
    const items: MergeItem[] = [
      makeItem({ id: '1', relativePath: 'a.ts', kind: 'file' }),
    ];
    const tree = renderTree(items, 'proj');
    assert.ok(tree.includes('[full]'), tree);
  });

  test('renderPlain includes header with language and kind', () => {
    const items: MergeItem[] = [
      makeItem({
        id: '1',
        relativePath: 'src/index.ts',
        language: 'typescript',
        kind: 'file',
        content: 'export const x = 1;',
      }),
    ];
    const out = renderPlain(items);
    assert.ok(out.includes('src/index.ts'));
    assert.ok(out.includes('typescript'));
    assert.ok(out.includes('file'));
    assert.ok(out.includes('export const x = 1;'));
  });

  test('renderPlain normalizes CRLF to LF', () => {
    const items: MergeItem[] = [
      makeItem({ id: '1', content: 'line1\r\nline2\r\n' }),
    ];
    const out = renderPlain(items);
    assert.ok(!out.includes('\r'), 'output should not contain CR');
  });

  test('renderMerged includes both tree and body', () => {
    const items: MergeItem[] = [
      makeItem({ id: '1', relativePath: 'src/index.ts' }),
    ];
    const out = renderMerged(items, 'my-api');
    assert.ok(out.includes('my-api/'), 'tree root');
    assert.ok(out.includes('Project structure'), 'header');
    assert.ok(out.includes('src/index.ts'), 'body');
  });
});

// ---------------------------------------------------------------------------
// Suite: extension activation (smoke test)
// ---------------------------------------------------------------------------

suite('extension', () => {
  test('commands are registered after activation', async () => {
    // Trigger activation by executing a lightweight command.
    const all = await vscode.commands.getCommands(true);

    for (const id of [
      'code-merge.addFile',
      'code-merge.addFolder',
      'code-merge.addSelection',
      'code-merge.deleteItem',
      'code-merge.openPreview',
      'code-merge.copyAll',
      'code-merge.clearAll',
    ]) {
      assert.ok(all.includes(id), `missing command: ${id}`);
    }
  });
});