export interface ClockifyEntryPlan {
  description: string;
  end: string;
  lineIndex: number;
  projectName: string;
  sourceLine: string;
  start: string;
  tagNames: string[];
}

export interface InvalidTimesheetLine {
  lineIndex: number;
  message: string;
  sourceLine: string;
}

export interface ParsedTimesheet {
  entries: ClockifyEntryPlan[];
  invalidLines: InvalidTimesheetLine[];
  removableLineIndexes: number[];
}

interface LocalTime {
  hour: number;
  minute: number;
}

const TIME_PAIR = /^(\d{1,4})\s*-\s*(\d{1,4})/;
const TASK_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function parseTimesheet(taskName: string, content: string, timeZone = 'Europe/Prague'): ParsedTimesheet {
  const taskDate = parseTaskDate(taskName);
  const result: ParsedTimesheet = { entries: [], invalidLines: [], removableLineIndexes: [] };

  for (const [lineIndex, sourceLine] of content.split(/\r?\n/).entries()) {
    if (!sourceLine.trim()) {
      continue;
    }

    const lineResult = parseLine(taskDate, sourceLine, lineIndex, timeZone);
    if (lineResult.kind === 'removable') {
      result.removableLineIndexes.push(lineIndex);
    } else if (lineResult.kind === 'invalid') {
      result.invalidLines.push(lineResult.value);
    } else {
      result.entries.push(...lineResult.value);
    }
  }

  return result;
}

function parseLine(
  taskDate: DateParts,
  sourceLine: string,
  lineIndex: number,
  timeZone: string,
): LineResult {
  const firstColon = sourceLine.indexOf(':');
  if (firstColon <= 0) {
    return invalid(lineIndex, sourceLine, 'Řádek musí obsahovat název projektu ukončený dvojtečkou.');
  }

  const projectName = sourceLine.slice(0, firstColon).trim();
  const timeAndTags = sourceLine.slice(firstColon + 1).trim();
  if (!projectName) {
    return invalid(lineIndex, sourceLine, 'Název projektu nesmí být prázdný.');
  }

  if (!timeAndTags || !startsWithTime(timeAndTags)) {
    return { kind: 'removable' };
  }

  const pairs = parseTimePairs(timeAndTags);
  if (!pairs) {
    return invalid(lineIndex, sourceLine, 'Čas musí být úplná dvojice začátku a konce oddělená pomlčkou.');
  }

  const metadata = timeAndTags.slice(pairs.endIndex).trim();
  const secondColon = metadata.indexOf(':');
  if (secondColon < 0) {
    return invalid(lineIndex, sourceLine, 'Za štítky musí následovat dvojtečka a popis činnosti.');
  }

  const tagNames = metadata.slice(0, secondColon).split(',').map((tag) => tag.trim()).filter(Boolean);
  const description = metadata.slice(secondColon + 1).trim();
  if (tagNames.length === 0) {
    return invalid(lineIndex, sourceLine, 'Řádek musí obsahovat alespoň jeden Clockify štítek.');
  }
  if (!description) {
    return invalid(lineIndex, sourceLine, 'Popis činnosti nesmí být prázdný.');
  }

  try {
    return {
      kind: 'entries',
      value: pairs.value.map(({ end, start }) => ({
        description,
        end: toIsoInstant(taskDate, end, start, timeZone),
        lineIndex,
        projectName,
        sourceLine,
        start: toIsoInstant(taskDate, start, undefined, timeZone),
        tagNames,
      })),
    };
  } catch (error) {
    return invalid(lineIndex, sourceLine, error instanceof Error ? error.message : 'Čas nelze převést.');
  }
}

function parseTimePairs(value: string): { endIndex: number; value: Array<{ end: LocalTime; start: LocalTime }> } | undefined {
  let remaining = value;
  let consumed = 0;
  const pairs: Array<{ end: LocalTime; start: LocalTime }> = [];

  while (true) {
    const match = TIME_PAIR.exec(remaining);
    if (!match) {
      return pairs.length === 0 ? undefined : { endIndex: consumed, value: pairs };
    }

    const start = parseTime(match[1] ?? '');
    const end = parseTime(match[2] ?? '');
    if (!start || !end) {
      return undefined;
    }
    pairs.push({ end, start });
    consumed += match[0].length;
    remaining = remaining.slice(match[0].length);

    const separator = /^(?:\s*,\s*|\s+)/.exec(remaining);
    if (!separator) {
      return { endIndex: consumed, value: pairs };
    }

    const afterSeparator = remaining.slice(separator[0].length);
    if (!TIME_PAIR.test(afterSeparator)) {
      return { endIndex: consumed, value: pairs };
    }
    consumed += separator[0].length;
    remaining = afterSeparator;
  }
}

function parseTime(value: string): LocalTime | undefined {
  const normalized = value.padStart(4, '0');
  const hour = Number(normalized.slice(0, 2));
  const minute = Number(normalized.slice(2, 4));
  if (hour > 23 || minute > 59) {
    return undefined;
  }
  return { hour, minute };
}

function startsWithTime(value: string): boolean {
  return /^\d/.test(value);
}

interface DateParts {
  day: number;
  month: number;
  year: number;
}

function parseTaskDate(taskName: string): DateParts {
  const match = TASK_DATE.exec(taskName.trim());
  if (!match) {
    throw new Error('Název ClickUp úkolu musí být výhradně datum ve formátu D/M/YYYY.');
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    throw new Error('Název ClickUp úkolu obsahuje neplatné datum.');
  }
  return { day, month, year };
}

function toIsoInstant(taskDate: DateParts, time: LocalTime, start: LocalTime | undefined, timeZone: string): string {
  const date = start && isEarlier(time, start) ? addDays(taskDate, 1) : taskDate;
  const matches: Date[] = [];

  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const candidate = new Date(Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute) - offsetMinutes * 60_000);
    if (matchesLocalDateTime(candidate, date, time, timeZone)) {
      matches.push(candidate);
    }
  }

  if (matches.length !== 1) {
    throw new Error(matches.length === 0
      ? 'Zadaný čas v Europe/Prague neexistuje.'
      : 'Zadaný čas v Europe/Prague je při změně času nejednoznačný.');
  }
  return matches[0]?.toISOString() ?? '';
}

function matchesLocalDateTime(date: Date, expectedDate: DateParts, expectedTime: LocalTime, timeZone: string): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value);
  return value('year') === expectedDate.year
    && value('month') === expectedDate.month
    && value('day') === expectedDate.day
    && value('hour') === expectedTime.hour
    && value('minute') === expectedTime.minute;
}

function addDays(date: DateParts, days: number): DateParts {
  const candidate = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    day: candidate.getUTCDate(),
    month: candidate.getUTCMonth() + 1,
    year: candidate.getUTCFullYear(),
  };
}

function isEarlier(left: LocalTime, right: LocalTime): boolean {
  return left.hour < right.hour || left.hour === right.hour && left.minute < right.minute;
}

type LineResult =
  | { kind: 'entries'; value: ClockifyEntryPlan[] }
  | { kind: 'invalid'; value: InvalidTimesheetLine }
  | { kind: 'removable' };

function invalid(lineIndex: number, sourceLine: string, message: string): LineResult {
  return { kind: 'invalid', value: { lineIndex, message, sourceLine } };
}