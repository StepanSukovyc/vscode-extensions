import { describe, expect, it } from 'vitest';
import { ClickUpClient } from './clickupClient.js';

describe('ClickUpClient.getTask', () => {
  it('přidá Workspace ID pro custom ID', async () => {
    const requestedUrls: string[] = [];
    const fetchMock: typeof fetch = (input) => {
      requestedUrls.push(input instanceof Request ? input.url : input.toString());
      return Promise.resolve(new Response(JSON.stringify({ id: '1', name: 'Task' }), { status: 200 }));
    };
    const client = new ClickUpClient('token', fetchMock);

    await client.getTask({ kind: 'custom', taskId: 'TTS-1' }, '2422460');

    const requestedUrl = requestedUrls[0] ?? '';
    expect(requestedUrl).toContain('/task/TTS-1?');
    expect(requestedUrl).toContain('custom_task_ids=true');
    expect(requestedUrl).toContain('team_id=2422460');
  });

  it('nepřidá custom parametry pro interní ID', async () => {
    const requestedUrls: string[] = [];
    const fetchMock: typeof fetch = (input) => {
      requestedUrls.push(input instanceof Request ? input.url : input.toString());
      return Promise.resolve(new Response(JSON.stringify({ id: 'abc', name: 'Task' }), { status: 200 }));
    };
    const client = new ClickUpClient('token', fetchMock);

    await client.getTask({ kind: 'internal', taskId: 'abc' }, '2422460');

    const requestedUrl = requestedUrls[0] ?? '';
    expect(requestedUrl).toContain('include_markdown_description=true');
    expect(requestedUrl).not.toContain('custom_task_ids');
  });
});

describe('ClickUpClient mutations', () => {
  it('aktualizuje úkol bez automatického retry', async () => {
    const requests: Array<{ init?: RequestInit; url: string }> = [];
    const fetchMock: typeof fetch = (input, init) => {
      requests.push({ init, url: input instanceof Request ? input.url : input.toString() });
      return Promise.resolve(new Response(JSON.stringify({ id: 'abc', name: 'Task' }), { status: 200 }));
    };
    const client = new ClickUpClient('token', fetchMock);

    await client.updateTask('abc', { status: 'QA REVIEW' });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toContain('/task/abc');
    expect(requests[0]?.init?.method).toBe('PUT');
    expect(requests[0]?.init?.headers).toMatchObject({ Authorization: 'token', 'Content-Type': 'application/json' });
    expect(requests[0]?.init?.body).toBe(JSON.stringify({ status: 'QA REVIEW' }));
  });

  it('vytváří komentář s čistým textem', async () => {
    let request: RequestInit | undefined;
    const fetchMock: typeof fetch = (_input, init) => {
      request = init;
      return Promise.resolve(new Response(JSON.stringify({ id: 'comment-1' }), { status: 200 }));
    };
    const client = new ClickUpClient('token', fetchMock);

    await client.createComment('abc', 'Chyba na řádku 2');

    expect(request?.method).toBe('POST');
    expect(request?.body).toBe(JSON.stringify({ comment_text: 'Chyba na řádku 2' }));
  });
});
