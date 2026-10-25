import { isAllowedServiceUrl } from '../platform/tizen';

export interface JellyfinUser {
  Id: string;
  Name: string;
}

export interface JellyfinResumeItem {
  Id: string;
  Name: string;
  Type?: string;
  SeriesName?: string;
  ProductionYear?: number;
  RunTimeTicks?: number;
  UserData?: {
    PlaybackPositionTicks?: number;
    PlayedPercentage?: number;
  };
  ImageTags?: {
    Primary?: string;
  };
}

interface JellyfinServerInfo {
  Id?: string;
}

interface JellyfinItemsResponse {
  Items?: JellyfinResumeItem[];
}

function normalizeServerUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error('Enter a valid Jellyfin server URL, for example http://192.168.1.10:8096.');
  }

  if (url.username || url.password) {
    throw new Error('Do not put a username or password in the Jellyfin URL.');
  }
  if (!isAllowedServiceUrl(url.toString())) {
    throw new Error('Use HTTPS for public servers. HTTP is allowed only for localhost, private LAN, or Tailscale addresses.');
  }

  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/+$/, '');
}

function endpoint(baseUrl: string, path: string): string {
  return baseUrl + (path.startsWith('/') ? path : '/' + path);
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Accept: 'application/json',
    'X-Emby-Token': apiKey.trim(),
  };
}

async function getJson<T>(url: string, apiKey: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: authHeaders(apiKey),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('Could not reach Jellyfin. Check the TV network and server URL; browser CORS restrictions may also block the request.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Jellyfin rejected this API key or does not allow this request. Create a key in Dashboard → Advanced → API Keys.');
  }
  if (!response.ok) {
    throw new Error('Jellyfin returned HTTP ' + response.status + '. Check the server URL, API key, and account permissions.');
  }

  try {
    return await response.json() as T;
  } catch {
    throw new Error('Jellyfin returned an unexpected response. Check that the URL points to the Jellyfin server, not a reverse-proxy landing page.');
  }
}

function validateCredentials(serverUrl: string, apiKey: string): { baseUrl: string; key: string } {
  const baseUrl = normalizeServerUrl(serverUrl);
  const key = apiKey.trim();
  if (!key) throw new Error('Enter a Jellyfin API key first.');
  return { baseUrl, key };
}

export async function fetchJellyfinUsers(
  serverUrl: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ users: JellyfinUser[]; serverId: string }> {
  const { baseUrl, key } = validateCredentials(serverUrl, apiKey);
  const [users, server] = await Promise.all([
    getJson<JellyfinUser[]>(endpoint(baseUrl, '/Users'), key, signal),
    getJson<JellyfinServerInfo>(endpoint(baseUrl, '/System/Info/Public'), key, signal),
  ]);

  if (!Array.isArray(users)) {
    throw new Error('Jellyfin returned an invalid user list.');
  }

  const validUsers = users.filter(
    (user): user is JellyfinUser =>
      Boolean(user) && typeof user.Id === 'string' && typeof user.Name === 'string',
  );

  if (!validUsers.length) {
    throw new Error('No Jellyfin users were returned. Check the API key and server permissions.');
  }

  return {
    users: validUsers,
    serverId: typeof server.Id === 'string' ? server.Id : '',
  };
}

export async function fetchJellyfinResume(
  serverUrl: string,
  apiKey: string,
  userId: string,
  signal?: AbortSignal,
): Promise<{ items: JellyfinResumeItem[]; serverId: string }> {
  const { baseUrl, key } = validateCredentials(serverUrl, apiKey);
  if (!userId.trim()) throw new Error('Choose a Jellyfin user before loading Continue Watching.');

  const query = new URLSearchParams({
    Limit: '8',
    MediaTypes: 'Video',
    Fields: 'Overview,UserData,ProductionYear,RunTimeTicks',
    EnableImageTypes: 'Primary',
    ImageTypeLimit: '1',
  });
  const [result, server] = await Promise.all([
    getJson<JellyfinItemsResponse>(
      endpoint(baseUrl, '/Users/' + encodeURIComponent(userId) + '/Items/Resume?' + query.toString()),
      key,
      signal,
    ),
    getJson<JellyfinServerInfo>(endpoint(baseUrl, '/System/Info/Public'), key, signal),
  ]);

  const items = Array.isArray(result.Items)
    ? result.Items.filter((item) => typeof item.Id === 'string' && typeof item.Name === 'string')
    : [];
  return { items, serverId: typeof server.Id === 'string' ? server.Id : '' };
}

/** Jellyfin Web details deep link. The user can then choose Resume/Play with the TV remote. */
export function getJellyfinItemUrl(serverUrl: string, itemId: string, serverId = ''): string {
  const baseUrl = normalizeServerUrl(serverUrl);
  const url = new URL(endpoint(baseUrl, '/web/'));
  const params = new URLSearchParams({ id: itemId });
  if (serverId) params.set('serverId', serverId);
  url.hash = '/details?' + params.toString();
  return url.toString();
}

/** Jellyfin's image endpoint supports api_key in the query string for image elements. */
export function getJellyfinPosterUrl(
  serverUrl: string,
  apiKey: string,
  item: JellyfinResumeItem,
  maxWidth = 420,
): string | null {
  if (!item.ImageTags?.Primary || !item.Id || !apiKey.trim()) return null;
  const baseUrl = normalizeServerUrl(serverUrl);
  const url = new URL(endpoint(baseUrl, '/Items/' + encodeURIComponent(item.Id) + '/Images/Primary'));
  url.search = new URLSearchParams({
    maxWidth: String(maxWidth),
    quality: '78',
    tag: item.ImageTags.Primary,
    api_key: apiKey.trim(),
  }).toString();
  return url.toString();
}

export function getJellyfinProgressPercent(item: JellyfinResumeItem): number {
  const saved = item.UserData?.PlayedPercentage;
  if (typeof saved === 'number' && Number.isFinite(saved)) return Math.max(0, Math.min(100, Math.round(saved)));
  const position = item.UserData?.PlaybackPositionTicks;
  const duration = item.RunTimeTicks;
  if (typeof position !== 'number' || typeof duration !== 'number' || duration <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(position / duration * 100)));
}
