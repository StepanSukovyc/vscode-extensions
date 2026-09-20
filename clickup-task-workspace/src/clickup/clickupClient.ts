import type { ParsedTaskInput } from '../domain/taskInput.js';
import type { ClickUpComment, ClickUpCommentsResponse, ClickUpTaskDetail } from './types.js';

const DEFAULT_API_BASE_URL = 'https://api.clickup.com/api/v2';
const COMMENT_PAGE_SIZE = 25;
const MAX_RETRIES = 3;

export class ClickUpApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = 'ClickUpApiError';
  }
}

export class ClickUpClient {
  public constructor(
    private readonly token: string,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
    private readonly apiBaseUrl = DEFAULT_API_BASE_URL,
  ) {}

  public async getTask(
    input: ParsedTaskInput,
    configuredWorkspaceId: string,
    signal?: AbortSignal,
  ): Promise<ClickUpTaskDetail> {
    const query = new URLSearchParams({ include_markdown_description: 'true' });
    if (input.kind === 'custom') {
      query.set('custom_task_ids', 'true');
      query.set('team_id', input.workspaceId ?? configuredWorkspaceId);
    }

    return await this.requestJson<ClickUpTaskDetail>(
      `/task/${encodeURIComponent(input.taskId)}?${query.toString()}`,
      signal,
    );
  }

  public async getComments(taskId: string, signal?: AbortSignal): Promise<ClickUpComment[]> {
    const comments: ClickUpComment[] = [];
    let start: string | undefined;
    let startId: string | undefined;

    while (true) {
      const query = new URLSearchParams();
      if (start && startId) {
        query.set('start', start);
        query.set('start_id', startId);
      }
      const suffix = query.size > 0 ? `?${query.toString()}` : '';
      const response = await this.requestJson<ClickUpCommentsResponse | ClickUpComment[]>(
        `/task/${encodeURIComponent(taskId)}/comment${suffix}`,
        signal,
      );
      const page = Array.isArray(response) ? response : response.comments ?? [];
      if (page.length === 0) {
        break;
      }

      comments.push(...page);
      if (page.length < COMMENT_PAGE_SIZE) {
        break;
      }

      const lastComment = page.at(-1);
      if (!lastComment?.date || !lastComment.id) {
        break;
      }
      if (start === lastComment.date && startId === lastComment.id) {
        break;
      }
      start = lastComment.date;
      startId = lastComment.id;
    }

    return comments.reverse();
  }

  private async requestJson<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      const response = await this.fetchImplementation(`${this.apiBaseUrl}${endpoint}`, {
        headers: {
          Accept: 'application/json',
          Authorization: this.token,
        },
        signal,
      });

      if (response.ok) {
        return await response.json() as T;
      }

      const body = await response.text();
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === MAX_RETRIES) {
        throw new ClickUpApiError(
          `ClickUp API vrátilo HTTP ${response.status}.`,
          response.status,
          body,
        );
      }

      await abortableDelay(retryDelayMs(response, attempt), signal);
    }

    throw new Error('ClickUp požadavek skončil v neočekávaném stavu.');
  }
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1_000, 30_000);
    }
  }
  return Math.min(500 * 2 ** attempt, 5_000);
}

async function abortableDelay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw signal.reason;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason instanceof Error ? signal.reason : new Error('Operace byla zrušena.'));
    }, { once: true });
  });
}
