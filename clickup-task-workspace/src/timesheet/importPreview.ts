import type { InvalidTimesheetLine } from './timesheetParser.js';

const MAX_DISPLAYED_ERRORS = 5;
const MAX_SOURCE_LINE_LENGTH = 140;

export interface ImportWorkspaceContext {
  id: string;
  name?: string;
  projectCount: number;
}

export function formatImportPreview(
  created: number,
  existing: number,
  removed: number,
  invalidLines: InvalidTimesheetLine[],
  workspace?: ImportWorkspaceContext,
): string {
  const summary = `Clockify: vytvořit ${created}, přeskočit existující ${existing}, odstranit řádky bez času ${removed}, chyby ${invalidLines.length}.`;
  const workspaceSummary = workspace
    ? `Clockify workspace: ${workspace.name ?? 'název se nepodařilo načíst'} (ID ${workspace.id}); načteno ${workspace.projectCount} aktivních projektů.`
    : undefined;
  if (invalidLines.length === 0) {
    return [summary, workspaceSummary].filter(Boolean).join('\n');
  }

  const displayedErrors = invalidLines.slice(0, MAX_DISPLAYED_ERRORS).map((line) =>
    `- Řádek ${line.lineIndex + 1}: ${line.message}\n  ${truncateSourceLine(line.sourceLine)}`,
  );
  const remainingErrors = invalidLines.length - displayedErrors.length;
  if (remainingErrors > 0) {
    displayedErrors.push(`- a další ${remainingErrors} chyb.`);
  }

  return [
    summary,
    workspaceSummary,
    `Nalezené chyby:\n${displayedErrors.join('\n')}`,
  ].filter(Boolean).join('\n\n');
}

function truncateSourceLine(sourceLine: string): string {
  const normalizedLine = sourceLine.trim().replace(/\s+/g, ' ');
  return normalizedLine.length > MAX_SOURCE_LINE_LENGTH
    ? `${normalizedLine.slice(0, MAX_SOURCE_LINE_LENGTH - 3)}...`
    : normalizedLine;
}