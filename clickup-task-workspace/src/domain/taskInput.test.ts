import { describe, expect, it } from 'vitest';
import { parseTaskInput, sanitizeFolderName } from './taskInput.js';

describe('parseTaskInput', () => {
  it('načte custom ID', () => {
    expect(parseTaskInput('tts-7383')).toEqual({ kind: 'custom', taskId: 'TTS-7383' });
  });

  it('načte interní ID', () => {
    expect(parseTaskInput('86abc123')).toEqual({ kind: 'internal', taskId: '86abc123' });
  });

  it('načte Workspace ID a task z URL', () => {
    expect(parseTaskInput('https://app.clickup.com/t/2422460/TTS-7383?view=detail')).toEqual({
      kind: 'custom',
      taskId: 'TTS-7383',
      workspaceId: '2422460',
    });
  });

  it('odmítne cizí URL', () => {
    expect(() => parseTaskInput('https://example.com/t/1/TTS-1')).toThrow('podporována pouze URL');
  });
});

describe('sanitizeFolderName', () => {
  it('ošetří neplatné a rezervované názvy', () => {
    expect(sanitizeFolderName('TTS:7383.')).toBe('TTS_7383');
    expect(sanitizeFolderName('CON')).toBe('_CON');
  });
});
