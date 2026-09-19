import * as vscode from 'vscode';

/**
 * Adds the selected file/folder to the workspace `.code-mergeignore`
 * file (or whatever path is configured in
 * `code-merge.ignore.file`).
 */
export function ignorePathCommand(): vscode.Disposable {
  return vscode.commands.registerCommand(
    'code-merge.ignorePath',
    async (uri?: vscode.Uri) => {
      if (!uri) {
        return;
      }

      const folder = vscode.workspace.getWorkspaceFolder(uri);
      if (!folder) {
        vscode.window.showWarningMessage(
          'Code Merge: the selection is not inside a workspace.'
        );
        return;
      }

      const cfg = vscode.workspace.getConfiguration('code-merge');
      const ignoreFileName = cfg.get<string>(
        'ignore.file',
        '.code-mergeignore'
      );

      if (!ignoreFileName) {
        vscode.window.showWarningMessage(
          'Code Merge: no ignore file is configured. Set "code-merge.ignore.file" in Settings.'
        );
        return;
      }

      const rel = vscode.workspace
        .asRelativePath(uri, false)
        .replace(/\\/g, '/');

      const ignoreUri = vscode.Uri.joinPath(folder.uri, ignoreFileName);

      let existing = '';
      try {
        const bytes = await vscode.workspace.fs.readFile(ignoreUri);
        existing = Buffer.from(bytes).toString('utf8');
      } catch {
        // File doesn't exist yet.
      }

      const lines = existing
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(Boolean);

      if (lines.includes(rel) || lines.includes(rel + '/')) {
        vscode.window.showInformationMessage(
          `Code Merge: "${rel}" is already in ${ignoreFileName}.`
        );
        return;
      }

      const stat = await vscode.workspace.fs.stat(uri);
      const isDir = stat.type === vscode.FileType.Directory;
      const entry = isDir ? `${rel}/` : rel;

      const next =
        (existing ? existing.replace(/\s*$/, '\n') : '') + entry + '\n';

      await vscode.workspace.fs.writeFile(
        ignoreUri,
        Buffer.from(next, 'utf8')
      );

      vscode.window.showInformationMessage(
        `Code Merge: added "${entry}" to ${ignoreFileName}.`
      );
    }
  );
}