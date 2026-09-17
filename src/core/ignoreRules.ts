const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'out',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.cache',
  '.vscode',
  '.idea',
  '__pycache__',
  '.venv',
  'venv',
  'env',
  'target',
  'bin',
  'obj',
  '.code-merge',
]);

const DEFAULT_IGNORED_EXTENSIONS = new Set([
  // images
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg', 'tiff',
  // images and videos
  'mp3', 'mp4', 'avi', 'mov', 'wav', 'flac', 'mkv', 'webm',
  // archives
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
  // executables
  'exe', 'dll', 'so', 'dylib', 'bin', 'class', 'jar', 'pyc',
  // documents
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  // fonts
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  // misc
  'lock', 'map',
]);

export function shouldSkipDir(name: string): boolean {
  return DEFAULT_IGNORED_DIRS.has(name) || name.startsWith('.');
}

export function shouldSkipFile(name: string, ext: string): boolean {
  if (name === '.env' || name.startsWith('.env.')) {
    return true;
  }

  if (DEFAULT_IGNORED_EXTENSIONS.has(ext.toLowerCase())) {
    return true;
  }
  return false;
}

export const MAX_FILE_SIZE = 1024 * 1024 * 5; // 5 MB