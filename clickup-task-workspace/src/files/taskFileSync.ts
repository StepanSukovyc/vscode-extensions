import { copyFile, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ClickUpComment, ClickUpTaskDetail } from '../clickup/types.js';
import { buildAttachmentPlan } from '../domain/attachmentPlan.js';
import { buildTaskMarkdown, collectExternalImageUrls, rewriteImageUrls } from '../domain/taskMarkdown.js';
import { downloadToFile, type DownloadProgress } from '../network/download.js';

const MANIFEST_FILE = '.clickup-task-workspace.json';
const RELATIONSHIPS_FILE = 'clickup-task-relations.json';
const GENERATED_FILES = ['clickup-task.json', 'clickup-comments.json', RELATIONSHIPS_FILE, MANIFEST_FILE, 'popis.md'];

interface SyncManifest {
  mappings: Record<string, string>;
  taskId: string;
  updatedAt?: string;
  version: 1;
  workspaceId: string;
}

export interface TaskFileSyncOptions {
  comments: readonly ClickUpComment[];
  downloadFile?: typeof downloadToFile;
  onDownloadHeaders?: (fileName: string, contentLength: number | undefined) => Promise<void>;
  onDownloadProgress?: (fileName: string, progress: DownloadProgress) => void;
  parentTask?: ClickUpTaskDetail;
  signal?: AbortSignal;
  targetFolder: string;
  task: ClickUpTaskDetail;
  workspaceId: string;
}

export interface TaskFileSyncResult {
  downloadedFiles: string[];
  popisPath: string;
}

interface TaskRelationshipsExport {
  dependencies: ClickUpTaskDetail['dependencies'];
  parent: {
    custom_id?: string | null;
    id: string;
    name?: string;
    url?: string;
  } | null;
  subtasks: ClickUpTaskDetail['subtasks'];
  top_level_parent: string | null | undefined;
}

interface ExportedParentTask {
  custom_id?: string | null;
  id: string;
  name?: string;
  url?: string;
}

export async function syncTaskFiles(options: TaskFileSyncOptions): Promise<TaskFileSyncResult> {
  await mkdir(options.targetFolder, { recursive: true });
  const existingNames = new Set(await readdir(options.targetFolder));
  for (const generatedFile of GENERATED_FILES) {
    existingNames.add(generatedFile);
  }
  const previousManifest = await readManifest(path.join(options.targetFolder, MANIFEST_FILE));
  const sourceDescription = options.task.markdown_description
    ?? options.task.description
    ?? options.task.text_content
    ?? '';
  const externalImages = collectExternalImageUrls(sourceDescription);
  const plan = buildAttachmentPlan(
    options.task.attachments ?? [],
    externalImages,
    existingNames,
    previousManifest?.mappings,
  );
  const stagingFolder = await mkdtemp(path.join(options.targetFolder, '.clickup-task-workspace-'));
  const downloadFile = options.downloadFile ?? downloadToFile;

  try {
    for (const item of plan.downloads) {
      await downloadFile({
        destination: path.join(stagingFolder, item.fileName),
        expectedImage: item.kind === 'external-image',
        onHeaders: async (contentLength) => await options.onDownloadHeaders?.(item.fileName, contentLength),
        onProgress: (progress) => options.onDownloadProgress?.(item.fileName, progress),
        signal: options.signal,
        url: item.url,
      });
    }

    const rewrittenDescription = rewriteImageUrls(sourceDescription, plan.sourceToFile);
    const downloadedFiles = plan.downloads.map((item) => item.fileName);
    const markdown = buildTaskMarkdown(options.task, options.comments, rewrittenDescription, downloadedFiles, options.parentTask);
    const relationships = buildRelationshipsExport(options.task, options.parentTask);
    const exportedTask = buildTaskExport(options.task, options.parentTask);
    const manifest: SyncManifest = {
      mappings: Object.fromEntries(plan.downloads.map((item) => [item.key, item.fileName])),
      taskId: options.task.id,
      updatedAt: options.task.date_updated,
      version: 1,
      workspaceId: options.workspaceId,
    };

    await writeFile(path.join(stagingFolder, 'clickup-task.json'), `${JSON.stringify(exportedTask, null, 2)}\n`, 'utf8');
    await writeFile(path.join(stagingFolder, 'clickup-comments.json'), `${JSON.stringify(options.comments, null, 2)}\n`, 'utf8');
    await writeFile(path.join(stagingFolder, RELATIONSHIPS_FILE), `${JSON.stringify(relationships, null, 2)}\n`, 'utf8');
    await writeFile(path.join(stagingFolder, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await writeFile(path.join(stagingFolder, 'popis.md'), markdown, 'utf8');

    const commitOrder = [...downloadedFiles, ...GENERATED_FILES];
    await commitStagedFiles(stagingFolder, options.targetFolder, commitOrder);
    return { downloadedFiles, popisPath: path.join(options.targetFolder, 'popis.md') };
  } finally {
    await rm(stagingFolder, { force: true, recursive: true });
  }
}

function buildRelationshipsExport(task: ClickUpTaskDetail, parentTask?: ClickUpTaskDetail): TaskRelationshipsExport {
  return {
    dependencies: task.dependencies,
    parent: parentTask
      ? {
        custom_id: parentTask.custom_id,
        id: parentTask.id,
        name: parentTask.name,
        url: parentTask.url,
      }
      : task.parent
        ? { id: task.parent }
        : null,
    subtasks: task.subtasks,
    top_level_parent: task.top_level_parent,
  };
}

function buildTaskExport(task: ClickUpTaskDetail, parentTask?: ClickUpTaskDetail): ClickUpTaskDetail & { parent_task?: ExportedParentTask } {
  const { parent, top_level_parent, ...otherTaskProperties } = task;
  const parentReference = parentTask
    ? {
      custom_id: parentTask.custom_id,
      id: parentTask.id,
      name: parentTask.name,
      url: parentTask.url,
    }
    : parent
      ? { id: parent }
      : undefined;

  return {
    ...otherTaskProperties,
    parent,
    ...(parentReference ? { parent_task: parentReference } : {}),
    top_level_parent,
  };
}

async function readManifest(manifestPath: string): Promise<SyncManifest | undefined> {
  try {
    const value = JSON.parse(await readFile(manifestPath, 'utf8')) as Partial<SyncManifest>;
    return value.version === 1 && value.mappings && typeof value.mappings === 'object'
      ? value as SyncManifest
      : undefined;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }
}

async function commitStagedFiles(stagingFolder: string, targetFolder: string, fileNames: readonly string[]): Promise<void> {
  const backupFolder = path.join(stagingFolder, '.backup');
  await mkdir(backupFolder);
  const committed: string[] = [];
  const backedUp: string[] = [];

  try {
    for (const fileName of fileNames) {
      const source = path.join(stagingFolder, fileName);
      const destination = path.join(targetFolder, fileName);
      const backup = path.join(backupFolder, fileName);
      try {
        await rename(destination, backup);
        backedUp.push(fileName);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      try {
        await rename(source, destination);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
          throw error;
        }
        await copyFile(source, destination);
        await rm(source);
      }
      committed.push(fileName);
    }
  } catch (error) {
    for (const fileName of committed.reverse()) {
      await rm(path.join(targetFolder, fileName), { force: true });
    }
    for (const fileName of backedUp) {
      await rename(path.join(backupFolder, fileName), path.join(targetFolder, fileName));
    }
    throw error;
  }
}
