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

    await syncTaskFiles({
      comments: [],
      downloadFile,
      targetFolder,
      task: { ...task, attachments: [] },
      workspaceId: '2422460',
    });

    expect(await readFile(path.join(targetFolder, 'popis_1.md'), 'utf8')).toBe('stažený obsah');
  });
});
