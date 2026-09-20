import { describe, expect, it } from 'vitest';
import { buildAttachmentPlan, sanitizeFileName } from './attachmentPlan.js';

describe('buildAttachmentPlan', () => {
  it('vytvoří stabilní unikátní názvy a neduplikuje vloženou ClickUp přílohu', () => {
    const attachment = {
      id: 'a1',
      title: 'image.png',
      url: 'https://attachments.clickup.com/a1/image.png',
      url_w_query: 'https://attachments.clickup.com/a1/image.png?view=open',
    };
    const plan = buildAttachmentPlan(
      [attachment],
      new Set([attachment.url, 'https://example.com/photo.jpg']),
      new Set(['image.png']),
    );

    expect(plan.downloads).toHaveLength(2);
    expect(plan.downloads[0]?.fileName).toBe('image_1.png');
    expect(plan.sourceToFile[attachment.url]).toBe('image_1.png');
    expect(plan.sourceToFile['https://example.com/photo.jpg']).toMatch(/^external-[a-f0-9]{12}\.jpg$/);
  });

  it('znovu použije název z manifestu', () => {
    const plan = buildAttachmentPlan(
      [{ id: 'a1', title: 'novy.png', url: 'https://example.com/a1' }],
      new Set(),
      new Set(['puvodni.png']),
      { 'clickup:a1': 'puvodni.png' },
    );

    expect(plan.downloads[0]?.fileName).toBe('puvodni.png');
  });
});

describe('sanitizeFileName', () => {
  it('ošetří Windows názvy', () => {
    expect(sanitizeFileName('CON.txt')).toBe('_CON.txt');
    expect(sanitizeFileName('obrazek:1?.png')).toBe('obrazek_1_.png');
  });
});
