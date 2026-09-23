import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { DownloadOptions } from '../network/download.js';
import { syncTaskFiles } from './taskFileSync.js';

const temporaryFolders: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryFolders.splice(0).map(async (folder) => await rm(folder, { force: true, recursive: true })));
});

describe('syncTaskFiles', () => {
  it('zapíše úplný export, ochrání rezervovaný název a ponechá stale přílohu', async () => {
    const targetFolder = await mkdtemp(path.join(os.tmpdir(), 'clickup-task-workspace-test-'));
    temporaryFolders.push(targetFolder);
    const downloadFile = async (options: DownloadOptions): Promise<void> => {
      await writeFile(options.destination, 'stažený obsah', 'utf8');
    };
    const task = {
      attachments: [{ id: 'a1', title: 'popis.md', url: 'https://example.com/popis.md' }],
      custom_id: 'TTS-1',
      id: 'internal-1',
      markdown_description: 'Text úkolu',
      name: 'Testovací úkol',
    };

    const firstResult = await syncTaskFiles({
      comments: [{ id: 'c1', comment_text: 'Komentář' }],
      downloadFile,
      targetFolder,
      task,
      workspaceId: '2422460',
    });

    expect(firstResult.downloadedFiles).toEqual(['popis_1.md']);
    expect(await readFile(path.join(targetFolder, 'popis_1.md'), 'utf8')).toBe('stažený obsah');
    expect(await readFile(firstResult.popisPath, 'utf8')).toContain('Testovací úkol');
    expect(await readFile(path.join(targetFolder, 'clickup-task.json'), 'utf8')).toContain('internal-1');
    expect(await readFile(path.join(targetFolder, 'clickup-comments.json'), 'utf8')).toContain('Komentář');
    expect(await readFile(path.join(targetFolder, 'clickup-task-relations.json'), 'utf8')).toContain('"parent": null');

    await syncTaskFiles({
      comments: [],
      downloadFile,
      targetFolder,
      task: { ...task, attachments: [] },
      workspaceId: '2422460',
    });

    expect(await readFile(path.join(targetFolder, 'popis_1.md'), 'utf8')).toBe('stažený obsah');
  });

  it('stáhne přílohy z komentáře i jeho vnořených odpovědí', async () => {
    const targetFolder = await mkdtemp(path.join(os.tmpdir(), 'clickup-task-workspace-test-'));
    temporaryFolders.push(targetFolder);
    const downloadedUrls: string[] = [];
    const downloadFile = async (options: DownloadOptions): Promise<void> => {
      downloadedUrls.push(options.url);
      await writeFile(options.destination, options.url, 'utf8');
    };

    const result = await syncTaskFiles({
      comments: [{
        attachments: [{ id: 'comment-image', title: 'image.png', url: 'https://example.com/comment.png' }],
        id: 'c1',
        replies: [{
          attachments: [{ id: 'reply-image', title: 'image.png', url: 'https://example.com/reply.png' }],
          id: 'c2',
        }],
      }],
      downloadFile,
      targetFolder,
      task: { id: 'task-1', name: 'Testovací úkol' },
      workspaceId: '2422460',
    });

    expect(downloadedUrls).toEqual(['https://example.com/comment.png', 'https://example.com/reply.png']);
    expect(result.downloadedFiles).toEqual(['image.png', 'image_1.png']);
    expect(await readFile(path.join(targetFolder, 'image.png'), 'utf8')).toBe('https://example.com/comment.png');
    expect(await readFile(path.join(targetFolder, 'image_1.png'), 'utf8')).toBe('https://example.com/reply.png');
    expect(await readFile(result.popisPath, 'utf8')).toContain('![image.png](./image.png)');
    expect(await readFile(result.popisPath, 'utf8')).toContain('![image.png](./image_1.png)');
  });

  it('zachová pořadí obrázků z rich textu vnořené odpovědi', async () => {
    const targetFolder = await mkdtemp(path.join(os.tmpdir(), 'clickup-task-workspace-test-'));
    temporaryFolders.push(targetFolder);

    const result = await syncTaskFiles({
      comments: [{
        id: 'c1',
        replies: [{
          comment: [
            {
              image: { id: 'first-image', name: 'first.png', url: 'https://example.com/first.png' },
              text: 'first.png',
              type: 'image',
            },
            { text: '\nMezi obrázky\n' },
            {
              image: { id: 'second-image', name: 'second.png', url: 'https://example.com/second.png' },
              text: 'second.png',
              type: 'image',
            },
          ],
          comment_text: 'first.png\nMezi obrázky\nsecond.png',
          id: 'c2',
        }],
      }],
      downloadFile: async (options) => await writeFile(options.destination, 'obrázek', 'utf8'),
      targetFolder,
      task: {
        attachments: [{
          id: 'second-image',
          mimetype: 'image/png',
          parent_id: 'c2',
          title: 'second.png',
          url: 'https://example.com/second.png',
        }, {
          id: 'first-image',
          mimetype: 'image/png',
          parent_id: 'c2',
          title: 'first.png',
          url: 'https://example.com/first.png',
        }],
        id: 'task-1',
        name: 'Testovací úkol',
      },
      workspaceId: '2422460',
    });

    const markdown = await readFile(result.popisPath, 'utf8');
    expect(markdown).toContain('![first.png](./first.png)');
    expect(markdown.indexOf('![first.png](./first.png)')).toBeLessThan(markdown.indexOf('Mezi obrázky'));
    expect(markdown.indexOf('Mezi obrázky')).toBeLessThan(markdown.indexOf('![second.png](./second.png)'));
    expect(await readFile(path.join(targetFolder, 'clickup-comments.json'), 'utf8')).toContain('"parent_id": "c2"');
  });

  it('ukládá custom ID parent tasku do samostatného exportu vztahů', async () => {
    const targetFolder = await mkdtemp(path.join(os.tmpdir(), 'clickup-task-workspace-test-'));
    temporaryFolders.push(targetFolder);

    await syncTaskFiles({
      comments: [],
      parentTask: { custom_id: 'TTS-11645', id: '123ymg9x0zm', name: 'Nadřazený task' },
      targetFolder,
      task: {
        id: 'child-1',
        name: 'Podřízený task',
        parent: '123ymg9x0zm',
        top_level_parent: '123ymg9x0zm',
      },
      workspaceId: '2422460',
    });

    const relationships = JSON.parse(await readFile(path.join(targetFolder, 'clickup-task-relations.json'), 'utf8')) as {
      parent: { custom_id?: string | null; id: string; name?: string } | null;
    };
    const exportedTask = JSON.parse(await readFile(path.join(targetFolder, 'clickup-task.json'), 'utf8')) as {
      parent: string;
      parent_task?: { custom_id?: string | null; id: string; name?: string };
    };
    expect(relationships.parent).toMatchObject({
      custom_id: 'TTS-11645',
      id: '123ymg9x0zm',
      name: 'Nadřazený task',
    });
    expect(exportedTask.parent).toBe('123ymg9x0zm');
    expect(exportedTask.parent_task).toMatchObject({
      custom_id: 'TTS-11645',
      id: '123ymg9x0zm',
      name: 'Nadřazený task',
    });
    const exportedTaskText = await readFile(path.join(targetFolder, 'clickup-task.json'), 'utf8');
    expect(exportedTaskText.indexOf('"parent"')).toBeLessThan(exportedTaskText.indexOf('"parent_task"'));
    expect(exportedTaskText.indexOf('"parent_task"')).toBeLessThan(exportedTaskText.indexOf('"top_level_parent"'));
  });
});
