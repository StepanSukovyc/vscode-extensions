import { describe, expect, it } from 'vitest';
import { formatImportPreview } from './importPreview.js';

describe('formatImportPreview', () => {
  it('vypíše u každé chyby řádek, důvod a zdrojový text', () => {
    const preview = formatImportPreview(10, 0, 7, [{
      lineIndex: 4,
      message: 'Štítek „management“ v Clockify neexistuje nebo není jednoznačný.',
      sourceLine: 'various activities: 815 - 830 management: Dokumentace',
    }]);

    expect(preview).toContain('chyby 1');
    expect(preview).toContain('Řádek 5');
    expect(preview).toContain('Štítek „management“');
    expect(preview).toContain('various activities: 815 - 830 management: Dokumentace');
  });

  it('omezí dlouhý seznam chyb, ale zachová jejich počet', () => {
    const invalidLines = Array.from({ length: 6 }, (_value, index) => ({
      lineIndex: index,
      message: 'Neplatný čas.',
      sourceLine: `Projekt: ${index} - 900 management: Popis`,
    }));

    const preview = formatImportPreview(0, 0, 0, invalidLines);

    expect(preview).toContain('chyby 6');
    expect(preview).toContain('Řádek 5');
    expect(preview).toContain('a další 1 chyb.');
    expect(preview).not.toContain('Řádek 6');
  });
});