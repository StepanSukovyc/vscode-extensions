import * as vscode from 'vscode';
import { ClockifyApiError, ClockifyClient } from '../clockify/clockifyClient.js';
import { ClickUpApiError, ClickUpClient } from '../clickup/clickupClient.js';
import {
  getApiToken,
  getClockifyApiToken,
  getSettings,
  promptAndStoreApiToken,
  promptAndStoreClockifyApiToken,
} from '../configuration.js';
import { parseTaskInput } from '../domain/taskInput.js';
import { parseTimesheet } from '../timesheet/timesheetParser.js';
import { planTimesheetImport, removeTimesheetLines, type ResolvedClockifyEntry } from '../timesheet/timesheetImport.js';

const SUCCESS_STATUS = 'QA REVIEW';
const ERROR_STATUS = 'COOPERATION';

export async function importTimesheetCommand(context: vscode.ExtensionContext): Promise<void> {
  try {
    const settings = getSettings();
    const rawInput = await vscode.window.showInputBox({
      ignoreFocusOut: true,
      placeHolder: 'TTS-7383, interní ID nebo https://app.clickup.com/t/...',
      prompt: 'Zadejte identifikátor nebo URL ClickUp úkolu s výkazem',
      title: 'Importovat výkaz do Clockify',
    });
    if (rawInput === undefined) {
      return;
    }

    const input = parseTaskInput(rawInput);
    const clickUpToken = await getApiToken(context.secrets) ?? await promptAndStoreApiToken(context.secrets);
    if (!clickUpToken) {
      return;
    }
    const clockifyToken = await getClockifyApiToken(context.secrets) ?? await promptAndStoreClockifyApiToken(context.secrets);
    if (!clockifyToken) {
      return;
    }

    const imported = await vscode.window.withProgress(
      {
        cancellable: true,
        location: vscode.ProgressLocation.Notification,
        title: 'Importuji výkaz do Clockify',
      },
      async (progress, cancellationToken) => {
        const abortController = new AbortController();
        const cancellation = cancellationToken.onCancellationRequested(() => {
          abortController.abort(new Error('Operace byla zrušena.'));
        });

        try {
          const clickUpClient = new ClickUpClient(clickUpToken);
          const clockifyClient = new ClockifyClient(clockifyToken, globalThis.fetch, settings.clockifyApiBaseUrl);
          progress.report({ message: 'Načítám ClickUp úkol...' });
          const task = await clickUpClient.getTask(input, settings.workspaceId, abortController.signal);
          const content = task.markdown_description ?? task.description ?? task.text_content ?? '';
          const parsedTimesheet = parseTimesheet(task.name, content);

          progress.report({ message: 'Načítám Clockify workspace...' });
          const currentUser = await clockifyClient.getCurrentUser(abortController.signal);
          if (!currentUser.activeWorkspace) {
            throw new Error('Clockify účet nemá nastavený aktivní workspace.');
          }
          const workspaceId = currentUser.activeWorkspace;

          progress.report({ message: 'Načítám Clockify projekty a štítky...' });
          const [projects, tags] = await Promise.all([
            clockifyClient.getProjects(workspaceId, abortController.signal),
            clockifyClient.getTags(workspaceId, abortController.signal),
          ]);
          const existingEntries = await loadExistingEntries(clockifyClient, workspaceId, currentUser.id, parsedTimesheet.entries, abortController.signal);
          const importPlan = planTimesheetImport(parsedTimesheet, projects, tags, existingEntries);

          if (!await confirmImport(importPlan.newEntries.length, importPlan.existingEntries.length, importPlan.removableLineIndexes.length, importPlan.invalidLines.length)) {
            return undefined;
          }

          const errors = new Map(importPlan.invalidLines.map((line) => [line.lineIndex, line]));
          let createdEntries = 0;
          for (const entry of importPlan.newEntries) {
            try {
              progress.report({ message: `Vytvářím Clockify zápis z řádku ${entry.lineIndex + 1}...` });
              await clockifyClient.createTimeEntry(workspaceId, toCreateRequest(entry), abortController.signal);
              createdEntries += 1;
            } catch (error) {
              errors.set(entry.lineIndex, {
                lineIndex: entry.lineIndex,
                message: `Clockify zápis se nepodařilo vytvořit: ${toErrorMessage(error)}`,
                sourceLine: entry.sourceLine,
              });
            }
          }

          let clickUpWriteFailed = false;
          for (const error of errors.values()) {
            try {
              await clickUpClient.createComment(task.id, formatErrorComment(error.lineIndex, error.message, error.sourceLine), abortController.signal);
            } catch {
              clickUpWriteFailed = true;
            }
          }

          if (importPlan.removableLineIndexes.length > 0) {
            try {
              await clickUpClient.updateTask(task.id, {
                markdown_content: removeTimesheetLines(content, importPlan.removableLineIndexes),
              }, abortController.signal);
            } catch {
              clickUpWriteFailed = true;
            }
          }

          const hasErrors = errors.size > 0 || clickUpWriteFailed;
          await clickUpClient.updateTask(task.id, { status: hasErrors ? ERROR_STATUS : SUCCESS_STATUS }, abortController.signal);

          return {
            createdEntries,
            errors: errors.size,
            existingEntries: importPlan.existingEntries.length,
            removedLines: importPlan.removableLineIndexes.length,
          };
        } finally {
          cancellation.dispose();
        }
      },
    );

    if (!imported) {
      return;
    }
    const message = `Clockify: vytvořeno ${imported.createdEntries}, přeskočeno ${imported.existingEntries}, odstraněno řádků ${imported.removedLines}, chyb ${imported.errors}.`;
    if (imported.errors > 0) {
      void vscode.window.showWarningMessage(message);
    } else {
      void vscode.window.showInformationMessage(message);
    }
  } catch (error) {
    if (isCancellation(error)) {
      void vscode.window.showInformationMessage('Import výkazu do Clockify byl zrušen.');
      return;
    }
    void vscode.window.showErrorMessage(toUserMessage(error));
  }
}

