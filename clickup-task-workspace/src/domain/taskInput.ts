export type TaskIdentifierKind = 'custom' | 'internal';

export interface ParsedTaskInput {
  kind: TaskIdentifierKind;
  taskId: string;
  workspaceId?: string;
}

const CUSTOM_TASK_ID = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;
const INTERNAL_TASK_ID = /^[A-Za-z0-9]+$/;

export function parseTaskInput(rawValue: string): ParsedTaskInput {
  const value = rawValue.trim();
  if (!value) {
    throw new Error('Zadejte ID nebo URL ClickUp úkolu.');
  }

  if (/^https?:\/\//i.test(value)) {
    return parseTaskUrl(value);
  }

  return parseIdentifier(value);
}

function parseTaskUrl(value: string): ParsedTaskInput {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Zadaná ClickUp URL není platná.');
  }

  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'app.clickup.com') {
    throw new Error('Je podporována pouze URL https://app.clickup.com/t/....');
  }

  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments[0]?.toLowerCase() !== 't' || segments.length < 2 || segments.length > 3) {
    throw new Error('ClickUp URL musí mít tvar /t/ID nebo /t/WORKSPACE_ID/ID.');
  }

  const taskId = segments.at(-1) ?? '';
  const parsed = parseIdentifier(taskId);
  const workspaceId = segments.length === 3 ? segments[1] : undefined;

  if (workspaceId !== undefined && !/^\d+$/.test(workspaceId)) {
    throw new Error('Workspace ID v ClickUp URL není platné.');
  }

  return { ...parsed, workspaceId };
}

function parseIdentifier(value: string): ParsedTaskInput {
  if (CUSTOM_TASK_ID.test(value)) {
    return { kind: 'custom', taskId: value.toUpperCase() };
  }

  if (INTERNAL_TASK_ID.test(value)) {
    return { kind: 'internal', taskId: value };
  }

  throw new Error('ID úkolu není platné. Použijte např. TTS-7383, interní ID nebo celou ClickUp URL.');
}

export function sanitizeFolderName(value: string): string {
  const withoutControlCharacters = [...value]
    .map((character) => character.charCodeAt(0) < 32 ? '_' : character)
    .join('');
  const sanitized = withoutControlCharacters
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();

  if (!sanitized) {
    throw new Error('Z identifikátoru nelze vytvořit název složky.');
  }

  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
  return (reserved.test(sanitized) ? `_${sanitized}` : sanitized).slice(0, 120);
}
