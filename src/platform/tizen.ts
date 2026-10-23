import type { AppTarget, InstalledTVApp } from '../types';

interface TizenApplicationInfo {
  id: string;
  name: string;
  iconPath?: string;
  version?: string;
  show?: boolean;
}

interface TizenInputDeviceKey {
  name: string;
  code: number;
}

interface TizenInputDeviceManager {
  getSupportedKeys(): TizenInputDeviceKey[];
  registerKey(keyName: string): void;
  unregisterKey?(keyName: string): void;
}

interface TizenApplicationManager {
  getAppsInfo(
    success: (apps: TizenApplicationInfo[]) => void,
    error?: (reason: { name?: string; message?: string }) => void,
  ): void;
  launch(
    appId: string,
    success?: () => void,
    error?: (reason: { name?: string; message?: string }) => void,
  ): void;
}

type SamsungVoiceState = 'None' | 'Home' | 'List' | 'Player' | 'Setting' | 'Search' | 'Unknown';
interface SamsungVoiceContext { positionX: number; positionY: number; title: string; aliasArr: string[]; bFocused: boolean; }
interface SamsungVoiceManager {
  setCallback(callback: {
    onupdatestate?: () => SamsungVoiceState;
    onnavigation?: (navigation: string) => boolean;
    onselection?: (selection: number) => boolean;
    onchangeappstate?: (state: SamsungVoiceState) => boolean;
    ontitleselection?: (title: string) => boolean;
    onrequestcontentcontext?: () => string;
  }): void;
  listen(): void;
  buildVoiceInteractionContentContextItem?(x: number, y: number, title: string, aliases: string[], focused: boolean): SamsungVoiceContext;
  buildVoiceInteractionContentContextResponse?(contexts: SamsungVoiceContext[]): string;
}
declare global {
  interface Window {
    tizen?: {
      application?: TizenApplicationManager;
      tvinputdevice?: TizenInputDeviceManager;
    };
    webapis?: { voiceinteraction?: SamsungVoiceManager };
  }
}


let samsungVoiceReady = false;

/** Samsung Voice Interaction supports app navigation and selection; it is not a dictation API. */
export function registerSamsungVoiceInteraction(handlers: {
  getState: () => SamsungVoiceState;
  onNavigate: (navigation: string) => boolean;
  onSelect: (selection: number) => boolean;
  onAppState: (state: SamsungVoiceState) => boolean;
}): () => void {
  const manager = window.webapis?.voiceinteraction;
  samsungVoiceReady = false;
  if (!manager?.setCallback || !manager.listen) return () => undefined;
  try {
    manager.setCallback({
      onupdatestate: handlers.getState,
      onnavigation: handlers.onNavigate,
      onselection: handlers.onSelect,
      onchangeappstate: handlers.onAppState,
      onrequestcontentcontext: () => {
        try {
          const items = Array.from(document.querySelectorAll<HTMLElement>('[data-tv-focus="true"]'))
            .filter((el) => {
              if ('disabled' in el && Boolean((el as HTMLButtonElement).disabled)) return false;
              const style = getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
            })
            .map((el) => {
              const rect = el.getBoundingClientRect();
              const title = (el.getAttribute('aria-label') || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
              return manager.buildVoiceInteractionContentContextItem
                ? manager.buildVoiceInteractionContentContextItem(Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2), title, [], el.dataset.tvFocused === 'true')
                : { positionX: Math.round(rect.left + rect.width / 2), positionY: Math.round(rect.top + rect.height / 2), title, aliasArr: [], bFocused: el.dataset.tvFocused === 'true' };
            }).filter((item) => item.title);
          return manager.buildVoiceInteractionContentContextResponse
            ? manager.buildVoiceInteractionContentContextResponse(items)
            : JSON.stringify(items);
        } catch { return '[]'; }
      },
      ontitleselection: (requested) => {
        const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
        const wanted = normalize(requested);
        if (!wanted) return false;
        const visible = Array.from(document.querySelectorAll<HTMLElement>('[data-tv-focus="true"]'))
          .filter((el) => !('disabled' in el && Boolean((el as HTMLButtonElement).disabled)) && el.getClientRects().length > 0);
        const label = (el: HTMLElement) => normalize(el.getAttribute('aria-label') || el.innerText || el.textContent || '');
        const exact = visible.find((el) => label(el) === wanted);
        const candidates = visible.filter((el) => label(el) && (label(el).includes(wanted) || wanted.includes(label(el))));
        const target = exact || (candidates.length === 1 ? candidates[0] : undefined);
        if (!target) return false;
        target.click();
        return true;
      },
    });
    samsungVoiceReady = true;
  } catch {
    samsungVoiceReady = false;
    return () => undefined;
  }
  return () => { samsungVoiceReady = false; };
}

