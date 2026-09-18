/**
 * Directories that are never useful for a "code merge" context.
 * Anything in here is skipped unconditionally during folder scans.
 */
const IGNORED_DIRS = new Set([
  // VCS
  '.git',
  '.svn',
  '.hg',
  '.bzr',

  // Node / JS ecosystem
  'node_modules',
  'dist',
  'out',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.angular',
  '.turbo',
  '.parcel-cache',
  '.cache',
  '.vercel',
  '.netlify',

  // Python
  '__pycache__',
  '.venv',
  'venv',
  'env',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.tox',
  '.eggs',
  'site-packages',
  'htmlcov',
  '.ipynb_checkpoints',

  // Rust / Go / Java / .NET
  'target',
  'bin',
  'obj',
  '.gradle',
  '.mvn',

  // IDE / editor
  '.vscode',
  '.vscode-test',
  '.idea',
  '.fleet',
  '.history',

  // Misc
  // Legacy: old versions wrote `.code-merge/merged.md` to disk.
  // Kept here so folder scans don't pick it up for existing users.
  '.code-merge',
  '.DS_Store',
  'tmp',
  'temp',
]);

/**
 * Dot-prefixed directories that we *do* want to traverse, because they
 * often contain useful config files (CI workflows, linting, etc.).
 * Anything else starting with `.` is skipped by default.
 */
const DOT_DIR_ALLOWLIST = new Set([
  '.github',
  '.gitlab',
  '.devcontainer',
]);

/**
 * File extensions that are always skipped — binaries, media, archives,
 * lockfiles, generated files, etc.
 */
const IGNORED_EXTENSIONS = new Set([
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
const IGNORED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'Gemfile.lock',
  'poetry.lock',
  'Pipfile.lock',
  'composer.lock',
  'bun.lockb',
  'go.sum',
  '.DS_Store',
  'Thumbs.db',
]);

export function shouldSkipDir(name: string): boolean {
  if (IGNORED_DIRS.has(name)) {
    return true;
  }

  // Dot directories: skip unless explicitly allow-listed.
  if (name.startsWith('.')) {
    return !DOT_DIR_ALLOWLIST.has(name);
  }

  return false;
}

export function shouldSkipFile(name: string, ext: string): boolean {
  // .env and variants: always skip — they may contain secrets.
  if (name === '.env' || name.startsWith('.env.')) {
    return true;
  }

  if (IGNORED_FILENAMES.has(name)) {
    return true;
  }

  if (IGNORED_EXTENSIONS.has(ext.toLowerCase())) {
    return true;
  }

  return false;
}

/** 5 MB — a single file larger than this is skipped during folder scans. */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;