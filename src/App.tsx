import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FocusContext, doesFocusableExist, setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import {
  ArrowRight,
  BookOpen,
  Download,
  Check,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSnow,
  Film,
  Grid2X2,
  Info,
  LoaderCircle,
  Mic,
  Moon,
  Music2,
  Play,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Sun,
  Timer,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import type { ActiveTimer, AppTarget, AssistantMessage, InstalledTVApp, TVApp, TVSettings, View, WeatherSnapshot } from './types';
import { createAssistantMessage, askConfiguredAssistant, formatDuration, parseLocalIntent, readSavedNotes, saveNote, transcribeRecordedAudio } from './services/assistant';
import { describeWeather, fetchWeather } from './services/weather';
import { getInstalledApps, isTizenRuntime, launchInstalledAppById, launchTVService, listenSamsungVoiceInteraction, registerSamsungVoiceInteraction, registerSpatialRemoteKeys, registerVoiceRemoteKey } from './platform/tizen';
import { CardGrid, FocusGroup } from './components/tv/CardGrid';
import { TVButton, TVInput, TVSelect } from './components/tv/FocusableControls';
import { DEFAULT_CONFIG } from './defaultConfig';
import { AssistantFeaturedCard, CatalogAppCard, FeaturedAppCard, InstalledAppRow, WallpaperChoiceCard } from './components/tv/MemoizedCards';
import { SelfMusicPanel } from './components/tv/SelfMusicPanel';

const SETTINGS_KEY = 'b1o-tv:settings';
const TIMER_KEY = 'b1o-tv:timer';

const WALLPAPERS = [
  { id: 'main', name: 'Main', src: new URL('../assets/main wp.jpg', import.meta.url).href, position: 'center' },
  { id: 'canopy', name: 'Dark Canopy', src: new URL('../assets/dark-canopy.jpg', import.meta.url).href, position: 'center' },
  { id: 'sakura', name: 'Foggy Sakura', src: new URL('../assets/fog sakura.jpg', import.meta.url).href, position: 'center' },
  { id: 'castle', name: 'Castle', src: new URL('../assets/castle.jpeg', import.meta.url).href, position: 'center' },
  { id: 'jzgk4', name: 'JZGK4', src: new URL('../assets/jZGK4.jpg', import.meta.url).href, position: 'center' },
  { id: 'palat', name: 'Palat', src: new URL('../assets/palat.jpeg', import.meta.url).href, position: 'center' },
  { id: 'wallhaven', name: 'Wallhaven', src: new URL('../assets/wallhaven-6lpoow.jpg', import.meta.url).href, position: 'center' },
] as const;



const FEATURED_APPS: TVApp[] = [
  { id: 'youtube', name: 'TizenTube', subtitle: 'Launch the installed YouTube client', category: 'Video', symbol: 'YT', target: 'youtube' },
  { id: 'jellyfin', name: 'Jellyfin', subtitle: 'Your home media library', category: 'Movies & TV', symbol: 'JF', target: 'jellyfin' },
  { id: 'selfmusic', name: 'SelfMusic', subtitle: 'Your music library and player, built into B1O TV', category: 'Music', symbol: 'SM', target: 'selfmusic' },
  { id: 'browser', name: 'Browser', subtitle: 'Websites and web apps', category: 'Tools', symbol: 'WWW', target: 'browser' },
];

function readSettings(): TVSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_CONFIG;
    const settings = { ...DEFAULT_CONFIG, ...(parsed as Partial<TVSettings>) };
    if (typeof settings.aiEndpoint !== 'string' || !settings.aiEndpoint.trim()) {
      settings.aiEndpoint = DEFAULT_CONFIG.aiEndpoint;
    }
    if (typeof settings.adaptiveScenery !== 'boolean') settings.adaptiveScenery = DEFAULT_CONFIG.adaptiveScenery;
    if (!WALLPAPERS.some((wallpaper) => wallpaper.id === settings.wallpaper)) {
      settings.wallpaper = DEFAULT_CONFIG.wallpaper;
    }
    if (settings.temperatureUnit !== 'F' && settings.temperatureUnit !== 'C') {
      settings.temperatureUnit = DEFAULT_CONFIG.temperatureUnit;
    }
    return settings;
  } catch {
    return DEFAULT_CONFIG;
  }
}

function readTimer(): ActiveTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const value = parsed as ActiveTimer;
    if (typeof value.endAt !== 'number' || value.endAt <= Date.now() || typeof value.label !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}

function formatTemperature(temperatureF: number, unit: TVSettings['temperatureUnit']): string {
  const displayed = unit === 'C' ? (temperatureF - 32) * 5 / 9 : temperatureF;
  return Math.round(displayed) + '°' + unit;
}

function getAdaptiveWallpaper(weather: WeatherSnapshot | null, now: Date) {
  if (!weather) return WALLPAPERS.find((wallpaper) => wallpaper.id === 'wallhaven') ?? WALLPAPERS[0];
  const hour = now.getHours();
  let id = 'wallhaven';
  if (!weather.isDay || hour < 6 || hour >= 20) id = 'wallhaven';
  else if ([45, 48].includes(weather.code)) id = 'sakura';
  else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99].includes(weather.code)) id = 'canopy';
  else if (weather.code === 0) id = 'main';
  else if (weather.code <= 3) id = 'castle';
  return WALLPAPERS.find((wallpaper) => wallpaper.id === id) ?? WALLPAPERS[0];
}

function WeatherIcon({ code, isDay }: { code: number; isDay: boolean }) {
  if (code === 0) return isDay ? <Sun /> : <Moon />;
  if (code === 45 || code === 48) return <CloudFog />;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return <CloudRain />;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow />;
  return <Cloud />;
}