export function listenSamsungVoiceInteraction(): { ok: boolean } {
  const manager = window.webapis?.voiceinteraction;
  if (!samsungVoiceReady || !manager?.listen) return { ok: false };
  try { manager.listen(); return { ok: true }; } catch { return { ok: false }; }
}

const SPATIAL_REMOTE_KEY_CODES = new Set([13, 37, 38, 39, 40]);
const SPATIAL_REMOTE_KEY_NAMES = /^(arrow(left|right|up|down)|left|right|up|down|enter|return)$/i;

/** Register keys exposed by Samsung TV and release them when the app unmounts. */
export function registerSpatialRemoteKeys(): () => void {
  const input = window.tizen?.tvinputdevice;
  if (!input?.getSupportedKeys || !input.registerKey) return () => undefined;

  const registered: string[] = [];
  try {
    const supported = input.getSupportedKeys();
    const names = supported
      .filter((key) => SPATIAL_REMOTE_KEY_CODES.has(key.code) || SPATIAL_REMOTE_KEY_NAMES.test(key.name))
      .map((key) => key.name);

    for (const name of new Set(names)) {
      try {
        input.registerKey(name);
        registered.push(name);
      } catch {
        // Firmware may reserve one key; keep the other registered keys available.
      }
    }
  } catch {
    return () => undefined;
  }

  return () => {
    for (const name of registered) {
      try { input.unregisterKey?.(name); } catch { /* Key may have been released already. */ }
    }
  };
}

export function registerVoiceRemoteKey(onVoice: () => void): () => void {
  const input = window.tizen?.tvinputdevice;
  if (!input?.getSupportedKeys || !input.registerKey) return () => undefined;

  try {
    const voiceKey = input.getSupportedKeys().find((key) => /voice|microphone|mic/i.test(key.name));
    if (!voiceKey) return () => undefined;
    input.registerKey(voiceKey.name);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLocaleLowerCase() !== voiceKey.name.toLocaleLowerCase() && event.keyCode !== voiceKey.code) return;
      event.preventDefault();
      onVoice();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      try { input.unregisterKey?.(voiceKey.name); } catch { /* Key may be reserved by the TV firmware. */ }
    };
  } catch {
    // Some firmware reserves the microphone key or does not expose the input-device API.
    return () => undefined;
  }
}

export function isTizenRuntime(): boolean {
  return typeof window !== 'undefined' && typeof window.tizen?.application?.getAppsInfo === 'function';
}

export function getInstalledApps(): Promise<InstalledTVApp[]> {
  const manager = window.tizen?.application;
  if (!manager?.getAppsInfo) return Promise.resolve([]);

  return new Promise((resolve) => {
    manager.getAppsInfo(
      (apps) => {
        const preferred = ['youtube', 'netflix', 'selfmusic', 'jellyfin', 'spotify', 'plex', 'prime video', 'disney', 'apple tv', 'hulu', 'twitch', 'browser', 'internet'];
        const matchesPinnedService = (app: TizenApplicationInfo) => {
          const text = (app.name + ' ' + app.id).toLocaleLowerCase('en-US');
          return /youtube|tizen.?tube|netflix|self.?music|jellyfin|spotify|plex|prime.?video|disney|apple.?tv|hulu|twitch|browser|internet/.test(text);
        };
        const normalized = apps
          .filter((app) => (
            typeof app.id === 'string'
            && typeof app.name === 'string'
            && app.id !== 'B1Otv00001.B1web'
            && app.name.toLocaleLowerCase('en-US') !== 'b1o tv'
            // Mirror the custom-tv launcher: prefer apps marked visible by Tizen,
            // while retaining the named media apps even when the metadata is incomplete.
            && (app.show === true || matchesPinnedService(app))
          ))
          .map((app) => ({
            id: app.id,
            name: app.name,
            iconPath: app.iconPath,
            version: app.version,
            show: app.show,
          }))
          .sort((a, b) => {
            const rank = (app: TizenApplicationInfo) => {
              const text = (app.name + ' ' + app.id).toLocaleLowerCase('en-US');
              const index = preferred.findIndex((hint) => text.includes(hint));
              return index < 0 ? preferred.length : index;
            };
            const rankDifference = rank(a) - rank(b);
            return rankDifference || a.name.localeCompare(b.name, 'ru');
          });
        resolve(normalized);
      },
      () => resolve([]),
    );
  });
}


