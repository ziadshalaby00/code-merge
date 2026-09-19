import * as vscode from 'vscode';
import ignore from 'ignore';
type Ignore = ReturnType<typeof ignore>;

/**
 * Directories that are never useful for a "code merge" context.
 * Anything in here is skipped unconditionally during folder scans.
 */
const DEFAULT_IGNORED_DIRS = new Set([
  // VCS
  '.git', '.svn', '.hg', '.bzr',

  // Node / JS ecosystem
  'node_modules', 'dist', 'out', 'build', 'coverage',
  '.next', '.nuxt', '.svelte-kit', '.angular', '.turbo',
  '.parcel-cache', '.cache', '.vercel', '.netlify',

  // Python
  '__pycache__', '.venv', 'venv', 'env',
  '.pytest_cache', '.mypy_cache', '.ruff_cache',
  '.tox', '.eggs', 'site-packages', 'htmlcov', '.ipynb_checkpoints',

  // Rust / Go / Java / .NET
  'target', 'bin', 'obj', '.gradle', '.mvn',

  // IDE / editor
  '.vscode', '.vscode-test', '.idea', '.fleet', '.history',

  // Misc
  // Legacy: old versions wrote `.code-merge/merged.md` to disk.
  // Kept here so folder scans don't pick it up for existing users.
  '.code-merge', '.DS_Store', 'tmp', 'temp',
]);

/**
 * Dot-prefixed directories that we *do* want to traverse by default.
 * Overridable via `code-merge.ignore.dotDirAllowlist`.
 */
const DEFAULT_DOT_DIR_ALLOWLIST = new Set([
  '.github', '.gitlab', '.devcontainer',
]);

/**
 * File extensions that are always skipped — binaries, media, archives,
 * lockfiles, generated files, etc.
 */
const DEFAULT_IGNORED_EXTENSIONS = new Set([
  // images
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'tiff', 'tif', 'avif',
  // audio / video
  'mp3', 'mp4', 'avi', 'mov', 'wav', 'flac', 'mkv', 'webm', 'ogg', 'm4a',
  // archives
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz',
  // executables / compiled
  'exe', 'dll', 'so', 'dylib', 'bin', 'class', 'jar', 'pyc', 'pyo', 'o', 'a',
  // documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  // fonts
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  // misc / generated
  'map', 'lock', 'wasm', 'snap',
  // databases
  'db', 'sqlite', 'sqlite3',
  // logs
  'log',
]);

/**
 * Exact filenames that are always skipped, regardless of extension.
 * These are typically lockfiles or generated manifests.
 */
const DEFAULT_IGNORED_FILENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'Cargo.lock', 'Gemfile.lock', 'poetry.lock', 'Pipfile.lock',
  'composer.lock', 'bun.lockb', 'go.sum',
  '.DS_Store', 'Thumbs.db',
]);

export const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

export class IgnoreRules {
  private additionalDirs = new Set<string>();
  private additionalExts = new Set<string>();
  private dotDirAllowlist = new Set<string>(DEFAULT_DOT_DIR_ALLOWLIST);
  private patternMatcher: Ignore = ignore();
  private _maxFileSize = DEFAULT_MAX_FILE_SIZE;

  /** Optional output channel for diagnostics. */
  private logChannel?: vscode.OutputChannel;

  constructor(logChannel?: vscode.OutputChannel) {
    this.logChannel = logChannel;
  }

  get maxFileSize(): number {
    return this._maxFileSize;
  }

  private log(message: string): void {
    this.logChannel?.appendLine(`[IgnoreRules] ${message}`);
  }

