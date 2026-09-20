import { access } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { ClickUpApiError, ClickUpClient } from '../clickup/clickupClient.js';
import { getApiToken, getSettings, promptAndStoreApiToken } from '../configuration.js';
import { parseTaskInput, sanitizeFolderName } from '../domain/taskInput.js';
import { syncTaskFiles } from '../files/taskFileSync.js';

const EXTERNAL_PATH_APPROVAL_KEY = 'approvedExternalTargetPaths';

export async function updateTaskCommand(context: vscode.ExtensionContext): Promise<void> {
  try {
    const settings = getSettings();
    const baseFolder = await resolveBaseFolder(settings.tasksFolder);
    if (!baseFolder || !await approveExternalPath(context, baseFolder)) {
      return;
    }

    const rawInput = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: 'TTS-7383, interní ID nebo https://app.clickup.com/t/...',
      prompt: 'Zadejte identifikátor nebo URL ClickUp úkolu',
      title: 'Aktualizovat ClickUp úkol',
    });
    if (rawInput === undefined) {
      return;
    }
    const input = parseTaskInput(rawInput);
    const token = await getApiToken(context.secrets) ?? await promptAndStoreApiToken(context.secrets);
    if (!token) {
      return;
    }

    const client = new ClickUpClient(token);
    const result = await vscode.window.withProgress(
      {
        cancellable: true,
        location: vscode.ProgressLocation.Notification,
        title: 'Aktualizuji ClickUp úkol',
      },
      async (progress, cancellationToken) => {
        const abortController = new AbortController();
        const cancellation = cancellationToken.onCancellationRequested(() => {
          abortController.abort(new Error('Operace byla zrušena.'));
        });

        try {
          progress.report({ message: 'Načítám detail úkolu...' });
          const task = await client.getTask(input, settings.workspaceId, abortController.signal);
          const folderName = sanitizeFolderName(task.custom_id || input.taskId);
          const targetFolder = path.join(baseFolder, folderName);
          const popisPath = path.join(targetFolder, 'popis.md');

          if (await fileExists(popisPath) && !await confirmOverwrite()) {
            return undefined;
          }

          progress.report({ message: 'Načítám komentáře...' });
          const comments = await client.getComments(task.id, abortController.signal);
          const approvedLargeFiles = new Set<string>();
          let approveAllLargeFiles = false;

          return await syncTaskFiles({
            comments,
            onDownloadHeaders: async (fileName, contentLength) => {
              if (approveAllLargeFiles || contentLength === undefined || contentLength < settings.largeAttachmentWarningBytes || approvedLargeFiles.has(fileName)) {
                return;
              }
              const sizeMb = (contentLength / 1024 / 1024).toFixed(1);
              const choice = await vscode.window.showWarningMessage(
                `Soubor ${fileName} má ${sizeMb} MB. Chcete pokračovat ve stahování?`,
                { modal: true },
                'Stáhnout',
                'Stáhnout vše',
              );
              if (!choice) {
                abortController.abort(new Error('Stahování bylo zrušeno.'));
                throw new Error('Stahování bylo zrušeno.');
              }
              if (choice === 'Stáhnout vše') {
                approveAllLargeFiles = true;
              } else {
                approvedLargeFiles.add(fileName);
              }
            },
            onDownloadProgress: (fileName, downloadProgress) => {
              const downloadedMb = (downloadProgress.bytesDownloaded / 1024 / 1024).toFixed(1);
              progress.report({ message: `Stahuji ${fileName} (${downloadedMb} MB)...` });
            },
            signal: abortController.signal,
            targetFolder,
            task,
            workspaceId: input.workspaceId ?? settings.workspaceId,
          });
        } finally {
          cancellation.dispose();
        }
      },
    );

    if (!result) {
      return;
    }

    const document = await vscode.workspace.openTextDocument(result.popisPath);
    await vscode.window.showTextDocument(document, { preview: false });
    void vscode.window.showInformationMessage(
      `ClickUp úkol byl aktualizován. Staženo souborů: ${result.downloadedFiles.length}.`,
    );
  } catch (error) {
    if (isCancellation(error)) {
      void vscode.window.showInformationMessage('Aktualizace ClickUp úkolu byla zrušena.');
      return;
    }
    void vscode.window.showErrorMessage(toUserMessage(error));
  }
}