export function launchInstalledAppById(
  appId: string,
  installedApps: InstalledTVApp[],
): Promise<{ ok: boolean; message: string }> {
  const app = installedApps.find((item) => item.id === appId);
  const manager = window.tizen?.application;
  if (!app) return Promise.resolve({ ok: false, message: 'App is no longer in the TV app list.' });
  if (!manager?.launch) return Promise.resolve({ ok: false, message: 'App launching is only available inside a Tizen TV app.' });

  return new Promise((resolve) => {
    manager.launch(
      app.id,
      () => resolve({ ok: true, message: app.name + ' launched.' }),
      (error) => resolve({
        ok: false,
        message: 'Tizen could not launch the app: ' + (error?.message || error?.name || 'unknown error'),
      }),
    );
  });
}

const appNameMatchers: Record<Exclude<AppTarget, 'assistant'>, RegExp> = {
  youtube: /youtube\s*for\s*tizen|tizen\s*tube|tube\s*for\s*tizen|tizen-youtube|tUb3Xq7Lm9/i,
  jellyfin: /jellyfin/i,
  selfmusic: /self\s*music|selfmusic/i,
  browser: /internet|browser|браузер/i,
};

export async function launchTVService(
  target: AppTarget,
  installedApps: InstalledTVApp[],
  urls: { jellyfinUrl: string; selfMusicUrl: string },
): Promise<{ ok: boolean; message: string }> {
  if (target === 'assistant') return { ok: true, message: 'Assistant is already open.' };

  const matcher = appNameMatchers[target];
  const app = installedApps.find((item) => matcher.test(item.name) || matcher.test(item.id));
  const manager = window.tizen?.application;

  if (app && manager?.launch) {
    return new Promise((resolve) => {
      manager.launch(
        app.id,
        () => resolve({ ok: true, message: 'App launched.' }),
        (error) => resolve({
          ok: false,
          message: 'Tizen could not launch the app: ' + (error?.message || error?.name || 'unknown error'),
        }),
      );
    });
  }

  if (target === 'jellyfin' && urls.jellyfinUrl.trim()) {
    return openConfiguredUrl(urls.jellyfinUrl, 'Jellyfin');
  }
  if (target === 'selfmusic' && urls.selfMusicUrl.trim()) {
    return openConfiguredUrl(urls.selfMusicUrl, 'SelfMusic');
  }

  if (!isTizenRuntime()) {
    return {
      ok: false,
      message: 'This is a browser preview. On TV, install the app or check the Tizen app catalog.',
    };
  }

  const names: Record<Exclude<AppTarget, 'assistant'>, string> = {
    youtube: 'a compatible YouTube client',
    jellyfin: 'Jellyfin',
    selfmusic: 'SelfMusic',
    browser: 'browser',
  };
  return { ok: false, message: 'Could not find installed ' + names[target] + '. Check the app library.' };
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return false;
  const [first, second] = octets;
  return first === 10 || first === 127 || (first === 192 && second === 168)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 169 && second === 254) || (first === 100 && second >= 64 && second <= 127);
}

export function isAllowedServiceUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl.trim());
    if (url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    if (url.protocol !== 'http:') return false;
    const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
      || host === '::1' || host.startsWith('fc') || host.startsWith('fd')
      || host.startsWith('fe80:') || isPrivateIpv4(host);
  } catch { return false; }
}

function openConfiguredUrl(rawUrl: string, serviceName: string): { ok: boolean; message: string } {
  let url: URL;
  try { url = new URL(rawUrl.trim()); } catch {
    return { ok: false, message: 'The URL for ' + serviceName + ' is invalid.' };
  }
  if (!isAllowedServiceUrl(url.toString())) {
    return { ok: false, message: 'Use HTTPS for public servers. HTTP is allowed only for localhost/private LAN/Tailscale addresses.' };
  }
  const opened = window.open(url.toString(), '_blank');
  if (opened) {
    try { opened.opener = null; } catch { /* Some TV WebViews expose a read-only opener. */ }
    return { ok: true, message: serviceName + ' opened.' };
  }
  window.location.assign(url.toString());
  return { ok: true, message: serviceName + ' is opening. Press Back to return to B1O TV.' };
}
