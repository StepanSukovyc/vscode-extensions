import dns from 'node:dns/promises';
import net from 'node:net';

export type HostResolver = (hostname: string) => Promise<readonly string[]>;

export async function assertSafePublicUrl(
  rawUrl: string,
  resolver: HostResolver = resolveHost,
): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Nepodporovaný protokol externího zdroje: ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error('Externí URL nesmí obsahovat přihlašovací údaje.');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Externí URL nesmí směřovat na lokální počítač.');
  }

  const addresses = net.isIP(hostname) > 0 ? [hostname] : await resolver(hostname);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error('Externí URL nesmí směřovat do privátní nebo lokální sítě.');
  }

  return url;
}

async function resolveHost(hostname: string): Promise<readonly string[]> {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [first = 0, second = 0] = address.split('.').map(Number);
    return first === 0
      || first === 10
      || first === 127
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || first >= 224;
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    if (normalized === '::' || normalized === '::1') {
      return true;
    }
    if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true;
    }
    const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    return mappedIpv4 ? isPrivateAddress(mappedIpv4) : false;
  }

  return true;
}