async function resolveBaseFolder(configuredPath: string): Promise<string | undefined> {
  if (path.isAbsolute(configuredPath)) {
    return path.normalize(configuredPath);
  }

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  const activeRoot = activeUri ? vscode.workspace.getWorkspaceFolder(activeUri) : undefined;
  if (activeRoot) {
    assertFileWorkspace(activeRoot);
    return path.resolve(activeRoot.uri.fsPath, configuredPath);
  }

  const roots = vscode.workspace.workspaceFolders ?? [];
  if (roots.length === 0) {
    throw new Error('Pro relativní cílovou složku nejprve otevřete workspace.');
  }
  if (roots.length === 1) {
    const root = roots[0];
    if (!root) {
      throw new Error('Workspace root nebyl nalezen.');
    }
    assertFileWorkspace(root);
    return path.resolve(root.uri.fsPath, configuredPath);
  }

  const selected = await vscode.window.showQuickPick(
    roots.map((root) => ({ description: root.uri.fsPath, label: root.name, root })),
    { placeHolder: 'Aktivní soubor nepatří do workspace. Vyberte cílový root.' },
  );
  if (!selected) {
    return undefined;
  }
  assertFileWorkspace(selected.root);
  return path.resolve(selected.root.uri.fsPath, configuredPath);
}

function assertFileWorkspace(root: vscode.WorkspaceFolder): void {
  if (root.uri.scheme !== 'file') {
    throw new Error('Tato verze podporuje zápis pouze do lokálního souborového systému.');
  }
}

async function approveExternalPath(context: vscode.ExtensionContext, targetPath: string): Promise<boolean> {
  const workspacePaths = (vscode.workspace.workspaceFolders ?? [])
    .filter((root) => root.uri.scheme === 'file')
    .map((root) => root.uri.fsPath);
  if (workspacePaths.some((workspacePath) => isWithin(workspacePath, targetPath))) {
    return true;
  }

  const approvedPaths = new Set(context.globalState.get<string[]>(EXTERNAL_PATH_APPROVAL_KEY, []));
  const normalizedPath = path.resolve(targetPath);
  if (approvedPaths.has(normalizedPath)) {
    return true;
  }

  const choice = await vscode.window.showWarningMessage(
    `Cílová složka leží mimo otevřený workspace:\n${normalizedPath}`,
    { modal: true },
    'Povolit',
  );
  if (choice !== 'Povolit') {
    return false;
  }

  approvedPaths.add(normalizedPath);
  await context.globalState.update(EXTERNAL_PATH_APPROVAL_KEY, [...approvedPaths]);
  return true;
}

function isWithin(parentPath: string, candidatePath: string): boolean {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function confirmOverwrite(): Promise<boolean> {
  const choice = await vscode.window.showWarningMessage(
    'Soubor popis.md již existuje. Chcete jej aktualizovat?',
    { modal: true },
    'Aktualizovat',
  );
  return choice === 'Aktualizovat';
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function isCancellation(error: unknown): boolean {
  return error instanceof Error && /zrušen/i.test(error.message);
}

function toUserMessage(error: unknown): string {
  if (error instanceof ClickUpApiError) {
    if (error.status === 401) {
      return 'ClickUp token není platný. Nastavte jej znovu příkazem „Nastavit ClickUp API token“.';
    }
    if (error.status === 403) {
      return 'ClickUp odmítl přístup k úkolu. Zkontrolujte oprávnění tokenu.';
    }
    if (error.status === 404) {
      return 'ClickUp úkol nebyl nalezen. Zkontrolujte ID a Workspace ID.';
    }
    if (error.status === 429) {
      return 'ClickUp API překročilo limit požadavků. Zkuste aktualizaci později.';
    }
  }
  return error instanceof Error ? error.message : 'Aktualizace ClickUp úkolu selhala.';
}
