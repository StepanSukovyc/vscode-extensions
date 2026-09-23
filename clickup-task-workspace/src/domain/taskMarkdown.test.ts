import { describe, expect, it } from 'vitest';
import { buildTaskMarkdown, collectExternalImageUrls, rewriteImageUrls } from './taskMarkdown.js';

describe('Markdown obrázky', () => {
  it('najde inline i referenční obrázky a přepíše jen jejich URL', () => {
    const markdown = [
      '![Inline](https://example.com/a.png)',
      '',
      '![Reference][obr]',
      '',
      '[obr]: https://example.com/b.jpg',
      '[odkaz]: https://example.com/stranka',
    ].join('\n');

    expect(collectExternalImageUrls(markdown)).toEqual(new Set([
      'https://example.com/a.png',
      'https://example.com/b.jpg',
    ]));

    const result = rewriteImageUrls(markdown, {
      'https://example.com/a.png': 'a.png',
      'https://example.com/b.jpg': 'b.jpg',
    });
    expect(result).toContain('![Inline](./a.png)');
    expect(result).toContain('[obr]: ./b.jpg');
    expect(result).toContain('[odkaz]: https://example.com/stranka');
  });
});

describe('buildTaskMarkdown', () => {
  it('zahrne čitelný obsah i kompletní JSON', () => {
    const markdown = buildTaskMarkdown(
      { id: 'abc', custom_id: 'TTS-1', name: 'Test', status: { status: 'todo' }, extra: 42 },
      [{ id: 'c1', comment_text: 'Komentář' }],
      'Popis',
      ['image.png'],
    );

    expect(markdown).toContain('## Komentáře');
    expect(markdown).toContain('Komentář');
    expect(markdown).toContain('"extra": 42');
    expect(markdown).toContain('[image.png](./image.png)');
  });

  it('zvýrazní parent, subtasks a závislosti pomocí dostupných identifikátorů', () => {
    const markdown = buildTaskMarkdown(
      {
        dependencies: [{ depends_on: 'dependency-1', task_id: 'child-1' }],
        id: 'child-1',
        name: 'Podřízený task',
        parent: 'parent-1',
        subtasks: [{ custom_id: 'TTS-11647', id: 'subtask-1', name: 'Dílčí task' }],
      },
      [],
      'Popis',
      [],
      { custom_id: 'TTS-11645', id: 'parent-1', name: 'Nadřazený task' },
    );

    expect(markdown).toContain('## Vztahy a závislosti');
    expect(markdown).toContain('**Nadřazený úkol:** TTS-11645 - Nadřazený task');
    expect(markdown).toContain('TTS-11647 - Dílčí task');
    expect(markdown).toContain('**Závislosti (interní ID):** dependency-1');
  });

  it('zahrne vnořené odpovědi z diskuze', () => {
    const markdown = buildTaskMarkdown(
      { id: 'abc', name: 'Test' },
      [{
        id: 'c1',
        comment_text: 'Rodičovský komentář',
        replies: [{
          attachments: [{ id: 'attachment-1', title: 'screenshot.png', url: 'https://example.com/screenshot.png' }],
          id: 'c2',
          comment_text: 'Vnořená odpověď',
        }],
      }],
      'Popis',
      [],
      undefined,
      { 'https://example.com/screenshot.png': 'screenshot.png' },
    );

    expect(markdown).toContain('Rodičovský komentář');
    expect(markdown).toContain('#### Odpověď 1.1: Neznámý autor');
    expect(markdown).toContain('Vnořená odpověď');
    expect(markdown).toContain('![screenshot.png](./screenshot.png)');
  });

  it('odstraní redundantní úvodní nadpis Popis', () => {
    const markdown = buildTaskMarkdown(
      { id: 'abc', name: 'Test' },
      [],
      '### Popis\n\nObsah úkolu\n\n### Technický popis\n\nDetail',
      [],
    );

    expect(markdown.match(/^## Popis$/gm)).toHaveLength(1);
    expect(markdown).not.toContain('### Popis\n');
    expect(markdown).toContain('Obsah úkolu');
    expect(markdown).toContain('### Technický popis');
  });
});