  async reload(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('code-merge');

    this.additionalDirs = new Set(
      cfg.get<string[]>('ignore.additionalDirs', [])
    );

    this.additionalExts = new Set(
      cfg
        .get<string[]>('ignore.additionalExtensions', [])
        .map(ext => ext.replace(/^\./, '').toLowerCase())
    );

    this.dotDirAllowlist = new Set(
      cfg.get<string[]>('ignore.dotDirAllowlist', [...DEFAULT_DOT_DIR_ALLOWLIST])
    );

    this._maxFileSize = cfg.get<number>('maxFileSizeMB', 5) * 1024 * 1024;

    this.patternMatcher = ignore();

    const inline = cfg.get<string[]>('ignore.additionalFilePatterns', []);
    if (inline.length) {
      this.patternMatcher.add(inline);
      this.log(`loaded ${inline.length} inline pattern(s)`);
    }

    const root = vscode.workspace.workspaceFolders?.[0]?.uri;

    const ignoreFileName = cfg.get<string>('ignore.file', '.code-mergeignore');
    if (root && ignoreFileName) {
      await this.loadIgnoreFile(
        vscode.Uri.joinPath(root, ignoreFileName),
        ignoreFileName
      );
    }

    if (root && cfg.get<boolean>('ignore.useGitignore', false)) {
      await this.loadIgnoreFile(
        vscode.Uri.joinPath(root, '.gitignore'),
        '.gitignore'
      );
    }

    this.log(`reload() complete — workspace root: ${root?.fsPath ?? '<none>'}`);
    this.log(`  additionalDirs: ${[...this.additionalDirs].join(', ') || '(none)'}`);
    this.log(`  additionalExts: ${[...this.additionalExts].join(', ') || '(none)'}`);
    this.log(`  additionalFilePatterns: ${inline.length ? inline.join(' | ') : '(none)'}`);
    this.log(`  dotDirAllowlist: ${[...this.dotDirAllowlist].join(', ')}`);
    this.log(`  maxFileSize: ${(this._maxFileSize / 1024 / 1024).toFixed(1)} MB`);
  }

  private async loadIgnoreFile(
    uri: vscode.Uri,
    label: string
  ): Promise<void> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(bytes).toString('utf8');
      const lineCount = text.split(/\r?\n/).filter(l => l.trim()).length;
      this.patternMatcher.add(text);
      this.log(`loaded ${label} (${lineCount} non-empty lines)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`could not read ${label} — ${msg}`);
    }
  }

  shouldSkipDir(name: string, relativePath: string): boolean {
    if (DEFAULT_IGNORED_DIRS.has(name)) {
      this.log(`skip dir "${relativePath}" (built-in dir list)`);
      return true;
    }
    if (this.additionalDirs.has(name)) {
      this.log(`skip dir "${relativePath}" (additionalDirs setting)`);
      return true;
    }
    if (name.startsWith('.') && !this.dotDirAllowlist.has(name)) {
      this.log(`skip dir "${relativePath}" (dot-dir, not allow-listed)`);
      return true;
    }
    if (relativePath && this.ig_ignores(relativePath, true)) {
      this.log(`skip dir "${relativePath}" (ignore pattern)`);
      return true;
    }
    return false;
  }

  shouldSkipFile(name: string, ext: string, relativePath: string): boolean {
    if (name === '.env' || name.startsWith('.env.')) {
      this.log(`skip file "${relativePath}" (.env)`);
      return true;
    }
    if (DEFAULT_IGNORED_FILENAMES.has(name)) {
      this.log(`skip file "${relativePath}" (built-in filename list)`);
      return true;
    }

    const lower = ext.toLowerCase();
    if (DEFAULT_IGNORED_EXTENSIONS.has(lower)) {
      this.log(`skip file "${relativePath}" (built-in extension .${lower})`);
      return true;
    }
    if (this.additionalExts.has(lower)) {
      this.log(`skip file "${relativePath}" (additionalExtensions .${lower})`);
      return true;
    }
    if (relativePath && this.ig_ignores(relativePath, false)) {
      this.log(`skip file "${relativePath}" (ignore pattern)`);
      return true;
    }
    return false;
  }

  private ig_ignores(relativePath: string, isDir: boolean): boolean {
    if (!relativePath) {
      return false;
    }
    const candidate = isDir ? relativePath.replace(/\/?$/, '/') : relativePath;
    try {
      return this.patternMatcher.ignores(candidate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log(`ignores("${candidate}") threw — ${msg}`);
      return false;
    }
  }
}