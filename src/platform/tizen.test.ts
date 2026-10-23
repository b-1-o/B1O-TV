import { describe, expect, it } from 'vitest';
import { isAllowedServiceUrl } from './tizen';

describe('isAllowedServiceUrl', () => {
  it('accepts public HTTPS endpoints', () => {
    expect(isAllowedServiceUrl('https://music.example.com')).toBe(true);
  });

  it('accepts HTTP on private LAN and local development addresses', () => {
    expect(isAllowedServiceUrl('http://192.168.1.42:8787')).toBe(true);
    expect(isAllowedServiceUrl('http://10.0.0.5:8787')).toBe(true);
    expect(isAllowedServiceUrl('http://localhost:8787')).toBe(true);
    expect(isAllowedServiceUrl('http://selfmusic.local:8787')).toBe(true);
  });

  it('accepts Tailscale CGNAT IPv4 addresses', () => {
    expect(isAllowedServiceUrl('http://100.95.1.20:8787')).toBe(true);
  });

  it('rejects public HTTP and unsupported protocols', () => {
    expect(isAllowedServiceUrl('http://music.example.com')).toBe(false);
    expect(isAllowedServiceUrl('ftp://192.168.1.42/music')).toBe(false);
  });

  it('rejects credential-bearing URLs', () => {
    expect(isAllowedServiceUrl('https://user:secret@music.example.com')).toBe(false);
  });
});
