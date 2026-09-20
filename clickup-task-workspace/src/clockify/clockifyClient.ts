import type { ClockifyEntity, ClockifyTimeEntry, ClockifyUser, CreateClockifyTimeEntry } from './types.js';

const DEFAULT_API_BASE_URL = 'https://api.clockify.me/api/v1';
const PAGE_SIZE = 1_000;

export class ClockifyApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = 'ClockifyApiError';
  }
}

export class ClockifyClient {
  public constructor(
    private readonly token: string,
    private readonly fetchImplementation: typeof fetch = globalThis.fetch,
    private readonly apiBaseUrl = DEFAULT_API_BASE_URL,
  ) {}

  public async getCurrentUser(signal?: AbortSignal): Promise<ClockifyUser> {
    return await this.requestJson<ClockifyUser>('/user', signal);
  }

  public async getProjects(workspaceId: string, signal?: AbortSignal): Promise<ClockifyEntity[]> {
    return await this.getPagedEntities(`/workspaces/${encodeURIComponent(workspaceId)}/projects`, signal);
  }

  public async getTags(workspaceId: string, signal?: AbortSignal): Promise<ClockifyEntity[]> {
    return await this.getPagedEntities(`/workspaces/${encodeURIComponent(workspaceId)}/tags`, signal);
  }

  public async getTimeEntries(
    workspaceId: string,
    userId: string,
    start: string,
    end: string,
    signal?: AbortSignal,
  ): Promise<ClockifyTimeEntry[]> {
    const path = `/workspaces/${encodeURIComponent(workspaceId)}/user/${encodeURIComponent(userId)}/time-entries`;
    const entries: ClockifyTimeEntry[] = [];

    for (let page = 1; ; page += 1) {
      const query = new URLSearchParams({ end, page: String(page), 'page-size': String(PAGE_SIZE), start });
      const response = await this.requestJson<ClockifyTimeEntry[]>(`${path}?${query.toString()}`, signal);
      entries.push(...response);
      if (response.length < PAGE_SIZE) {
        return entries;
      }
    }
  }

  public async createTimeEntry(
    workspaceId: string,
    entry: CreateClockifyTimeEntry,
    signal?: AbortSignal,
  ): Promise<ClockifyTimeEntry> {
    return await this.requestJson<ClockifyTimeEntry>(
      `/workspaces/${encodeURIComponent(workspaceId)}/time-entries`,
      signal,
      { body: JSON.stringify(entry), method: 'POST' },
    );
  }

  private async getPagedEntities(endpoint: string, signal?: AbortSignal): Promise<ClockifyEntity[]> {
    const entities: ClockifyEntity[] = [];
    for (let page = 1; ; page += 1) {
      const query = new URLSearchParams({ archived: 'false', page: String(page), 'page-size': String(PAGE_SIZE) });
      const response = await this.requestJson<ClockifyEntity[]>(`${endpoint}?${query.toString()}`, signal);
      entities.push(...response);
      if (response.length < PAGE_SIZE) {
        return entities;
      }
    }
  }

  private async requestJson<T>(
    endpoint: string,
    signal?: AbortSignal,
    options: { body?: string; method?: 'GET' | 'POST' } = {},
  ): Promise<T> {
    const response = await this.fetchImplementation(`${this.apiBaseUrl}${endpoint}`, {
      body: options.body,
      headers: {
        Accept: 'application/json',
        'X-Api-Key': this.token,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      method: options.method ?? 'GET',
      signal,
    });
    if (response.ok) {
      return await response.json() as T;
    }

    throw new ClockifyApiError(
      `Clockify API vrátilo HTTP ${response.status}.`,
      response.status,
      await response.text(),
    );
  }
}