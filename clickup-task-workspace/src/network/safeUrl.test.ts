import { describe, expect, it } from 'vitest';
import { assertSafePublicUrl, isPrivateAddress } from './safeUrl.js';

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.1.1', '::1', 'fc00::1'])(
    'blokuje %s',
    (address) => expect(isPrivateAddress(address)).toBe(true),
  );

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])(
    'povolí %s',
    (address) => expect(isPrivateAddress(address)).toBe(false),
  );
});

describe('assertSafePublicUrl', () => {
  it('povolí veřejný HTTPS cíl', async () => {
    await expect(assertSafePublicUrl('https://example.com/a.png', () => Promise.resolve(['93.184.216.34'])))
      .resolves.toBeInstanceOf(URL);
  });

  it('blokuje DNS směřující do privátní sítě', async () => {
    await expect(assertSafePublicUrl('https://example.com/a.png', () => Promise.resolve(['192.168.1.10'])))
      .rejects.toThrow('privátní');
  });
});
