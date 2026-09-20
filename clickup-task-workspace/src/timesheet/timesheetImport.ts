import type { ClockifyEntity, ClockifyTimeEntry } from '../clockify/types.js';
import type { ClockifyEntryPlan, InvalidTimesheetLine, ParsedTimesheet } from './timesheetParser.js';

export interface ResolvedClockifyEntry extends ClockifyEntryPlan {
  projectId: string;
  tagIds: string[];
}

export interface TimesheetImportPlan {
  existingEntries: ResolvedClockifyEntry[];
  invalidLines: InvalidTimesheetLine[];
  newEntries: ResolvedClockifyEntry[];
  removableLineIndexes: number[];
}

export function planTimesheetImport(
  parsedTimesheet: ParsedTimesheet,
  projects: ClockifyEntity[],
  tags: ClockifyEntity[],
  existingTimeEntries: ClockifyTimeEntry[],
): TimesheetImportPlan {
  const invalidLines = new Map<number, InvalidTimesheetLine>();
  for (const invalidLine of parsedTimesheet.invalidLines) {
    invalidLines.set(invalidLine.lineIndex, invalidLine);
  }

  const projectIndex = indexEntities(projects);
  const tagIndex = indexEntities(tags);
  const resolvedEntries: ResolvedClockifyEntry[] = [];

  for (const entry of parsedTimesheet.entries) {
    const project = getSingleEntity(projectIndex, entry.projectName);
    if (!project) {
      invalidLines.set(entry.lineIndex, invalidEntry(entry, `Projekt „${entry.projectName}“ v Clockify neexistuje nebo není jednoznačný.`));
      continue;
    }

    const tagIds: string[] = [];
    let invalidTag: string | undefined;
    for (const tagName of entry.tagNames) {
      const tag = getSingleEntity(tagIndex, tagName);
      if (!tag) {
        invalidTag = tagName;
        break;
      }
      tagIds.push(tag.id);
    }
    if (invalidTag) {
      invalidLines.set(entry.lineIndex, invalidEntry(entry, `Štítek „${invalidTag}“ v Clockify neexistuje nebo není jednoznačný.`));
      continue;
    }

    resolvedEntries.push({ ...entry, projectId: project.id, tagIds });
  }

  const invalidLineIndexes = new Set(invalidLines.keys());
  const validEntries = resolvedEntries.filter((entry) => !invalidLineIndexes.has(entry.lineIndex));
  const existingEntries = validEntries.filter((entry) => isExistingTimeEntry(entry, existingTimeEntries));
  const newEntries = validEntries.filter((entry) => !isExistingTimeEntry(entry, existingTimeEntries));

  return {
    existingEntries,
    invalidLines: [...invalidLines.values()].sort((left, right) => left.lineIndex - right.lineIndex),
    newEntries,
    removableLineIndexes: parsedTimesheet.removableLineIndexes,
  };
}

export function removeTimesheetLines(content: string, lineIndexes: number[]): string {
  const indexes = new Set(lineIndexes);
  const lines = content.split(/\r?\n/);
  const result = lines.filter((_line, index) => !indexes.has(index));
  return result.join('\n');
}

function indexEntities(entities: ClockifyEntity[]): Map<string, ClockifyEntity[]> {
  const index = new Map<string, ClockifyEntity[]>();
  for (const entity of entities) {
    const key = normalizeName(entity.name);
    const values = index.get(key) ?? [];
    values.push(entity);
    index.set(key, values);
  }
  return index;
}

function getSingleEntity(index: Map<string, ClockifyEntity[]>, name: string): ClockifyEntity | undefined {
  const matches = index.get(normalizeName(name));
  return matches?.length === 1 ? matches[0] : undefined;
}

function isExistingTimeEntry(entry: ResolvedClockifyEntry, existingTimeEntries: ClockifyTimeEntry[]): boolean {
  const expectedTags = [...entry.tagIds].sort();
  return existingTimeEntries.some((existingEntry) =>
    existingEntry.projectId === entry.projectId
    && normalizeDescription(existingEntry.description) === normalizeDescription(entry.description)
    && existingEntry.timeInterval?.start === entry.start
    && existingEntry.timeInterval?.end === entry.end
    && sameTags(existingEntry.tagIds ?? [], expectedTags),
  );
}

function sameTags(actualTags: string[], expectedTags: string[]): boolean {
  const actualSorted = [...actualTags].sort();
  return actualSorted.length === expectedTags.length && actualSorted.every((tag, index) => tag === expectedTags[index]);
}

function normalizeName(value: string): string {
  return value.normalize('NFC').trim();
}

function normalizeDescription(value: string | undefined): string {
  return (value ?? '').normalize('NFC').trim();
}

function invalidEntry(entry: ClockifyEntryPlan, message: string): InvalidTimesheetLine {
  return { lineIndex: entry.lineIndex, message, sourceLine: entry.sourceLine };
}