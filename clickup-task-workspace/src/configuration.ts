import * as vscode from 'vscode';

const CONFIGURATION_SECTION = 'clickupTaskWorkspace';
const TOKEN_SECRET_KEY = 'clickupTaskWorkspace.apiToken';

export interface ExtensionSettings {
  largeAttachmentWarningBytes: number;
  tasksFolder: string;
  workspaceId: string;
}

export function getSettings(): ExtensionSettings {
  const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
  const workspaceId = configuration.get<string>('workspaceId', '').trim();
  const tasksFolder = configuration.get<string>('tasksFolder', 'tasks').trim();
  const warningMb = configuration.get<number>('largeAttachmentWarningMb', 100);

  if (!/^\d+$/.test(workspaceId)) {
    throw new Error('V nastavení ClickUp Task Workspace vyplňte platné číselné Workspace ID.');
  }
  if (!tasksFolder) {
    throw new Error('Nastavení cílové složky nesmí být prázdné.');
  }

  return {
    largeAttachmentWarningBytes: warningMb * 1024 * 1024,
    tasksFolder,
    workspaceId,
  };
}

export async function getApiToken(secrets: vscode.SecretStorage): Promise<string | undefined> {
  return await secrets.get(TOKEN_SECRET_KEY);
}

export async function promptAndStoreApiToken(secrets: vscode.SecretStorage): Promise<string | undefined> {
  const token = await vscode.window.showInputBox({
    ignoreFocusOut: true,
    password: true,
    placeHolder: 'pk_...',
    prompt: 'Zadejte osobní ClickUp API token',
    title: 'ClickUp Task Workspace',
    validateInput: (value) => value.trim() ? undefined : 'Token nesmí být prázdný.',
  });

  if (token === undefined) {
    return undefined;
  }

  const normalizedToken = token.trim();
  await secrets.store(TOKEN_SECRET_KEY, normalizedToken);
  return normalizedToken;
}

export async function clearApiToken(secrets: vscode.SecretStorage): Promise<void> {
  await secrets.delete(TOKEN_SECRET_KEY);
}
