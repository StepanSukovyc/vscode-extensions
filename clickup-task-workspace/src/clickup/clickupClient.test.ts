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
