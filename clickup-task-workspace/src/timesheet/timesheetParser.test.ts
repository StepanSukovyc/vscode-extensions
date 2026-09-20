import { describe, expect, it } from 'vitest';
import { parseTimesheet } from './timesheetParser.js';

describe('parseTimesheet', () => {
  it('převede více intervalů na samostatné Clockify entry', () => {
    const result = parseTimesheet(
      '17/9/2026',
      'various activities: 815 - 830, 1830 - 1835 management: Různé (emaily, aktualizace nástrojů, plánování apod.)',
    );

    expect(result.invalidLines).toEqual([]);
    expect(result.removableLineIndexes).toEqual([]);
    expect(result.entries).toMatchObject([
      {
        description: 'Různé (emaily, aktualizace nástrojů, plánování apod.)',
        end: '2026-09-17T06:30:00.000Z',
        projectName: 'various activities',
        start: '2026-09-17T06:15:00.000Z',
        tagNames: ['management'],
      },
      {
        end: '2026-09-17T16:35:00.000Z',
        start: '2026-09-17T16:30:00.000Z',
      },
    ]);
  });

  it('posune konec dřívější než začátek do následujícího dne', () => {
    const result = parseTimesheet('17/9/2026', 'MOU: 2330 - 30 development: Noční práce');

    expect(result.entries[0]).toMatchObject({
      end: '2026-09-17T22:30:00.000Z',
      start: '2026-09-17T21:30:00.000Z',
    });
  });

  it('označí řádek bez časů k odstranění', () => {
    const result = parseTimesheet('17/9/2026', 'various activities: ... standup: Konzultace');

    expect(result.removableLineIndexes).toEqual([0]);
    expect(result.entries).toEqual([]);
  });

  it('označí osamocený čas jako nevalidní', () => {
    const result = parseTimesheet('17/9/2026', 'MOU: 815 development: Nedokončený zápis');

    expect(result.invalidLines).toMatchObject([{ lineIndex: 0 }]);
    expect(result.entries).toEqual([]);
  });

  it('odmítne název tasku, který není samotné datum', () => {
    expect(() => parseTimesheet('Výkaz 17/9/2026', '')).toThrow('výhradně datum');
  });
});