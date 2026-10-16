import { describe, expect, it } from 'vitest';
import { getTimeEntryLookupRange, planTimesheetImport, removeTimesheetLines } from './timesheetImport.js';
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

  it('rozliší chybějící projekt a uvede počet načtených projektů', () => {
    const result = planTimesheetImport(
      parsedTimesheet,
      [{ id: 'other-1', name: 'Jiný projekt' }, { id: 'other-2', name: 'Další projekt' }],
      [{ id: 'tag-1', name: 'management' }],
      [],
    );

    expect(result.invalidLines[0]?.message).toContain('0 přesných shod');
    expect(result.invalidLines[0]?.message).toContain('načteno 2 aktivních projektů');
  });

  it('u duplicitního názvu projektu uvede všechny kandidáty a jejich ID', () => {
    const result = planTimesheetImport(
      parsedTimesheet,
      [{ id: 'project-1', name: 'Projekt A' }, { id: 'project-2', name: 'Projekt A' }],
      [{ id: 'tag-1', name: 'management' }],
      [],
    );

    expect(result.invalidLines[0]?.message).toContain('2 přesné shody');
    expect(result.invalidLines[0]?.message).toContain('ID project-1');
    expect(result.invalidLines[0]?.message).toContain('ID project-2');
  });
});

describe('removeTimesheetLines', () => {
  it('odstraní jen označené řádky a ponechá ostatní Markdown', () => {
    expect(removeTimesheetLines('první\ndruhý\ntřetí', [1])).toBe('první\ntřetí');
  });
});

describe('getTimeEntryLookupRange', () => {
  it('rozšíří interval, aby zahrnul Clockify položky na obou hranicích', () => {
    expect(getTimeEntryLookupRange(parsedTimesheet.entries)).toEqual({
      end: '2026-03-11T08:31:00.000Z',
      start: '2026-03-11T08:14:00.000Z',
    });
  });
});