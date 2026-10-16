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

  it('interpretuje dvouciferný čas jako celou hodinu', () => {
    const result = parseTimesheet('17/9/2026', 'various activities: 12 - 1230 lunch: **Oběd**');

    expect(result.entries[0]).toMatchObject({
      end: '2026-09-17T10:30:00.000Z',
      start: '2026-09-17T10:00:00.000Z',
    });
  });

  it('interpretuje jednociferný čas jako celou hodinu', () => {
    const result = parseTimesheet('17/9/2026', 'various activities: 9 - 915 analysis: **Analýza požadavků**');

    expect(result.entries[0]).toMatchObject({
      end: '2026-09-17T07:15:00.000Z',
      start: '2026-09-17T07:00:00.000Z',
    });
  });

  it('přijme zápis hodin a minut oddělených dvojtečkou', () => {
    const result = parseTimesheet(
      '17/9/2026',
      'Sentinel: 13 - 14:20, 16 - 17 development: [app.clickup.com/t/2422460/TTS-11514](http://app.clickup.com/t/2422460/TTS-11514)',
    );

    expect(result.invalidLines).toEqual([]);
    expect(result.entries).toMatchObject([
      {
        end: '2026-09-17T12:20:00.000Z',
        start: '2026-09-17T11:00:00.000Z',
        tagNames: ['development'],
      },
      {
        end: '2026-09-17T15:00:00.000Z',
        start: '2026-09-17T14:00:00.000Z',
        tagNames: ['development'],
      },
    ]);
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

  it.each([
    'SENTINEL I12 - 14 analysis, development: app.clickup.com/t/2422460/TTS-11859',
    'SENTINEL I1630 - 1715 bug fix: app.clickup.com/t/2422460/TTS-11814',
  ])('zachová řádek bez dvojtečky za projektem: %s', (sourceLine) => {
    const result = parseTimesheet('9/10/2026', sourceLine);

    expect(result.removableLineIndexes).toEqual([]);
    expect(result.entries).toEqual([]);
    expect(result.invalidLines).toMatchObject([{
      lineIndex: 0,
      sourceLine,
    }]);
    expect(result.invalidLines[0]?.message).toContain('dvojtečku za názvem projektu');
  });

  it('přijme oba řádky SENTINEL I po doplnění oddělovače', () => {
    const result = parseTimesheet('9/10/2026', [
      'SENTINEL I: 12 - 14 analysis, development: app.clickup.com/t/2422460/TTS-11859',
      'SENTINEL I: 1630 - 1715 bug fix: app.clickup.com/t/2422460/TTS-11814',
    ].join('\n'));

    expect(result.invalidLines).toEqual([]);
    expect(result.removableLineIndexes).toEqual([]);
    expect(result.entries).toMatchObject([
      {
        projectName: 'SENTINEL I',
        start: '2026-10-09T10:00:00.000Z',
        end: '2026-10-09T12:00:00.000Z',
        tagNames: ['analysis', 'development'],
      },
      {
        projectName: 'SENTINEL I',
        start: '2026-10-09T14:30:00.000Z',
        end: '2026-10-09T15:15:00.000Z',
        tagNames: ['bug fix'],
      },
    ]);
  });

  it.each([
    'Projekt:',
    'Projekt: development: Bez času',
    'Projekt: neznámý formát',
    'Projekt: - 915 development: Chybí začátek',
    'Projekt: ... 815 development: Jeden čas',
    'Projekt: ... development 815: Jeden čas',
    'Projekt: ... 815 - 830 development: Interval za zástupným textem',
    'Projekt: ... development',
    'Projekt: ... , development: Prázdný štítek',
    'Projekt 815 - 830 development: ... development:',
    'Projekt: 815 - development: Chybí konec',
    'Projekt 815 development: Popis',
    'Projekt: od 8:15 do 9 development: Popis',
  ])('neodstraní nejasný nebo neúplný řádek: %s', (sourceLine) => {
    const result = parseTimesheet('9/10/2026', sourceLine);

    expect(result.removableLineIndexes).toEqual([]);
    expect(result.entries).toEqual([]);
    expect(result.invalidLines).toMatchObject([{ lineIndex: 0, sourceLine }]);
  });

  it.each([
    'Projekt 2026: ... development:',
    'Projekt 2026: … analysis, bug fix: Konzultace v 12:30',
    'Projekt 2026: ... development: app.clickup.com/t/2422460/TTS-11859',
  ])('odstraní jednoznačně prázdnou šablonu i s čísly mimo časovou sekci: %s', (sourceLine) => {
    const result = parseTimesheet('9/10/2026', sourceLine);

    expect(result.removableLineIndexes).toEqual([0]);
    expect(result.entries).toEqual([]);
    expect(result.invalidLines).toEqual([]);
  });

  it('nepovažuje čísla v projektu a popisu za další časy', () => {
    const result = parseTimesheet(
      '9/10/2026',
      'Projekt 2026: 815 - 830 development: Oprava 11859, schůzka v 12:30, https://app.clickup.com/t/2422460/TTS-11859',
    );

    expect(result.removableLineIndexes).toEqual([]);
    expect(result.invalidLines).toEqual([]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.projectName).toBe('Projekt 2026');
  });

  it('odmítne název tasku, který není samotné datum', () => {
    expect(() => parseTimesheet('Výkaz 17/9/2026', '')).toThrow('výhradně datum');
  });
});