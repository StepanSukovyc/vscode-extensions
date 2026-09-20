import { mkdir, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { assertSafePublicUrl } from './safeUrl.js';

const MAX_REDIRECTS = 5;

export interface DownloadProgress {
  bytesDownloaded: number;
  contentLength?: number;
}

export interface DownloadOptions {
  destination: string;
  expectedImage: boolean;
  onHeaders?: (contentLength: number | undefined) => Promise<void>;
  onProgress?: (progress: DownloadProgress) => void;
  signal?: AbortSignal;
  url: string;
}

export async function downloadToFile(
  options: DownloadOptions,
  fetchImplementation: typeof fetch = globalThis.fetch,
): Promise<void> {
  await mkdir(path.dirname(options.destination), { recursive: true });
  let currentUrl = options.url;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const safeUrl = await assertSafePublicUrl(currentUrl);
    const response = await fetchImplementation(safeUrl, {
      redirect: 'manual',
      signal: options.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirects === MAX_REDIRECTS) {
        throw new Error('Externí zdroj obsahuje neplatný nebo příliš dlouhý řetězec přesměrování.');
      }
      currentUrl = new URL(location, safeUrl).toString();
      continue;
    }

    if (!response.ok || !response.body) {
      throw new Error(`Stažení souboru selhalo (HTTP ${response.status}).`);
    }

    const contentType = response.headers.get('content-type')?.toLowerCase();
    if (options.expectedImage && contentType && !contentType.startsWith('image/')) {
      throw new Error(`Externí obrázek vrátil nepodporovaný Content-Type ${contentType}.`);
    }

    const parsedLength = Number(response.headers.get('content-length'));
    const contentLength = Number.isFinite(parsedLength) && parsedLength >= 0 ? parsedLength : undefined;
    await options.onHeaders?.(contentLength);
    await streamResponse(response, options.destination, contentLength, options);
    return;
  }
}

async function streamResponse(
  response: Response,
  destination: string,
  contentLength: number | undefined,
  options: DownloadOptions,
): Promise<void> {
  const file = await open(destination, 'wx');
  const reader = response.body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined;
  let bytesDownloaded = 0;

  try {
    if (!reader) {
      throw new Error('Server nevrátil datový stream.');
    }
    while (true) {
      const readResult = await reader.read();
      if (readResult.done) {
        break;
      }
      if (options.signal?.aborted) {
        throw options.signal.reason;
      }
      await file.write(readResult.value);
      bytesDownloaded += readResult.value.byteLength;
      options.onProgress?.({ bytesDownloaded, contentLength });
    }
  } catch (error) {
    await file.close();
    await rm(destination, { force: true });
    throw error;
  }

  await file.close();
}
