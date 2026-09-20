import type { InvalidTimesheetLine } from './timesheetParser.js';

const MAX_DISPLAYED_ERRORS = 5;
const MAX_SOURCE_LINE_LENGTH = 140;

export function formatImportPreview(
  created: number,
  existing: number,
  removed: number,
  invalidLines: InvalidTimesheetLine[],
): string {
  const summary = `Clockify: vytvořit ${created}, přeskočit existující ${existing}, odstranit řádky bez času ${removed}, chyby ${invalidLines.length}.`;
  if (invalidLines.length === 0) {
    return summary;
  }

  const displayedErrors = invalidLines.slice(0, MAX_DISPLAYED_ERRORS).map((line) =>
    `- Řádek ${line.lineIndex + 1}: ${line.message}\n  ${truncateSourceLine(line.sourceLine)}`,
  );
  const remainingErrors = invalidLines.length - displayedErrors.length;
  if (remainingErrors > 0) {
    displayedErrors.push(`- a další ${remainingErrors} chyb.`);
  }

  return `${summary}\n\nNalezené chyby:\n${displayedErrors.join('\n')}`;
}

function truncateSourceLine(sourceLine: string): string {
  const normalizedLine = sourceLine.trim().replace(/\s+/g, ' ');
  return normalizedLine.length > MAX_SOURCE_LINE_LENGTH
    ? `${normalizedLine.slice(0, MAX_SOURCE_LINE_LENGTH - 3)}...`
    : normalizedLine;
}