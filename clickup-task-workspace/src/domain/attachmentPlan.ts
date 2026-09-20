import { createHash } from 'node:crypto';
import path from 'node:path';
import type { ClickUpAttachment } from '../clickup/types.js';

export interface DownloadItem {
  fileName: string;
  key: string;
  kind: 'clickup' | 'external-image';
  size?: number;
  sourceUrls: string[];
  url: string;
}

export interface AttachmentPlan {
  downloads: DownloadItem[];
  sourceToFile: Record<string, string>;
}

export function buildAttachmentPlan(
  attachments: readonly ClickUpAttachment[],
  externalImageUrls: ReadonlySet<string>,
  existingNames: ReadonlySet<string>,
  previousMappings: Readonly<Record<string, string>> = {},
): AttachmentPlan {
  const usedNames = new Set([...existingNames].map((name) => name.toLowerCase()));
  const downloads: DownloadItem[] = [];
  const sourceToFile: Record<string, string> = {};

  for (const attachment of attachments) {
    const sourceUrls = uniqueStrings([attachment.url, attachment.url_w_query, attachment.url_w_host]);
    if (sourceUrls.length === 0) {
      continue;
    }

    const key = `clickup:${attachment.id}`;
    const preferredName = attachment.title || fileNameFromUrl(attachment.url) || attachment.id || 'priloha';
    const fileName = allocateName(preferredName, key, usedNames, previousMappings);
    const item: DownloadItem = {
      fileName,
      key,
      kind: 'clickup',
      size: attachment.size,
      sourceUrls,
      url: attachment.url,
    };
    downloads.push(item);
    for (const sourceUrl of sourceUrls) {
      sourceToFile[sourceUrl] = fileName;
    }
  }

  for (const url of externalImageUrls) {
    if (sourceToFile[url] !== undefined) {
      continue;
    }

    const hash = createHash('sha256').update(url).digest('hex').slice(0, 12);
    const extension = safeExtension(fileNameFromUrl(url));
    const key = `external:${hash}`;
    const fileName = allocateName(`external-${hash}${extension}`, key, usedNames, previousMappings);
    downloads.push({ fileName, key, kind: 'external-image', sourceUrls: [url], url });
    sourceToFile[url] = fileName;
  }

  return { downloads, sourceToFile };
}

function allocateName(
  preferredName: string,
  key: string,
  usedNames: Set<string>,
  previousMappings: Readonly<Record<string, string>>,
): string {
  const previousName = previousMappings[key];
  if (previousName) {
    usedNames.add(previousName.toLowerCase());
    return previousName;
  }

  const baseName = sanitizeFileName(preferredName);
  const extension = path.extname(baseName);
  const stem = path.basename(baseName, extension);
  let candidate = baseName;
  let suffix = 1;

  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${stem}_${suffix}${extension}`;
    suffix += 1;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

export function sanitizeFileName(value: string): string {
  const withoutControlCharacters = [...value]
    .map((character) => character.charCodeAt(0) < 32 ? '_' : character)
    .join('');
  const cleaned = withoutControlCharacters
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim() || 'priloha';
  const extension = path.extname(cleaned);
  const stemLimit = Math.max(1, 180 - extension.length);
  let stem = path.basename(cleaned, extension).slice(0, stemLimit);

  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) {
    stem = `_${stem}`;
  }

  return `${stem}${extension}`;
}

function fileNameFromUrl(value: string): string {
  try {
    return decodeURIComponent(path.posix.basename(new URL(value).pathname));
  } catch {
    return '';
  }
}

function safeExtension(fileName: string): string {
  const extension = path.extname(fileName);
  return /^\.[A-Za-z0-9]{1,10}$/.test(extension) ? extension.toLowerCase() : '';
}

function uniqueStrings(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
