import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchJellyfinResume,
  fetchJellyfinUsers,
  getJellyfinItemUrl,
  getJellyfinPosterUrl,
  getJellyfinProgressPercent,
} from './jellyfin';

afterEach(() => vi.unstubAllGlobals());

describe('Jellyfin URL helpers', () => {
  it('creates a Jellyfin Web details link', () => {
    expect(getJellyfinItemUrl('http://192.168.1.10:8096/', 'item-123', 'server-456'))
      .toBe('http://192.168.1.10:8096/web/#/details?id=item-123&serverId=server-456');
  });

  it('creates a poster URL with the item tag', () => {
    const url = getJellyfinPosterUrl('http://192.168.1.10:8096', 'test-key', {
      Id: 'item-123',
      Name: 'Test Movie',
      ImageTags: { Primary: 'poster-tag' },
    });
    expect(url).toContain('/Items/item-123/Images/Primary?');
    expect(url).toContain('tag=poster-tag');
    expect(url).toContain('api_key=test-key');
  });

  it('calculates progress from ticks when percentage is unavailable', () => {
    expect(getJellyfinProgressPercent({
      Id: 'item-123',
      Name: 'Test Movie',
      RunTimeTicks: 1000,
      UserData: { PlaybackPositionTicks: 425 },
    })).toBe(43);
  });

  it('clamps a server-provided percentage into a valid range', () => {
    expect(getJellyfinProgressPercent({
      Id: 'item-123',
      Name: 'Test Movie',
      UserData: { PlayedPercentage: 120 },
    })).toBe(100);
  });
});

describe('Jellyfin API requests', () => {
  it('loads the available users and server ID using the API key', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/Users')) {
        return new Response(JSON.stringify([{ Id: 'user-1', Name: 'Erik' }]), { status: 200 });
      }
      return new Response(JSON.stringify({ Id: 'server-1' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchJellyfinUsers('http://192.168.1.10:8096', 'test-key');
    expect(result.users).toEqual([{ Id: 'user-1', Name: 'Erik' }]);
    expect(result.serverId).toBe('server-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every((call) => (call[1]?.headers as Record<string, string>)['X-Emby-Token'] === 'test-key')).toBe(true);
  });

  it('loads the resume row for the selected user', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/Items/Resume?')) {
        return new Response(JSON.stringify({
          Items: [{ Id: 'movie-1', Name: 'Example Movie', UserData: { PlayedPercentage: 32 } }],
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ Id: 'server-1' }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchJellyfinResume('http://192.168.1.10:8096', 'test-key', 'user-1');
    expect(result.items[0].Id).toBe('movie-1');
    expect(result.serverId).toBe('server-1');
  });
});
