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
    expect(requestedUrl).toContain('include_subtasks=true');
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

  it('načte parent task podle interního ID', async () => {
    const requestedUrls: string[] = [];
    const fetchMock: typeof fetch = (input) => {
      requestedUrls.push(input instanceof Request ? input.url : input.toString());
      return Promise.resolve(new Response(JSON.stringify({ custom_id: 'TTS-11645', id: 'parent-1', name: 'Parent' }), { status: 200 }));
    };
    const client = new ClickUpClient('token', fetchMock);

    await client.getTaskById('parent-1');

    expect(requestedUrls).toEqual([
      'https://api.clickup.com/api/v2/task/parent-1?include_subtasks=true',
    ]);
  });
});

describe('ClickUpClient.getComments', () => {
  it('načte rekurzivně odpovědi ve vláknu', async () => {
    const requestedUrls: string[] = [];
    const fetchMock: typeof fetch = (input) => {
      const url = input instanceof Request ? input.url : input.toString();
      requestedUrls.push(url);
      if (url.endsWith('/task/task-1/comment')) {
        return Promise.resolve(new Response(JSON.stringify({
          comments: [{ id: 'parent', comment_text: 'Nadřazený komentář', reply_count: 1 }],
        }), { status: 200 }));
      }
      if (url.endsWith('/comment/parent/reply')) {
        return Promise.resolve(new Response(JSON.stringify({
          comments: [{ id: 'child', comment_text: 'První odpověď', reply_count: 1 }],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        comments: [{ id: 'grandchild', comment_text: 'Vnořená odpověď' }],
      }), { status: 200 }));
    };
    const client = new ClickUpClient('token', fetchMock);

    const comments = await client.getComments('task-1');

    expect(requestedUrls).toEqual([
      'https://api.clickup.com/api/v2/task/task-1/comment',
      'https://api.clickup.com/api/v2/comment/parent/reply',
      'https://api.clickup.com/api/v2/comment/child/reply',
    ]);
    expect(comments[0]?.replies?.[0]?.replies?.[0]?.comment_text).toBe('Vnořená odpověď');
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
