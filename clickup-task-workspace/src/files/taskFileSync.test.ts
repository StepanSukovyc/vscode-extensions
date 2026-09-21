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