async function loadExistingEntries(
  client: ClockifyClient,
  workspaceId: string,
  userId: string,
  entries: Array<{ end: string; start: string }>,
  signal: AbortSignal,
): Promise<Awaited<ReturnType<ClockifyClient['getTimeEntries']>>> {
  if (entries.length === 0) {
    return [];
  }
  const starts = entries.map((entry) => entry.start).sort();
  const ends = entries.map((entry) => entry.end).sort();
  const start = starts[0];
  const end = ends.at(-1);
  if (!start || !end) {
    return [];
  }
  return await client.getTimeEntries(workspaceId, userId, start, end, signal);
}

function toCreateRequest(entry: ResolvedClockifyEntry): {
  description: string;
  end: string;
  projectId: string;
  start: string;
  tagIds: string[];
} {
  return {
    description: entry.description,
    end: entry.end,
    projectId: entry.projectId,
    start: entry.start,
    tagIds: entry.tagIds,
  };
}

async function confirmImport(created: number, existing: number, removed: number, errors: number): Promise<boolean> {
  const choice = await vscode.window.showWarningMessage(
    `Clockify: vytvořit ${created}, přeskočit existující ${existing}, odstranit řádky bez času ${removed}, chyby ${errors}.`,
    { modal: true },
    'Importovat',
  );
  return choice === 'Importovat';
}

function formatErrorComment(lineIndex: number, message: string, sourceLine: string): string {
  return `Import výkazu do Clockify selhal na řádku ${lineIndex + 1}: ${message}\n\nZdrojový řádek:\n${sourceLine}`;
}

function isCancellation(error: unknown): boolean {
  return error instanceof Error && /zrušen/i.test(error.message);
}

function toUserMessage(error: unknown): string {
  if (error instanceof ClickUpApiError) {
    if (error.status === 401) {
      return 'ClickUp token není platný. Nastavte jej znovu příkazem „Nastavit ClickUp API token“.';
    }
    if (error.status === 403) {
      return 'ClickUp odmítl přístup k úkolu. Zkontrolujte oprávnění tokenu.';
    }
    if (error.status === 404) {
      return 'ClickUp úkol nebyl nalezen. Zkontrolujte ID a Workspace ID.';
    }
  }
  if (error instanceof ClockifyApiError && error.status === 401) {
    return 'Clockify token není platný. Nastavte jej znovu příkazem „Nastavit Clockify API token“.';
  }
  return error instanceof Error ? error.message : 'Import výkazu do Clockify selhal.';
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ClockifyApiError) {
    return error.responseBody || `HTTP ${error.status}`;
  }
  return error instanceof Error ? error.message : 'Neznámá chyba.';
}