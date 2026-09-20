import type { Definition, Image, ImageReference, Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';
import { visit } from 'unist-util-visit';
import type { ClickUpComment, ClickUpTaskDetail } from '../clickup/types.js';

export function collectExternalImageUrls(markdown: string): Set<string> {
  const tree = fromMarkdown(markdown);
  const referencedDefinitions = new Set<string>();
  const urls = new Set<string>();

  visit(tree, 'image', (node: Image) => addHttpUrl(urls, node.url));
  visit(tree, 'imageReference', (node: ImageReference) => {
    referencedDefinitions.add(node.identifier);
  });
  visit(tree, 'definition', (node: Definition) => {
    if (referencedDefinitions.has(node.identifier)) {
      addHttpUrl(urls, node.url);
    }
  });

  return urls;
}

export function rewriteImageUrls(markdown: string, sourceToFile: Readonly<Record<string, string>>): string {
  if (!markdown.trim()) {
    return '';
  }

  const tree: Root = fromMarkdown(markdown);
  const referencedDefinitions = new Set<string>();

  visit(tree, 'imageReference', (node: ImageReference) => {
    referencedDefinitions.add(node.identifier);
  });
  visit(tree, 'image', (node: Image) => {
    node.url = localUrl(sourceToFile[node.url]) ?? node.url;
  });
  visit(tree, 'definition', (node: Definition) => {
    if (referencedDefinitions.has(node.identifier)) {
      node.url = localUrl(sourceToFile[node.url]) ?? node.url;
    }
  });

  return toMarkdown(tree).trimEnd();
}

export function buildTaskMarkdown(
  task: ClickUpTaskDetail,
  comments: readonly ClickUpComment[],
  description: string,
  downloadedFiles: readonly string[],
): string {
  const normalizedDescription = removeLeadingDescriptionHeading(description);
  const lines = [
    '# ClickUp úkol',
    '',
    '## Název',
    '',
    task.name || 'Bez názvu',
    '',
    '## Základní údaje',
    '',
    `- **Custom ID:** ${formatScalar(task.custom_id)}`,
    `- **Interní ID:** ${formatScalar(task.id)}`,
    `- **URL:** ${task.url ? `[Otevřít v ClickUp](${task.url})` : 'Neuvedeno'}`,
    `- **Stav:** ${nestedName(task.status)}`,
    `- **Priorita:** ${nestedName(task.priority)}`,
    `- **Seznam:** ${nestedName(task.list)}`,
    `- **Složka:** ${nestedName(task.folder)}`,
    `- **Prostor:** ${nestedName(task.space)}`,
    `- **Vytvořeno:** ${formatDate(task.date_created)}`,
    `- **Aktualizováno:** ${formatDate(task.date_updated)}`,
    `- **Termín:** ${formatDate(task.due_date)}`,
    '',
    '## Popis',
    '',
    normalizedDescription || '_Bez popisu._',
    '',
    '## Komentáře',
    '',
    ...formatComments(comments),
    '',
    '## Stažené přílohy',
    '',
    ...(downloadedFiles.length > 0
      ? downloadedFiles.map((fileName) => `- [${escapeMarkdown(fileName)}](./${encodeURI(fileName)})`)
      : ['_Úkol nemá žádné stažené přílohy._']),
    '',
    '## Kompletní data úkolu',
    '',
    fencedJson(task),
    '',
    '## Kompletní data komentářů',
    '',
    fencedJson(comments),
    '',
  ];

  return lines.join('\n');
}

function removeLeadingDescriptionHeading(markdown: string): string {
  if (!markdown.trim()) {
    return '';
  }

  const tree = fromMarkdown(markdown);
  const firstNode = tree.children[0];
  if (firstNode?.type !== 'heading' || normalizeHeadingText(extractNodeText(firstNode)) !== 'popis') {
    return markdown;
  }

  tree.children.shift();
  return toMarkdown(tree).trimEnd();
}

function normalizeHeadingText(value: string): string {
  return value.trim().replace(/:$/, '').trim().toLocaleLowerCase('cs-CZ');
}

function extractNodeText(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return '';
  }

  const node = value as { alt?: unknown; children?: unknown; value?: unknown };
  if (typeof node.value === 'string') {
    return node.value;
  }
  if (typeof node.alt === 'string') {
    return node.alt;
  }
  return Array.isArray(node.children) ? node.children.map(extractNodeText).join('') : '';
}

function formatComments(comments: readonly ClickUpComment[]): string[] {
  if (comments.length === 0) {
    return ['_Bez komentářů._'];
  }

  return comments.flatMap((comment, index) => {
    const author = comment.user?.username || comment.user?.email || 'Neznámý autor';
    const text = extractText(comment.comment_text ?? comment.comment) || '_Bez textu._';
    return [
      `### ${index + 1}. ${escapeMarkdown(author)}`,
      '',
      `_${formatDate(comment.date)}_`,
      '',
      text,
      '',
    ];
  });
}

function extractText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(extractText).join('');
  }
  if (!value || typeof value !== 'object') {
    return '';
  }

  const data = value as Record<string, unknown>;
  const direct = typeof data.text === 'string'
    ? data.text
    : typeof data.label === 'string'
      ? data.label
      : '';
  return `${direct}${extractText(data.children)}`;
}

function nestedName(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return 'Neuvedeno';
  }
  const data = value as Record<string, unknown>;
  return formatScalar(data.status ?? data.priority ?? data.name ?? data.id);
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Neuvedeno';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return escapeMarkdown(String(value));
  }
  return escapeMarkdown(JSON.stringify(value));
}

function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Neuvedeno';
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return formatScalar(value);
  }
  const numericValue = Number(value);
  const date = Number.isFinite(numericValue) ? new Date(numericValue) : new Date(value);
  return Number.isNaN(date.valueOf()) ? formatScalar(value) : date.toLocaleString('cs-CZ');
}

function fencedJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  const longestFence = Math.max(3, ...([...json.matchAll(/`+/g)].map((match) => match[0].length + 1)));
  const fence = '`'.repeat(longestFence);
  return `${fence}json\n${json}\n${fence}`;
}

function addHttpUrl(urls: Set<string>, value: string): void {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      urls.add(value);
    }
  } catch {
    // Relativní odkazy nejsou externí zdroje.
  }
}

function localUrl(fileName: string | undefined): string | undefined {
  return fileName ? `./${encodeURI(fileName)}` : undefined;
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_[\]<>]/g, '\\$&');
}
