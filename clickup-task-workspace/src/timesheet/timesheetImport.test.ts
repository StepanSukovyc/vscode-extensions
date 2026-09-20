import { describe, expect, it } from 'vitest';
import { planTimesheetImport, removeTimesheetLines } from './timesheetImport.js';
import type { ParsedTimesheet } from './timesheetParser.js';

const parsedTimesheet: ParsedTimesheet = {
  entries: [{
    description: 'Dokumentace',
    end: '2026-03-11T08:30:00.000Z',
    lineIndex: 0,
    projectName: 'Projekt A',
    sourceLine: 'Projekt A: 815 - 830 management: Dokumentace',
    start: '2026-03-11T08:15:00.000Z',
    tagNames: ['management'],
  }],
  invalidLines: [],
  removableLineIndexes: [1],
};

describe('planTimesheetImport', () => {
  it('přeskočí existující shodný zápis bez ohledu na pořadí štítků', () => {
    const result = planTimesheetImport(
      { ...parsedTimesheet, entries: [{ ...parsedTimesheet.entries[0]!, tagNames: ['management', 'review'] }] },
      [{ id: 'project-1', name: 'Projekt A' }],
      [{ id: 'tag-1', name: 'management' }, { id: 'tag-2', name: 'review' }],
      [{
        description: 'Dokumentace',
        id: 'entry-1',
        projectId: 'project-1',
        tagIds: ['tag-2', 'tag-1'],
        timeInterval: { end: '2026-03-11T08:30:00.000Z', start: '2026-03-11T08:15:00.000Z' },
      }],
    );

    expect(result.existingEntries).toHaveLength(1);
    expect(result.newEntries).toHaveLength(0);
    expect(result.invalidLines).toHaveLength(0);
  });

  it('označí celý zdrojový řádek při chybějícím štítku', () => {
    const result = planTimesheetImport(
      parsedTimesheet,
      [{ id: 'project-1', name: 'Projekt A' }],
      [],
      [],
    );

    expect(result.newEntries).toHaveLength(0);
    expect(result.invalidLines).toHaveLength(1);
    expect(result.invalidLines[0]?.lineIndex).toBe(0);
    expect(result.invalidLines[0]?.message).toContain('management');
  });
});

describe('removeTimesheetLines', () => {
  it('odstraní jen označené řádky a ponechá ostatní Markdown', () => {
    expect(removeTimesheetLines('první\ndruhý\ntřetí', [1])).toBe('první\ntřetí');
  });
});