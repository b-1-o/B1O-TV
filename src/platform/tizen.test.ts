import { afterEach, describe, expect, it, vi } from 'vitest';
import { exitCurrentTVApp, isAllowedServiceUrl, launchTVService } from './tizen';

afterEach(() => vi.unstubAllGlobals());

describe('exitCurrentTVApp', () => {
  it('requests exit only for the current app', () => {
    const exit = vi.fn();
    vi.stubGlobal('window', { tizen: { application: { getCurrentApplication: () => ({ exit }) } } });
    expect(exitCurrentTVApp()).toBe(true);
    expect(exit).toHaveBeenCalledOnce();
  });

  it('returns false when the TV runtime does not expose exit', () => {
    vi.stubGlobal('window', { tizen: { application: {} } });
    expect(exitCurrentTVApp()).toBe(false);
  });
});

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

describe('launchTVService', () => {
  const stubTizenRuntime = (launch: ReturnType<typeof vi.fn>) => {
    vi.stubGlobal('window', {
      tizen: {
        application: {
          getAppsInfo: vi.fn(),
          launch,
        },
      },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
  };

  it('launches the current standalone TizenTube using the ID discovered from installed apps', async () => {
    const launch = vi.fn((_appId: string, onSuccess?: () => void) => onSuccess?.());
    stubTizenRuntime(launch);

    const result = await launchTVService(
      'youtube',
      [{ id: 'xvvl3S1TT1.TizenTubeStandalone', name: 'TizenTube' }],
      { jellyfinUrl: '', selfMusicUrl: '' },
    );

    expect(launch).toHaveBeenCalledWith('xvvl3S1TT1.TizenTubeStandalone', expect.any(Function), expect.any(Function));
    expect(result.ok).toBe(true);
    expect(result.message).toContain('TizenTube launched');
  });

  it('falls back to the current standalone ID when the installed-app catalogue omits TizenTube', async () => {
    const launch = vi.fn((_appId: string, onSuccess?: () => void) => onSuccess?.());
    stubTizenRuntime(launch);

    const result = await launchTVService('youtube', [], { jellyfinUrl: '', selfMusicUrl: '' });

    expect(launch).toHaveBeenCalledWith('xvvl3S1TT1.TizenTubeStandalone', expect.any(Function), expect.any(Function));
    expect(result.ok).toBe(true);
    expect(result.message).toContain('TizenTube launched');
  });
});
