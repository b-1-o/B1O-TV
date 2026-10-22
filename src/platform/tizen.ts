import type { AppTarget, InstalledTVApp } from '../types';

interface TizenApplicationInfo {
  id: string;
  name: string;
  iconPath?: string;
  version?: string;
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

declare global {
  interface Window {
    tizen?: {
      application?: TizenApplicationManager;
      tvinputdevice?: TizenInputDeviceManager;
    };
  }
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
        const normalized = apps
          .filter((app) => typeof app.id === 'string' && typeof app.name === 'string')
          .map((app) => ({
            id: app.id,
            name: app.name,
            iconPath: app.iconPath,
            version: app.version,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
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
  youtube: /youtube\s*for\s*tizen|tizen\s*tube|tube\s*for\s*tizen|tizen-youtube/i,
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

function openConfiguredUrl(rawUrl: string, serviceName: string): { ok: boolean; message: string } {
  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return { ok: false, message: 'For ' + serviceName + ' requires an HTTPS URL (or a local development URL).' };
    }
    const opened = window.open(url.toString(), '_blank', 'noopener,noreferrer');
    if (!opened) return { ok: false, message: 'The TV blocked the new window. Install the app client or check the link settings.' };
    return { ok: true, message: serviceName + ' opened.' };
  } catch {
    return { ok: false, message: 'The URL for ' + serviceName + ' is invalid.' };
  }
}