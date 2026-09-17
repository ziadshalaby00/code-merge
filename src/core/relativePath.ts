import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Returns a POSIX-style path relative to the workspace folder that owns it.
 *
 * Example:
 *   workspace: /home/user/projects/my-api
 *   file:      /home/user/projects/my-api/src/index.ts
 *   → "src/index.ts"
 *
 * If the URI is not inside any known workspace folder (which shouldn't
 * happen after the command-level guards), falls back to the basename.
 */
export function toRelative(uri: vscode.Uri): string {
  const relative = vscode.workspace.asRelativePath(uri, false);

  // asRelativePath returns the absolute path unchanged when the file is
  // outside any workspace. Detect that and fall back to the basename.
  if (path.isAbsolute(relative)) {
    return path.basename(uri.fsPath);
  }

  return relative.replace(/\\/g, '/');
}