function App() {
  const { ref: spatialRootRef, focusKey: spatialRootFocusKey } = useFocusable({
    focusKey: 'B1O-TV-ROOT',
    trackChildren: true,
    autoRestoreFocus: true,
  });
  const [view, setView] = useState<View>('home');
  const [compactHome, setCompactHome] = useState(false);
  const [musicActivity, setMusicActivity] = useState(false);
  const [selfMusicNowPlaying, setSelfMusicNowPlaying] = useState('');
  const [selfMusicAccessToken, setSelfMusicAccessToken] = useState('');
  const [settings, setSettings] = useState<TVSettings>(readSettings);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [forecastOpen, setForecastOpen] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [installedApps, setInstalledApps] = useState<InstalledTVApp[]>([]);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const assistantCloseTimer = useRef<number | undefined>(undefined);
  const assistantActivityTimer = useRef<number | undefined>(undefined);
  const islandExitTimer = useRef<number | undefined>(undefined);
  const viewExitTimer = useRef<number | undefined>(undefined);
  const viewEnterTimer = useRef<number | undefined>(undefined);
  const lastContentFocusKeyRef = useRef<string | null>(null);
  const setupImportRef = useRef<HTMLInputElement | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantClosing, setAssistantClosing] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [aiChecking, setAiChecking] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [assistantActivityText, setAssistantActivityText] = useState('');
  const [islandMounted, setIslandMounted] = useState(false);
  const [islandClosing, setIslandClosing] = useState(false);
  const [viewMotion, setViewMotion] = useState<'enter' | 'exit' | ''>('enter');
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([
    createAssistantMessage('assistant', 'I’m B1O Assistant. I can answer questions, remember notes, set timers, and open installed apps. Speak or type in English or Russian.'),
  ]);
  const [timer, setTimer] = useState<ActiveTimer | null>(readTimer);
  const [remainingMs, setRemainingMs] = useState(0);
  const [notesVersion, setNotesVersion] = useState(0);
  const voiceStartRef = useRef<() => void>(() => undefined);
  const voiceActionAtRef = useRef(0);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceRecorderTimerRef = useRef<number | undefined>(undefined);
  const voiceChunksRef = useRef<BlobPart[]>([]);

  const navigateToView = useCallback((nextView: View) => {
    if (nextView === view) return;
    if (viewExitTimer.current !== undefined) window.clearTimeout(viewExitTimer.current);
    if (viewEnterTimer.current !== undefined) window.clearTimeout(viewEnterTimer.current);
    if (isTizenRuntime()) {
      setView(nextView);
      setViewMotion('');
      return;
    }
    setViewMotion('exit');
    viewExitTimer.current = window.setTimeout(() => {
      setView(nextView);
      setViewMotion('enter');
      viewEnterTimer.current = window.setTimeout(() => setViewMotion(''), 430);
    }, 170);
  }, [view]);

  const closeAssistant = useCallback(() => {
    if (assistantCloseTimer.current !== undefined) window.clearTimeout(assistantCloseTimer.current);
    setAssistantClosing(true);
    assistantCloseTimer.current = window.setTimeout(() => {
      setAssistantOpen(false);
      setAssistantClosing(false);
    }, 220);
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 1_800);
  }, []);

  const refreshInstalledApps = useCallback(async () => {
    const apps = await getInstalledApps();
    setInstalledApps(apps);
    return apps;
  }, []);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    if (isTizenRuntime()) {
      setCompactHome(false);
      return;
    }
    const onScroll = () => setCompactHome(window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setCompactHome(false);
  }, [view]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      notify('Settings storage is unavailable in this mode.');
    }
  }, [settings, notify]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      setWeatherLoading(true);
      setWeatherError('');
      try {
        const result = await fetchWeather(settings.city, controller.signal);
        if (active) setWeather(result);
      } catch (error) {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setWeatherError(error instanceof Error ? error.message : 'Weather is unavailable.');
      } finally {
        if (active) setWeatherLoading(false);
      }
    };
    void load();
    const refresh = window.setInterval(() => void load(), 30 * 60 * 1_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(refresh);
    };
  }, [settings.city]);

  useEffect(() => { void refreshInstalledApps(); }, [refreshInstalledApps]);

  useEffect(() => registerSpatialRemoteKeys(), []);

  useEffect(() => registerVoiceRemoteKey(() => {
    setAssistantClosing(false);
    setAssistantOpen(true);
    window.setTimeout(() => voiceStartRef.current(), 80);
  }), []);

  useEffect(() => () => {
    if (voiceRecorderTimerRef.current !== undefined) window.clearTimeout(voiceRecorderTimerRef.current);
    try { if (voiceRecorderRef.current?.state !== 'inactive') voiceRecorderRef.current?.stop(); } catch { /* App is closing. */ }
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    try {
      if (timer) localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
      else localStorage.removeItem(TIMER_KEY);
    } catch {
      // App stays usable if the web runtime restricts storage.
    }
    if (!timer) {
      setRemainingMs(0);
      return;
    }
    const update = () => {
      const next = timer.endAt - Date.now();
      if (next <= 0) {
        setTimer(null);
        notify('Timer finished: ' + timer.label);
      } else {
        setRemainingMs(next);
      }
    };
    update();
    const interval = window.setInterval(update, 1_000);
    return () => window.clearInterval(interval);
  }, [timer, notify]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      const isTizenBack = event.keyCode === 10009 || event.key === 'BrowserBack';
      const isBack = event.key === 'Escape' || event.key === 'Backspace' || isTizenBack;

      // Backspace in a text field edits text; it must not navigate away.
      if (isBack && (!isTyping || isTizenBack || event.key === 'Escape')) {
        if (forecastOpen) {
          event.preventDefault();
          setForecastOpen(false);
          return;
        }
        if (assistantOpen) {
          event.preventDefault();
          closeAssistant();
          return;
        }
        if (view !== 'home') {
          event.preventDefault();
          navigateToView('home');
          return;
        }
      }

      const micKey = event.key === 'Microphone' || event.key === 'AudioInputMicrophone' || event.key.toLocaleLowerCase().includes('microphone');
      if (micKey) {
        event.preventDefault();
        setAssistantClosing(false);
        setAssistantOpen(true);
        window.setTimeout(() => voiceStartRef.current(), 80);
        return;
      }

      if (event.altKey && event.key.toLocaleLowerCase() === 'v' && !isTyping) {
        event.preventDefault();
        setAssistantClosing(false);
        setAssistantOpen(true);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [assistantOpen, forecastOpen, view, closeAssistant, navigateToView]);

  const preferredFocusKey = view === 'home'
    ? 'CARD-youtube'
    : view === 'apps'
      ? 'CATALOG-youtube'
      : view === 'library'
        ? 'LIBRARY-jellyfin'
        : view === 'selfmusic'
          ? (selfMusicAccessToken ? 'SELFMUSIC-SEARCH' : 'SELFMUSIC-SERVER-URL')
          : 'WALLPAPER-main';

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      if (doesFocusableExist(preferredFocusKey)) {
        setFocus(preferredFocusKey);
      } else {
        setFocus(view === 'settings' ? 'DOCK-settings' : view === 'apps' ? 'DOCK-apps' : view === 'selfmusic' ? 'DOCK-selfmusic' : 'BRAND-HOME');
      }
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [view, preferredFocusKey]);

  // Keep the bottom dock reachable with the Samsung remote even when spatial
  // navigation considers the content cards a separate focus group.
  useEffect(() => {
    const onRemoteVerticalKey = (event: KeyboardEvent) => {
      const goDown = event.key === 'ArrowDown' || event.key === 'Down' || event.keyCode === 40;
      const goUp = event.key === 'ArrowUp' || event.key === 'Up' || event.keyCode === 38;
      if (!goDown && !goUp) return;
      if (assistantOpen || forecastOpen) return;

      const target = event.target;
      if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      if (target instanceof HTMLInputElement && !['checkbox', 'range', 'file'].includes(target.type)) return;

      const focused = document.querySelector<HTMLElement>('[data-tv-focused="true"]');
      if (!focused) return;
      const inDock = focused.closest('.floating-dock');

      if (goUp && inDock) {
        const rememberedKey = lastContentFocusKeyRef.current;
        const targetKey = rememberedKey && doesFocusableExist(rememberedKey)
          ? rememberedKey
          : doesFocusableExist(preferredFocusKey) ? preferredFocusKey : 'BRAND-HOME';
        event.preventDefault();
        event.stopPropagation();
        setFocus(targetKey);
        return;
      }

      if (!goDown || inDock) return;
      const main = focused.closest<HTMLElement>('.main-content');
      if (!main) return;
      const currentRect = focused.getBoundingClientRect();
      const hasFocusableBelow = Array.from(main.querySelectorAll<HTMLElement>('[data-tv-focus="true"]')).some((element) => {
        if (element === focused || ('disabled' in element && Boolean((element as HTMLButtonElement).disabled))) return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top > currentRect.top + 8;
      });
      if (hasFocusableBelow) return;

      const currentFocusKey = focused.getAttribute('data-tv-focus-key');
      if (currentFocusKey) lastContentFocusKeyRef.current = currentFocusKey;
      event.preventDefault();
      event.stopPropagation();
      setFocus('DOCK-apps');
    };

    window.addEventListener('keydown', onRemoteVerticalKey, true);
    return () => window.removeEventListener('keydown', onRemoteVerticalKey, true);
  }, [assistantOpen, forecastOpen, preferredFocusKey]);

  useEffect(() => {
    if (!assistantOpen) return;
    const focusTimer = window.setTimeout(() => {
      if (doesFocusableExist('ASSISTANT-CLOSE')) setFocus('ASSISTANT-CLOSE');
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [assistantOpen]);

  useEffect(() => {
    if (!forecastOpen) return;
    const focusTimer = window.setTimeout(() => {
      if (doesFocusableExist('FORECAST-CLOSE')) setFocus('FORECAST-CLOSE');
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [forecastOpen]);

  const updateSetting = <K extends keyof TVSettings>(key: K, value: TVSettings[K]) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  };

  const openAssistant = useCallback(() => {
    setAssistantClosing(false);
    setAssistantOpen(true);
    window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-assistant-input]')?.focus(), 60);
  }, []);
  const testAssistantConnection = async () => {
    if (!settings.aiToken.trim()) {
      notify('Add the Device token in Settings → AI & Voice first.');
      return;
    }
    setAiChecking(true);
    try {
      await askConfiguredAssistant(
        settings.aiEndpoint,
        'Reply with exactly: B1O TV AI connection OK.',
        [],
        settings.aiToken,
      );
      notify('AI backend is reachable and returned a response.');
    } catch (error) {
      notify('AI connection failed: ' + (error instanceof Error ? error.message : 'Unknown error.'));
    } finally {
      setAiChecking(false);
    }
  };

  const startVoiceAssistant = () => {
    if (assistantCloseTimer.current !== undefined) window.clearTimeout(assistantCloseTimer.current);
    setAssistantClosing(false);
    setAssistantOpen(true);
    setAssistantActivityText('');
    if (assistantActivityTimer.current !== undefined) window.clearTimeout(assistantActivityTimer.current);
    voiceStartRef.current();
  };

  const showAssistantActivity = (message: string) => {
    setAssistantActivityText(message);
    if (assistantActivityTimer.current !== undefined) window.clearTimeout(assistantActivityTimer.current);
    assistantActivityTimer.current = window.setTimeout(() => setAssistantActivityText(''), 5_500);
  };

  const exportTVSetup = () => {
    const payload = {
      format: 'b1o-tv-setup',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'b1o-tv-setup.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    notify('TV setup exported. Keep this file private: it contains your device token.');
  };

  const importTVSetup = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw: unknown = JSON.parse(String(reader.result ?? ''));
        if (typeof raw !== 'object' || raw === null) throw new Error('Invalid setup file.');
        const payload = raw as { format?: unknown; settings?: unknown };
        if (payload.format !== 'b1o-tv-setup' || typeof payload.settings !== 'object' || payload.settings === null) {
          throw new Error('This is not a valid B1O TV setup file.');
        }
        const imported = { ...DEFAULT_CONFIG, ...(payload.settings as Partial<TVSettings>) };
        if (!WALLPAPERS.some((wallpaper) => wallpaper.id === imported.wallpaper)) imported.wallpaper = DEFAULT_CONFIG.wallpaper;
        if (imported.temperatureUnit !== 'C' && imported.temperatureUnit !== 'F') imported.temperatureUnit = 'F';
        if (typeof imported.aiEndpoint !== 'string' || !imported.aiEndpoint.trim()) imported.aiEndpoint = DEFAULT_CONFIG.aiEndpoint;
        setSettings(imported);
        notify('TV setup imported successfully.');
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Could not read the setup file.');
      } finally {
        if (setupImportRef.current) setupImportRef.current.value = '';
      }
    };
    reader.onerror = () => notify('Could not read the setup file.');
    reader.readAsText(file);
  };

  const handleSelfMusicPlayback = useCallback((state: { isPlaying: boolean; title: string }) => {
    setMusicActivity(state.isPlaying);
    setSelfMusicNowPlaying(state.isPlaying ? state.title : '');
  }, []);

  const runApp = useCallback(async (target: AppTarget): Promise<{ ok: boolean; message: string }> => {
    if (target === 'assistant') {
      openAssistant();
      return { ok: true, message: 'Assistant opened.' };
    }

    if (target === 'selfmusic') {
      navigateToView('selfmusic');
      return { ok: true, message: 'SelfMusic opened inside B1O TV.' };
    }

    const result = await launchTVService(target, installedApps, {
      jellyfinUrl: settings.jellyfinUrl,
      selfMusicUrl: settings.selfMusicUrl,
    });

    notify(result.message);
    return result;
  }, [installedApps, navigateToView, notify, openAssistant, settings.jellyfinUrl, settings.selfMusicUrl]);

  const launchInstalledApp = useCallback((appId: string) => {
    if (!isTizenRuntime()) {
      const app = installedApps.find((item) => item.id === appId);
      notify('Browser preview: ' + (app?.name ?? 'This app') + ' would launch on the TV. Native app launching requires Samsung Tizen.');
      return;
    }
    void launchInstalledAppById(appId, installedApps).then((result) => notify(result.message));
  }, [installedApps, notify]);

  const chooseWallpaper = useCallback((wallpaperId: string) => {
    setSettings((previous) => ({ ...previous, wallpaper: wallpaperId }));
  }, []);

  const submitAssistant = async (rawText?: string) => {
    const text = (rawText ?? draft).trim();
    if (!text || assistantBusy) return;
    const english = !/[а-яё]/i.test(text);
    setDraft('');
    setMessages((previous) => [...previous, createAssistantMessage('user', text)].slice(-60));
    setAssistantBusy(true);

    let reply = '';
    try {
      const intent = parseLocalIntent(text);
      if (intent?.kind === 'remember') {
        const note = saveNote(intent.note);
        setNotesVersion((value) => value + 1);
        reply = english
          ? 'Saved a note on this TV: “' + note.text + '”.'
          : 'Запомнил в заметках этого приложения: «' + note.text + '».';
      } else if (intent?.kind === 'recall') {
        const notes = readSavedNotes();
        reply = notes.length
          ? (english ? 'Here are your saved notes:\n' : 'Вот что сохранено в заметках:\n')
            + notes.slice(-8).map((note, index) => (index + 1) + '. ' + note.text).join('\n')
          : english
            ? 'No saved notes yet. Say “Remember that…” to save one.'
            : 'Пока нет сохранённых заметок. Скажи, например: «Запомни, что…».';
      } else if (intent?.kind === 'timer') {
        const nextTimer = { endAt: Date.now() + intent.durationMs, label: formatDuration(intent.durationMs) };
        setTimer(nextTimer);
        reply = english
          ? 'Timer started for ' + nextTimer.label + '. An alarm is not guaranteed if B1O TV is closed or unloaded by the TV.'
          : 'Таймер запущен на ' + nextTimer.label + '. Пока B1O TV закрыт или выгружен системой, звук/системное уведомление не гарантируются.';
      } else if (intent?.kind === 'time') {
        const time = new Intl.DateTimeFormat(english ? 'en-US' : 'ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date());
        reply = english ? 'Current time: ' + time + '.' : 'Сейчас ' + time + '.';
      } else if (intent?.kind === 'launch') {
        const result = await runApp(intent.target);
        reply = result.message;
      } else {
        reply = await askConfiguredAssistant(settings.aiEndpoint, text, messages.slice(-10), settings.aiToken);
      }
    } catch (error) {
      reply = error instanceof Error ? error.message : 'Could not complete that request. Please try again.';
    }

    setMessages((previous) => [...previous, createAssistantMessage('assistant', reply)].slice(-60));
    setAssistantBusy(false);
    showAssistantActivity(reply.length > 62 ? reply.slice(0, 59).trimEnd() + '…' : reply);
    if (settings.speakReplies && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(reply));
      } catch {
        // Speech synthesis is optional and varies by browser/TV runtime.
      }
    }
  };

  const stopVoiceRecording = () => {
    if (voiceRecorderTimerRef.current !== undefined) {
      window.clearTimeout(voiceRecorderTimerRef.current);
      voiceRecorderTimerRef.current = undefined;
    }
    const recorder = voiceRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch { /* It may already be stopping. */ }
    }
  };

  const startRecordedSpeech = async (): Promise<boolean> => {
    if (!settings.aiEndpoint.trim() || !settings.aiToken.trim()) {
      notify('To dictate into AI, configure the AI endpoint and Device token in Settings → AI & Voice.');
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') return false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return false;
    }

    let recorder: MediaRecorder;
    try {
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = preferredTypes.find((type) => {
        try { return typeof window.MediaRecorder.isTypeSupported !== 'function' || window.MediaRecorder.isTypeSupported(type); }
        catch { return false; }
      });
      recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }

    voiceChunksRef.current = [];
    voiceStreamRef.current = stream;
    voiceRecorderRef.current = recorder;
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) voiceChunksRef.current.push(event.data);
    };
    recorder.onerror = () => {
      stopVoiceRecording();
      setVoiceListening(false);
      showAssistantActivity('Microphone recording failed');
      notify('Could not record microphone audio on this TV. Try the voice button again.');
    };
    recorder.onstop = () => {
      if (voiceRecorderTimerRef.current !== undefined) {
        window.clearTimeout(voiceRecorderTimerRef.current);
        voiceRecorderTimerRef.current = undefined;
      }
      voiceRecorderRef.current = null;
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
      setVoiceListening(false);
      const blob = new Blob(voiceChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      voiceChunksRef.current = [];
      if (blob.size < 512) {
        showAssistantActivity('No audio detected');
        notify('No audio was captured. Check that the microphone is available to the TV app.');
        return;
      }
      showAssistantActivity('Transcribing speech…');
      void transcribeRecordedAudio(settings.aiEndpoint, blob, settings.aiToken)
        .then((transcript) => {
          if (transcript.trim()) void submitAssistant(transcript);
          else notify('No speech was recognized. Try again.');
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Speech recognition failed.';
          showAssistantActivity('Speech recognition failed');
          notify(message);
        });
    };

    try {
      recorder.start(250);
      setVoiceListening(true);
      setAssistantActivityText('Listening… tap the microphone to send');
      if (assistantActivityTimer.current !== undefined) window.clearTimeout(assistantActivityTimer.current);
      // TV remotes are awkward for hold-to-talk, so automatically end each recording after 8 seconds.
      voiceRecorderTimerRef.current = window.setTimeout(() => {
        if (voiceRecorderRef.current?.state === 'recording') stopVoiceRecording();
      }, 8_000);
      notify('Listening for up to 8 seconds. Tap the microphone again to send sooner.');
      return true;
    } catch {
      voiceRecorderRef.current = null;
      stream.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
      return false;
    }
  };

  const startFallbackVoice = async () => {
    const recordingStarted = await startRecordedSpeech();
    if (recordingStarted) return;

    const samsungVoice = listenSamsungVoiceInteraction();
    if (samsungVoice.ok) {
      setVoiceListening(false);
      showAssistantActivity('Samsung voice commands active');
      notify('Samsung Voice Interaction is active. It can navigate/select TV controls; free-form AI dictation requires microphone capture plus the configured speech service.');
      return;
    }

    setVoiceListening(false);
    showAssistantActivity('Microphone unavailable');
    notify('This TV cannot provide microphone audio to the app. Check Settings → AI & Voice and the TV microphone permission; remote-mic speech may be available only through Samsung Voice Interaction.');
  };

  const startVoiceInput = () => {
    const nowMs = Date.now();
    // Samsung can deliver the same microphone key to both document and window listeners.
    if (nowMs - voiceActionAtRef.current < 650) return;
    voiceActionAtRef.current = nowMs;

    if (voiceRecorderRef.current?.state === 'recording') {
      stopVoiceRecording();
      return;
    }

    type RecognitionResult = { 0?: { transcript?: string } };
    type RecognitionEvent = { results?: ArrayLike<RecognitionResult> };
    type Recognition = {
      lang: string;
      interimResults: boolean;
      onresult: ((event: RecognitionEvent) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    type RecognitionConstructor = new () => Recognition;
    const speechWindow = window as Window & {
      SpeechRecognition?: RecognitionConstructor;
      webkitSpeechRecognition?: RecognitionConstructor;
    };
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!Constructor) {
      void startFallbackVoice();
      return;
    }

    try {
      const recognition = new Constructor();
      recognition.lang = 'ru-RU';
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          setAssistantActivityText('Thinking…');
          void submitAssistant(transcript);
        }
      };
      recognition.onerror = () => {
        setVoiceListening(false);
        void startFallbackVoice();
      };
      recognition.onend = () => setVoiceListening(false);
      setAssistantActivityText('');
      if (assistantActivityTimer.current !== undefined) window.clearTimeout(assistantActivityTimer.current);
      setVoiceListening(true);
      recognition.start();
    } catch {
      setVoiceListening(false);
      void startFallbackVoice();
    }
  };

  voiceStartRef.current = startVoiceInput;

  useEffect(() => registerSamsungVoiceInteraction({
    getState: () => assistantOpen ? 'Search' : view === 'home' ? 'Home' : view === 'settings' ? 'Setting' : 'List',
    onNavigate: (navigation) => {
      if (navigation === 'NAV_SHOW_MORE') { navigateToView('apps'); return true; }
      if (navigation === 'NAV_PREVIOUS') {
        if (assistantOpen) { closeAssistant(); return true; }
        if (forecastOpen) { setForecastOpen(false); return true; }
        if (view !== 'home') { navigateToView('home'); return true; }
        return false;
      }
      const key = ({
        NAV_LEFT: 'ArrowLeft',
        NAV_RIGHT: 'ArrowRight',
        NAV_UP: 'ArrowUp',
        NAV_DOWN: 'ArrowDown',
        NAV_NEXT: 'ArrowRight',
      } as Record<string, string>)[navigation];
      if (!key) return false;
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      return true;
    },
    onSelect: (selection) => {
      const scope = assistantOpen
        ? document.querySelector<HTMLElement>('.assistant-panel') ?? document
        : document.querySelector<HTMLElement>('.main-content') ?? document;
      const controls = Array.from(scope.querySelectorAll<HTMLElement>('[data-tv-focus="true"]'))
        .filter((element) => {
          if ('disabled' in element && Boolean((element as HTMLButtonElement).disabled)) return false;
          const style = window.getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
        });
      const focused = scope.querySelector<HTMLElement>('[data-tv-focused="true"]')
        ?? document.querySelector<HTMLElement>('[data-tv-focused="true"]');
      if (selection === 0) { if (!focused) return false; focused.click(); return true; }
      const index = selection === -1 ? controls.length - 1 : selection > 0 ? Math.min(controls.length - 1, selection - 1) : -1;
      if (index < 0 || !controls[index]) return false;
      controls[index].click();
      return true;
    },
    onAppState: (state) => {
      if (state === 'Home') { navigateToView('home'); return true; }
      if (state === 'List') { navigateToView('apps'); return true; }
      if (state === 'Setting') { navigateToView('settings'); return true; }
      if (state === 'Search') { openAssistant(); return true; }
      return false;
    },
  }), [assistantOpen, closeAssistant, forecastOpen, navigateToView, openAssistant, view]);

  const filteredApps = useMemo(() => {
    const value = search.trim().toLocaleLowerCase('en-US');
    const featured = FEATURED_APPS.filter((app) => !value || [app.name, app.subtitle, app.category].some((field) => field.toLocaleLowerCase('en-US').includes(value)));
    const discovered = installedApps.filter((app) => !value || app.name.toLocaleLowerCase('en-US').includes(value));
    return { featured, discovered };
  }, [search, installedApps]);

  const notes = useMemo(() => {
    void notesVersion;
    return readSavedNotes();
  }, [notesVersion]);

  const shouldShowIsland = !assistantOpen && (
    voiceListening || assistantBusy || Boolean(assistantActivityText) || Boolean(timer) || musicActivity
  );

  useEffect(() => {
    if (shouldShowIsland) {
      setIslandMounted(true);
      setIslandClosing(false);
      return;
    }
    if (!islandMounted) return;
    setIslandClosing(true);
    islandExitTimer.current = window.setTimeout(() => {
      setIslandMounted(false);
      setIslandClosing(false);
    }, 220);
    return () => {
      if (islandExitTimer.current !== undefined) window.clearTimeout(islandExitTimer.current);
    };
  }, [shouldShowIsland, islandMounted]);

  const shellClass = 'app-shell' + (isTizenRuntime() ? ' tv-runtime' : '') + (settings.reduceMotion ? ' reduce-motion' : '') + (view === 'home' && compactHome ? ' catalog-mode' : '');
  const activeWallpaper = settings.adaptiveScenery
    ? getAdaptiveWallpaper(weather, now)
    : WALLPAPERS.find((wallpaper) => wallpaper.id === settings.wallpaper) ?? WALLPAPERS[0];
  const displayedClock = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(now);
  const displayedDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  return (
    <FocusContext.Provider value={spatialRootFocusKey}>
    <div ref={spatialRootRef as import('react').Ref<HTMLDivElement>} className={shellClass} style={{
      '--glass-intensity': settings.glassIntensity / 100,
      '--wallpaper-image': `url("${activeWallpaper.src}")`,
      '--wallpaper-position': activeWallpaper.position,
    } as CSSProperties}>
      {islandMounted && (shouldShowIsland || islandClosing) && (
      <div className={'dynamic-island' + (voiceListening || assistantBusy || assistantActivityText ? ' island-ai-active' : timer ? ' island-timer-active' : ' island-music-active') + (islandClosing ? ' island-closing' : '')} role="status" aria-live="polite">
        {voiceListening || assistantBusy || assistantActivityText ? (
          <TVButton className="island-main island-assistant-main" data-tv-focus="true" onClick={openAssistant} aria-label="Open assistant conversation">
            <span className="island-orb assistant-orb"><Sparkles size={18} /></span>
            <span className="island-copy"><strong>Assistant</strong><small>{voiceListening ? 'Listening…' : assistantBusy ? 'Thinking…' : assistantActivityText}</small></span>
            {voiceListening ? <span className="island-wave" aria-hidden="true"><i /><i /><i /><i /></span> : <Sparkles className="island-status-icon" size={18} />}
          </TVButton>
        ) : timer ? (
          <TVButton className="island-main island-timer-main" data-tv-focus="true" onClick={() => setTimer(null)} aria-label="Cancel timer">
            <span className="island-orb timer-orb"><Timer size={18} /></span>
            <span className="island-copy"><strong>Timer</strong><small>{timer.label}</small></span>
            <span className="island-countdown">{formatDuration(remainingMs)}</span>
          </TVButton>
        ) : (
          <TVButton className="island-main island-music-main" data-tv-focus="true" onClick={() => navigateToView('selfmusic')} aria-label="Return to SelfMusic player">
            <span className="island-orb music-orb"><Music2 size={18} /></span>
            <span className="island-copy"><strong>SelfMusic</strong><small>{selfMusicNowPlaying || 'Now playing'}</small></span>
            <Play size={16} />
          </TVButton>
        )}

        {timer && (voiceListening || assistantBusy || assistantActivityText) && <span className="island-secondary"><Timer size={14} /><strong>{formatDuration(remainingMs)}</strong></span>}
        {musicActivity && (voiceListening || assistantBusy || assistantActivityText || timer) && (
          <TVButton className="island-activity-button" data-tv-focus="true" onClick={() => navigateToView('selfmusic')} aria-label="Return to SelfMusic player"><Music2 size={15} /></TVButton>
        )}
        {timer && (voiceListening || assistantBusy || assistantActivityText) && <TVButton className="island-dismiss" data-tv-focus="true" onClick={() => setTimer(null)} aria-label="Cancel timer"><X size={14} /></TVButton>}
        {musicActivity && (voiceListening || assistantBusy || assistantActivityText || timer) && <TVButton className="island-dismiss" data-tv-focus="true" onClick={() => setMusicActivity(false)} aria-label="Hide music activity"><X size={14} /></TVButton>}
      </div>
      )}

      <header className="topbar">
        <TVButton focusKey="BRAND-HOME" className="brand" data-tv-focus="true" onClick={() => navigateToView('home')} aria-label="B1O TV — Home">
          <span className="brand-copy"><strong>B1O TV</strong><small>PERSONAL MEDIA</small></span>
        </TVButton>
      </header>

      <main className={'main-content' + (viewMotion ? ' transition-' + viewMotion : '')}>
        {view === 'home' && (
          <>
            <div className="home-stage">
              <section className="hero-section" aria-label="Home screen">
                <div className="home-clock-column">
                  <div className="clock" aria-label={'Time: ' + displayedClock}>{displayedClock}</div>
                  <div className="date-line">{displayedDate}</div>
                </div>

                <TVButton focusKey="WEATHER-FORECAST" className="weather-panel glass-panel" data-tv-focus="true" aria-label="Open seven-day weather forecast" onClick={() => setForecastOpen(true)}>
                  <div className="weather-icon" aria-hidden="true">{weather ? <WeatherIcon code={weather.code} isDay={weather.isDay} /> : <Cloud />}</div>
                  <div className="weather-copy">
                    <strong>{weatherLoading ? '—' : weather ? formatTemperature(weather.temperatureF, settings.temperatureUnit) : '—'}</strong>
                    <span>{weather ? describeWeather(weather.code) : weatherError ? 'Weather unavailable' : 'Loading…'}</span>
                    <small>{weather?.city ?? settings.city} · 7-day forecast <ArrowRight size={13} /></small>
                  </div>
                </TVButton>
              </section>
            </div>


            <section className="section-block featured-section media-catalog" id="media-section">
              <div className="section-heading">
                <div><span className="eyebrow small">YOUR LIBRARY</span><h2>Your Media</h2></div>
                <TVButton className="text-action all-library-link" data-tv-focus="true" onClick={() => navigateToView('apps')}>Browse Apps <ArrowRight size={15} /></TVButton>
              </div>
              <CardGrid focusKey="HOME-FEATURED-GRID" className="featured-grid">
                {FEATURED_APPS.slice(0, 3).map((app, index) => (
                  <FeaturedAppCard key={app.id} app={app} index={index} onLaunch={runApp} />
                ))}
                <AssistantFeaturedCard onOpen={openAssistant} />
              </CardGrid>
            </section>
          </>
        )}

        {view === 'selfmusic' && (
          <section className="page-section selfmusic-page-section">
            <SelfMusicPanel
              baseUrl={settings.selfMusicUrl}
              onServerUrlChange={(value) => updateSetting('selfMusicUrl', value)}
              accessToken={selfMusicAccessToken}
              onAccessTokenChange={setSelfMusicAccessToken}
              onPlaybackChange={handleSelfMusicPlayback}
            />
          </section>
        )}

        {view === 'apps' && (
          <section className="page-section">
            <div className="page-title-row"><div><span className="eyebrow small">YOUR LIBRARY</span><h1>Apps</h1><p>{isTizenRuntime() ? "Featured services and apps detected on this TV." : "Test the built-in services here. Native app discovery and TV app launches are available only on Samsung Tizen."}</p></div><label className="search-box glass-panel"><Search size={18} /><TVInput data-tv-focus="true" aria-label="Search apps" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search apps…" /></label></div>
            <div className="catalog-group"><h2>Featured Services <span>0{filteredApps.featured.length}</span></h2><CardGrid focusKey="APPS-FEATURED-GRID" className="app-catalog-grid">{filteredApps.featured.map((app) => <CatalogAppCard key={app.id} app={app} onLaunch={runApp} />)}</CardGrid></div>
            {isTizenRuntime() && (
              <div className="catalog-group">
                <div className="catalog-group-heading">
                  <h2>Installed on TV <span>{installedApps.length}</span></h2>
                  <TVButton className="secondary-button app-refresh-button" data-tv-focus="true" onClick={() => { void refreshInstalledApps().then(() => notify('TV app list refreshed.')); }}><RefreshCw size={15} /> Refresh TV apps</TVButton>
                </div>
                {installedApps.length
                  ? <CardGrid focusKey="INSTALLED-APPS-GRID" className="installed-list">{filteredApps.discovered.map((app) => <InstalledAppRow key={app.id} app={app} onSelect={launchInstalledApp} />)}</CardGrid>
                  : <div className="empty-state glass-panel"><Info /><strong>App list unavailable</strong><span>Samsung Tizen has not returned an installed-app list. Check the application.info privilege and try refreshing.</span></div>}
              </div>
            )}
          </section>
        )}

        {view === 'library' && (
          <section className="page-section">
            <div className="page-title-row"><div><span className="eyebrow small">YOUR MEDIA</span><h1>Media Library</h1><p>One place for movies, shows, and music. Configure each service below.</p></div><TVButton className="secondary-button" data-tv-focus="true" onClick={() => navigateToView('settings')}><Settings2 size={17} /> Connections</TVButton></div>
            <div className="library-grid">
              <article className="library-card glass-panel"><div className="library-art jellyfin-art"><Film /></div><div className="library-card-copy"><span className="eyebrow small">MOVIES & TV</span><h2>Jellyfin</h2><p>Your home library, playback, and continue watching.</p><TVButton focusKey="LIBRARY-jellyfin" className="primary-button" data-tv-focus="true" onClick={() => void runApp('jellyfin')}><Play size={17} /> Open Jellyfin</TVButton></div></article>
              <article className="library-card glass-panel"><div className="library-art music-art"><Music2 /></div><div className="library-card-copy"><span className="eyebrow small">YOUR MUSIC</span><h2>SelfMusic</h2><p>Your tracks, cover art, favorites, playlists, and playback without leaving B1O TV.</p><TVButton focusKey="LIBRARY-selfmusic" className="primary-button" data-tv-focus="true" onClick={() => void runApp('selfmusic')}><Play size={17} /> Open built-in player</TVButton></div></article>
            </div>
            <div className="note-area glass-panel"><div className="note-area-title"><BookOpen /><div><h2>Assistant Memory</h2><p>Notes are saved locally in this app.</p></div><TVButton className="secondary-button" data-tv-focus="true" onClick={openAssistant}>Ask Assistant</TVButton></div>{notes.length ? <div className="notes-list">{notes.slice(-5).reverse().map((note) => <div className="note-row" key={note.id}><span>{note.text}</span><small>{new Date(note.createdAt).toLocaleDateString('en-US')}</small></div>)}</div> : <div className="empty-notes">Things you ask the assistant to remember will appear here.</div>}</div>
          </section>
        )}

        {view === 'settings' && (
          <section className="page-section settings-page">
            <div className="page-title-row"><div><span className="eyebrow small">PERSONALIZE</span><h1>Settings</h1><p>Appearance, weather, service connections, and app behavior.</p></div><span className="settings-saved"><Check size={15} /> Saved automatically</span></div>
            <section className="wallpaper-library" aria-label="Wallpapers">
              <div className="wallpaper-library-heading">
                <div><span className="eyebrow small">WALLPAPER</span><h2>Wallpapers</h2></div>
                <span>{WALLPAPERS.length} wallpapers</span>
              </div>
              <CardGrid focusKey="SETTINGS-WALLPAPER-GRID" className="wallpaper-grid">
                {WALLPAPERS.map((wallpaper) => (
<WallpaperChoiceCard key={wallpaper.id} wallpaper={wallpaper} isSelected={settings.wallpaper === wallpaper.id} onChoose={chooseWallpaper} />
                ))}
              </CardGrid>
            </section>
            <div className="settings-grid">
              <section className="settings-card glass-panel"><div className="settings-card-head"><Cloud /><div><h2>Weather</h2><p>Choose the location and temperature units shown on Home.</p></div></div><label className="field-label">City<TVInput data-tv-focus="true" value={settings.city} onChange={(event) => updateSetting('city', event.target.value)} placeholder="Los Angeles" /></label><label className="field-label">Temperature units<TVSelect data-tv-focus="true" value={settings.temperatureUnit} onChange={(event) => updateSetting('temperatureUnit', event.target.value === 'C' ? 'C' : 'F')}><option value="F">Fahrenheit (°F)</option><option value="C">Celsius (°C)</option></TVSelect></label><p className="field-help">Current conditions are provided by Open-Meteo. Location access is not requested automatically.</p></section>
              <section className="settings-card glass-panel">
                <div className="settings-card-head"><Sparkles /><div><h2>Appearance</h2><p>Wallpaper and navigation materials, tuned for the TV.</p></div></div>
                <label className="field-label">Liquid Glass intensity <strong>{settings.glassIntensity}%</strong><TVInput data-tv-focus="true" type="range" min="25" max="100" step="5" value={settings.glassIntensity} onChange={(event) => updateSetting('glassIntensity', Number(event.target.value))} /></label>
                <label className="check-row"><span><strong>Reduce motion</strong><small>Disables non-essential animations.</small></span><TVInput data-tv-focus="true" type="checkbox" checked={settings.reduceMotion} onChange={(event) => updateSetting('reduceMotion', event.target.checked)} /></label>
                <label className="check-row"><span><strong>Weather-adaptive scenery</strong><small>Switches between included landscapes based on weather and day/night.</small></span><TVInput data-tv-focus="true" type="checkbox" checked={settings.adaptiveScenery} onChange={(event) => updateSetting('adaptiveScenery', event.target.checked)} /></label>
              </section>
              <section className="settings-card glass-panel"><div className="settings-card-head"><Film /><div><h2>Media Services</h2><p>Your personal media server URLs.</p></div></div><label className="field-label">Jellyfin URL<TVInput data-tv-focus="true" type="url" value={settings.jellyfinUrl} onChange={(event) => updateSetting('jellyfinUrl', event.target.value)} placeholder="http://192.168.1.10:8096" /></label><label className="field-label">SelfMusic URL<TVInput data-tv-focus="true" type="url" value={settings.selfMusicUrl} onChange={(event) => updateSetting('selfMusicUrl', event.target.value)} placeholder="http://192.168.1.10:8787" /></label><p className="field-help">SelfMusic now runs inside B1O TV using its authenticated API. Add the exact origin shown on the built-in SelfMusic screen to SELF_MUSIC_ALLOWED_ORIGINS in the SelfMusic server’s private .env file, then restart that server. The player keeps its signed access token in memory and never saves your password. Use the LAN address for local preview or a private HTTPS/Tailscale URL for remote access.</p><TVButton className="selfmusic-open-button" data-tv-focus="true" onClick={() => { void runApp('selfmusic'); }}><Music2 size={16} /> Open built-in player <ArrowRight size={16} /></TVButton></section>
              <section className="settings-card glass-panel"><div className="settings-card-head"><Mic /><div><h2>AI & Voice</h2><p>Connect your backend endpoint. Keep model API keys on the server.</p></div></div><label className="field-label">AI backend endpoint<TVInput data-tv-focus="true" type="url" value={settings.aiEndpoint} onChange={(event) => updateSetting('aiEndpoint', event.target.value)} placeholder="https://your-worker.example.com/api/assistant" /></label><label className="field-label">Device token<TVInput data-tv-focus="true" type="password" autoComplete="off" value={settings.aiToken} onChange={(event) => updateSetting('aiToken', event.target.value)} placeholder="Your Cloudflare Worker token" /></label><p className="field-help">This is the device access token, not the model API key. It stays in local app storage. The endpoint accepts message/history JSON and returns a reply.</p><label className="check-row"><span><strong>Speak replies aloud</strong><small>Requires Speech Synthesis support in this Tizen browser.</small></span><TVInput data-tv-focus="true" type="checkbox" checked={settings.speakReplies} onChange={(event) => updateSetting('speakReplies', event.target.checked)} /></label><TVButton className="secondary-button test-connection-button" data-tv-focus="true" disabled={aiChecking} onClick={() => { void testAssistantConnection(); }}><Sparkles size={17} /> {aiChecking ? "Checking AI…" : "Check AI Connection"} <ArrowRight size={15} /></TVButton>
                <TVButton className="secondary-button test-voice-button" data-tv-focus="true" onClick={startVoiceAssistant}><Mic size={17} /> Test Voice Assistant <ArrowRight size={15} /></TVButton></section>
            </div>
            <section className="settings-card glass-panel setup-transfer-card"><div className="settings-card-head"><Download /><div><h2>PC → TV Setup</h2><p>Configure everything here, then transfer your setup to the TV.</p></div></div><div className="setup-transfer-actions"><TVButton className="primary-button" data-tv-focus="true" onClick={exportTVSetup}><Download size={17} /> Export TV Setup</TVButton><TVButton className="secondary-button" data-tv-focus="true" onClick={() => setupImportRef.current?.click()}><Upload size={17} /> Import TV Setup</TVButton><input ref={setupImportRef} className="visually-hidden" type="file" accept="application/json,.json" aria-label="Import a B1O TV setup file" onChange={(event) => importTVSetup(event.target.files?.[0])} /></div><p className="field-help">Export creates b1o-tv-setup.json with your city, wallpaper, service URLs, temperature unit, AI endpoint, and device token. On the TV, open Settings → Import TV Setup and choose the same file. Keep it private because it contains your device token.</p></section>
          </section>
        )}
      </main>

      <nav className="floating-dock" aria-label="B1O TV navigation">
        <TVButton focusKey="DOCK-apps" className={'dock-item' + (view === 'apps' ? ' active' : '')} data-tv-focus="true" aria-current={view === 'apps' ? 'page' : undefined} onClick={() => navigateToView('apps')}><Grid2X2 size={19} /><span>Apps</span></TVButton>
        <TVButton focusKey="DOCK-jellyfin" className="dock-item" data-tv-focus="true" onClick={() => void runApp('jellyfin')}><Film size={19} /><span>Jellyfin</span></TVButton>
        <TVButton focusKey="DOCK-selfmusic" className={'dock-item' + (view === 'selfmusic' ? ' active' : '')} data-tv-focus="true" aria-current={view === 'selfmusic' ? 'page' : undefined} onClick={() => navigateToView('selfmusic')}><Music2 size={19} /><span>SelfMusic</span></TVButton>
        <TVButton focusKey="DOCK-settings" className={'dock-item' + (view === 'settings' ? ' active' : '')} data-tv-focus="true" aria-current={view === 'settings' ? 'page' : undefined} onClick={() => navigateToView('settings')}><Settings2 size={19} /><span>Settings</span></TVButton>
        <TVButton focusKey="DOCK-assistant" className="dock-item dock-assistant" data-tv-focus="true" onClick={startVoiceAssistant}><Mic size={19} /><span>Voice / AI</span></TVButton>
      </nav>

      {forecastOpen && (
        <div className="forecast-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setForecastOpen(false); }}>
          <FocusGroup focusKey="FORECAST-DIALOG" focusBoundary className="forecast-panel glass-panel" role="dialog" aria-modal="true" aria-labelledby="forecast-title">
            <header className="forecast-header">
              <div><span className="eyebrow small">WEATHER / WEEK AHEAD</span><h2 id="forecast-title">7-day forecast</h2><p>{weather?.city ?? settings.city}</p></div>
              <TVButton focusKey="FORECAST-CLOSE" className="icon-button" data-tv-focus="true" onClick={() => setForecastOpen(false)} aria-label="Close weather forecast"><X /></TVButton>
            </header>
            {weather?.forecast?.length ? (
              <div className="forecast-days">
                {weather.forecast.map((day, index) => {
                  const date = new Date(day.date + 'T12:00:00');
                  const label = index === 0 ? 'Today' : new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
                  return (
                    <article className="forecast-day" key={day.date}>
                      <span className="forecast-weekday">{label}</span>
                      <span className="forecast-date">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}</span>
                      <span className="forecast-icon"><WeatherIcon code={day.code} isDay /></span>
                      <strong>{formatTemperature(day.highF, settings.temperatureUnit)}</strong>
                      <span className="forecast-low">{formatTemperature(day.lowF, settings.temperatureUnit)}</span>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="forecast-empty"><Cloud /><strong>Forecast unavailable</strong><span>{weatherError || 'Check the connection and reopen the forecast.'}</span></div>
            )}
            <p className="forecast-footnote">Forecast by Open-Meteo · Press Back to close.</p>
          </FocusGroup>
        </div>
      )}

      {assistantOpen && (
        <div className={'assistant-overlay' + (assistantClosing ? ' is-closing' : '')} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAssistant(); }}>
          <FocusGroup focusKey="ASSISTANT-DIALOG" focusBoundary className="assistant-panel glass-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
            <header className="assistant-header"><div className="assistant-avatar"><Sparkles /></div><div><span className="eyebrow small">B1O INTELLIGENCE</span><h2 id="assistant-title">AI Assistant</h2><p>Voice, answers, and device control</p></div><TVButton focusKey="ASSISTANT-CLOSE" className="icon-button" data-tv-focus="true" onClick={closeAssistant} aria-label="Close assistant"><X /></TVButton></header>
            <div className="assistant-capabilities"><span><Check size={13} /> Notes</span><span><Check size={13} /> Timers</span><span><Check size={13} /> Apps</span><span><Info size={13} /> AI backend: {settings.aiEndpoint && settings.aiToken ? 'configured' : 'needs setup'}</span></div>
            <div className="chat-messages" aria-live="polite">
              {messages.slice(-30).map((message) => <div className={'chat-message ' + message.role} key={message.id}><span className="chat-avatar">{message.role === 'assistant' ? <Sparkles size={15} /> : 'You'}</span><p>{message.text}</p></div>)}
              {assistantBusy && <div className="chat-message assistant"><span className="chat-avatar"><Sparkles size={15} /></span><p className="typing-indicator"><i /><i /><i /></p></div>}
            </div>
            <div className="assistant-input-area"><TVButton className={'voice-button' + (voiceListening ? ' listening' : '')} data-tv-focus="true" onClick={startVoiceAssistant} aria-label="Start voice input">{voiceListening ? <LoaderCircle className="spin" /> : <Mic />}</TVButton><form className="assistant-form" onSubmit={(event) => { event.preventDefault(); void submitAssistant(); }}><TVInput data-tv-focus="true" data-assistant-input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask anything…" aria-label="Message the assistant" /><TVButton data-tv-focus="true" disabled={!draft.trim() || assistantBusy} aria-label="Send message"><ArrowRight /></TVButton></form></div>
            <div className="assistant-footnote"><Volume2 size={13} /> TV voice: Samsung Voice Interaction handles commands. Dictation tries microphone recording plus cloud transcription when the TV firmware exposes audio capture; the Device token must be configured in Settings.</div>
          </FocusGroup>
        </div>
      )}

      {toast && <div className="toast-message" role="status"><Check size={17} /><span>{toast}</span><TVButton onClick={() => setToast('')} aria-label="Dismiss notification"><X size={14} /></TVButton></div>}
    </div>
    </FocusContext.Provider>
  );
}

export default App;