import * as vscode from 'vscode';

const CONFIGURATION_SECTION = 'clickupTaskWorkspace';
const TOKEN_SECRET_KEY = 'clickupTaskWorkspace.apiToken';
const CLOCKIFY_TOKEN_SECRET_KEY = 'clickupTaskWorkspace.clockifyApiToken';

export interface ExtensionSettings {
  clockifyApiBaseUrl: string;
  largeAttachmentWarningBytes: number;
  tasksFolder: string;
  workspaceId: string;
}

export function getSettings(): ExtensionSettings {
  const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION);
  const workspaceId = configuration.get<string>('workspaceId', '').trim();
  const tasksFolder = configuration.get<string>('tasksFolder', 'tasks').trim();
  const warningMb = configuration.get<number>('largeAttachmentWarningMb', 100);
  const clockifyApiBaseUrl = configuration.get<string>('clockifyApiBaseUrl', 'https://api.clockify.me/api/v1').trim().replace(/\/+$/, '');

  if (!/^\d+$/.test(workspaceId)) {
    throw new Error('V nastavení ClickUp Task Workspace vyplňte platné číselné Workspace ID.');
  }
  if (!tasksFolder) {
    throw new Error('Nastavení cílové složky nesmí být prázdné.');
  }
  try {
    const url = new URL(clockifyApiBaseUrl);
    if (url.protocol !== 'https:') {
      throw new Error();
    }
  } catch {
    throw new Error('Clockify API URL musí být platná HTTPS adresa.');
  }

  return {
    clockifyApiBaseUrl,
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

export async function getClockifyApiToken(secrets: vscode.SecretStorage): Promise<string | undefined> {
  return await secrets.get(CLOCKIFY_TOKEN_SECRET_KEY);
}

export async function promptAndStoreClockifyApiToken(secrets: vscode.SecretStorage): Promise<string | undefined> {
  const token = await vscode.window.showInputBox({
    ignoreFocusOut: true,
    password: true,
    prompt: 'Zadejte Clockify API token',
    title: 'ClickUp Task Workspace',
    validateInput: (value) => value.trim() ? undefined : 'Token nesmí být prázdný.',
  });

  if (token === undefined) {
    return undefined;
  }

  const normalizedToken = token.trim();
  await secrets.store(CLOCKIFY_TOKEN_SECRET_KEY, normalizedToken);
  return normalizedToken;
}

export async function clearClockifyApiToken(secrets: vscode.SecretStorage): Promise<void> {
  await secrets.delete(CLOCKIFY_TOKEN_SECRET_KEY);
}
