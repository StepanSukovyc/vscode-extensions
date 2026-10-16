import type { ClockifyEntity, ClockifyTimeEntry } from '../clockify/types.js';
import type { ClockifyEntryPlan, InvalidTimesheetLine, ParsedTimesheet } from './timesheetParser.js';

const TIME_ENTRY_LOOKUP_BUFFER_MS = 60_000;

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
    const projectMatches = getEntityMatches(projectIndex, entry.projectName);
    const project = projectMatches[0];
    if (projectMatches.length !== 1 || !project) {
      invalidLines.set(entry.lineIndex, invalidEntry(
        entry,
        describeEntityMatches('Projekt', entry.projectName, projectMatches, projects.length, 'aktivních projektů'),
      ));
      continue;
    }

    const tagIds: string[] = [];
    let invalidTag: string | undefined;
    for (const tagName of entry.tagNames) {
      const tagMatches = getEntityMatches(tagIndex, tagName);
      if (tagMatches.length !== 1) {
        invalidTag = tagName;
        invalidLines.set(entry.lineIndex, invalidEntry(
          entry,
          describeEntityMatches('Štítek', tagName, tagMatches, tags.length, 'aktivních štítků'),
        ));
        break;
      }
      const tag = tagMatches[0];
      if (tag) {
        tagIds.push(tag.id);
      }
    }
    if (invalidTag !== undefined) {
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

export function getTimeEntryLookupRange(entries: Array<{ end: string; start: string }>): { end: string; start: string } | undefined {
  if (entries.length === 0) {
    return undefined;
  }

  const start = Math.min(...entries.map((entry) => Date.parse(entry.start)));
  const end = Math.max(...entries.map((entry) => Date.parse(entry.end)));
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return undefined;
  }

  return {
    end: new Date(end + TIME_ENTRY_LOOKUP_BUFFER_MS).toISOString(),
    start: new Date(start - TIME_ENTRY_LOOKUP_BUFFER_MS).toISOString(),
  };
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

function getEntityMatches(index: Map<string, ClockifyEntity[]>, name: string): ClockifyEntity[] {
  return index.get(normalizeName(name)) ?? [];
}

function describeEntityMatches(
  entityType: string,
  requestedName: string,
  matches: ClockifyEntity[],
  entityCount: number,
  collectionName: string,
): string {
  if (matches.length === 0) {
    return `${entityType} „${requestedName}“ nebyl nalezen (0 přesných shod; načteno ${entityCount} ${collectionName}).`;
  }

  const candidates = matches.map((entity) => `„${entity.name}“ (ID ${entity.id})`).join(', ');
  return `${entityType} „${requestedName}“ není jednoznačný (${matches.length} přesné shody: ${candidates}).`;
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