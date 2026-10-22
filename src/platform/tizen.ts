import type { AppTarget, InstalledTVApp } from '../types';

interface TizenApplicationInfo {
  id: string;
  name: string;
  iconPath?: string;
  version?: string;
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
    tizen?: { application?: TizenApplicationManager };
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

const appNameMatchers: Record<Exclude<AppTarget, 'assistant'>, RegExp> = {
  youtube: /youtube|you\s*tube|tizen\s*tube|tube for tizen/i,
  jellyfin: /jellyfin/i,
  selfmusic: /self\s*music|selfmusic/i,
  browser: /internet|browser|браузер/i,
};

export async function launchTVService(
  target: AppTarget,
  installedApps: InstalledTVApp[],
  urls: { jellyfinUrl: string; selfMusicUrl: string },
): Promise<{ ok: boolean; message: string }> {
  if (target === 'assistant') return { ok: true, message: 'Ассистент уже открыт.' };

  const matcher = appNameMatchers[target];
  const app = installedApps.find((item) => matcher.test(item.name) || matcher.test(item.id));
  const manager = window.tizen?.application;

  if (app && manager?.launch) {
    return new Promise((resolve) => {
      manager.launch(
        app.id,
        () => resolve({ ok: true, message: 'Приложение запущено.' }),
        (error) => resolve({
          ok: false,
          message: 'Tizen не смог запустить приложение: ' + (error?.message || error?.name || 'неизвестная ошибка'),
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
      message: 'Это браузерный прототип. На TV подключи приложение или проверь его установку в каталоге Tizen.',
    };
  }

  const names: Record<Exclude<AppTarget, 'assistant'>, string> = {
    youtube: 'совместимый YouTube-клиент',
    jellyfin: 'Jellyfin',
    selfmusic: 'SelfMusic',
    browser: 'браузер',
  };
  return { ok: false, message: 'Не найден установленный ' + names[target] + '. Проверь библиотеку приложений.' };
}

function openConfiguredUrl(rawUrl: string, serviceName: string): { ok: boolean; message: string } {
  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return { ok: false, message: 'Для ' + serviceName + ' укажи HTTPS URL (или локальный адрес для разработки).' };
    }
    const opened = window.open(url.toString(), '_blank', 'noopener,noreferrer');
    if (!opened) return { ok: false, message: 'Телевизор заблокировал новое окно. Установи клиент приложения или проверь настройку ссылки.' };
    return { ok: true, message: serviceName + ' открыт.' };
  } catch {
    return { ok: false, message: 'Адрес ' + serviceName + ' указан некорректно.' };
  }
}