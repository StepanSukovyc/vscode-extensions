import { describe, expect, it } from 'vitest';
import { ClockifyClient } from './clockifyClient.js';

describe('ClockifyClient', () => {
  it('načte aktivní workspace přihlášeného uživatele', async () => {
    let request: RequestInit | undefined;
    const fetchMock: typeof fetch = (_input, init) => {
      request = init;
      return Promise.resolve(new Response(JSON.stringify({ activeWorkspace: 'workspace-1', id: 'user-1' }), { status: 200 }));
    };
    const client = new ClockifyClient('clockify-token', fetchMock);

    await expect(client.getCurrentUser()).resolves.toEqual({ activeWorkspace: 'workspace-1', id: 'user-1' });
    expect(request?.headers).toMatchObject({ 'X-Api-Key': 'clockify-token' });
  });

  it('vytvoří time entry bez opakování požadavku', async () => {
    const requests: Array<{ init?: RequestInit; url: string }> = [];
    const fetchMock: typeof fetch = (input, init) => {
      requests.push({ init, url: input instanceof Request ? input.url : input.toString() });
      return Promise.resolve(new Response(JSON.stringify({ id: 'entry-1' }), { status: 201 }));
    };
    const client = new ClockifyClient('clockify-token', fetchMock);

    await client.createTimeEntry('workspace-1', {
      description: 'Dokumentace',
      end: '2026-03-11T08:30:00.000Z',
      projectId: 'project-1',
      start: '2026-03-11T08:15:00.000Z',
      tagIds: ['tag-1'],
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toContain('/workspaces/workspace-1/time-entries');
    expect(requests[0]?.init?.method).toBe('POST');
    expect(requests[0]?.init?.body).toBe(JSON.stringify({
      description: 'Dokumentace',
      end: '2026-03-11T08:30:00.000Z',
      projectId: 'project-1',
      start: '2026-03-11T08:15:00.000Z',
      tagIds: ['tag-1'],
    }));
  });

  it('přidá rozsah při načtení entry uživatele', async () => {
    let requestedUrl = '';
    const fetchMock: typeof fetch = (input) => {
      requestedUrl = input instanceof Request ? input.url : input.toString();
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    };
    const client = new ClockifyClient('clockify-token', fetchMock);

    await client.getTimeEntries('workspace-1', 'user-1', '2026-03-10T23:00:00.000Z', '2026-03-12T23:00:00.000Z');

    const url = new URL(requestedUrl);
    expect(url.pathname).toBe('/api/v1/workspaces/workspace-1/user/user-1/time-entries');
    expect(url.searchParams.get('start')).toBe('2026-03-10T23:00:00.000Z');
    expect(url.searchParams.get('end')).toBe('2026-03-12T23:00:00.000Z');
    expect(url.searchParams.get('page-size')).toBe('1000');
  });
});