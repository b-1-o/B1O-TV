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
import { createAssistantMessage, askConfiguredAssistant, formatDuration, parseLocalIntent, readSavedNotes, saveNote } from './services/assistant';
import { describeWeather, fetchWeather } from './services/weather';
import { getInstalledApps, isTizenRuntime, launchInstalledAppById, launchTVService, registerSpatialRemoteKeys, registerVoiceRemoteKey } from './platform/tizen';
import { CardGrid, FocusGroup } from './components/tv/CardGrid';
import { TVButton, TVInput, TVSelect } from './components/tv/FocusableControls';
import { useTheme } from './contexts/ThemeContext';
import { AssistantFeaturedCard, CatalogAppCard, FeaturedAppCard, InstalledAppRow, WallpaperChoiceCard } from './components/tv/MemoizedCards';

const LOGO_SRC = new URL('../assets/logo.jpg', import.meta.url).href;

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

const DEFAULT_SETTINGS: TVSettings = {
  city: 'Los Angeles',
  reduceMotion: false,
  glassIntensity: 70,
  aiEndpoint: 'https://b1o-tv-assistant.collab-docs-b1o.workers.dev',
  aiToken: '',
  jellyfinUrl: '',
  selfMusicUrl: '',
  speakReplies: false,
  wallpaper: 'main',
  temperatureUnit: 'F',
};

const FEATURED_APPS: TVApp[] = [
  { id: 'youtube', name: 'YouTube', subtitle: 'TV video client', category: 'Video', symbol: 'YT', target: 'youtube' },
  { id: 'jellyfin', name: 'Jellyfin', subtitle: 'Your home media library', category: 'Movies & TV', symbol: 'JF', target: 'jellyfin' },
  { id: 'selfmusic', name: 'SelfMusic', subtitle: 'Your music, your way', category: 'Music', symbol: 'SM', target: 'selfmusic' },
  { id: 'browser', name: 'Browser', subtitle: 'Websites and web apps', category: 'Tools', symbol: 'WWW', target: 'browser' },
];

function readSettings(): TVSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;
    const settings = { ...DEFAULT_SETTINGS, ...(parsed as Partial<TVSettings>) };
    if (typeof settings.aiEndpoint !== 'string' || !settings.aiEndpoint.trim()) {
      settings.aiEndpoint = DEFAULT_SETTINGS.aiEndpoint;
    }
    if (!WALLPAPERS.some((wallpaper) => wallpaper.id === settings.wallpaper)) {
      settings.wallpaper = DEFAULT_SETTINGS.wallpaper;
    }
    if (settings.temperatureUnit !== 'F' && settings.temperatureUnit !== 'C') {
      settings.temperatureUnit = DEFAULT_SETTINGS.temperatureUnit;
    }
    return settings;
  } catch {
    return DEFAULT_SETTINGS;
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

function WeatherIcon({ code, isDay }: { code: number; isDay: boolean }) {
  if (code === 0) return isDay ? <Sun /> : <Moon />;
  if (code === 45 || code === 48) return <CloudFog />;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return <CloudRain />;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow />;
  return <Cloud />;
}

function App() {
  const { mode, toggleTheme } = useTheme();
  const { ref: spatialRootRef, focusKey: spatialRootFocusKey } = useFocusable({
    focusKey: 'B1O-TV-ROOT',
    trackChildren: true,
    autoRestoreFocus: true,
  });
  const [view, setView] = useState<View>('home');
  const [compactHome, setCompactHome] = useState(false);
  const [musicActivity, setMusicActivity] = useState(false);
  const [settings, setSettings] = useState<TVSettings>(readSettings);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
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
  const setupImportRef = useRef<HTMLInputElement | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantClosing, setAssistantClosing] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
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

  const navigateToView = useCallback((nextView: View) => {
    if (nextView === view) return;
    if (viewExitTimer.current !== undefined) window.clearTimeout(viewExitTimer.current);
    if (viewEnterTimer.current !== undefined) window.clearTimeout(viewEnterTimer.current);
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

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    let active = true;
    void getInstalledApps().then((apps) => {
      if (active) setInstalledApps(apps);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => registerSpatialRemoteKeys(), []);

  useEffect(() => registerVoiceRemoteKey(() => {
    setAssistantOpen(false);
    setAssistantClosing(false);
    window.setTimeout(() => voiceStartRef.current(), 180);
  }), []);

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

      const micKey = event.key === 'Microphone' || event.key === 'AudioInputMicrophone';
      if (micKey) {
        event.preventDefault();
        setAssistantOpen(false);
        setAssistantClosing(false);
        window.setTimeout(() => voiceStartRef.current(), 180);
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
  }, [assistantOpen, view, closeAssistant, navigateToView]);

  const preferredFocusKey = view === 'home'
    ? 'CARD-youtube'
    : view === 'apps'
      ? 'CATALOG-youtube'
      : view === 'library'
        ? 'LIBRARY-jellyfin'
        : 'WALLPAPER-main';

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      if (doesFocusableExist(preferredFocusKey)) {
        setFocus(preferredFocusKey);
      } else {
        setFocus(view === 'settings' ? 'DOCK-settings' : view === 'apps' ? 'DOCK-apps' : 'BRAND-HOME');
      }
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [view, preferredFocusKey]);

  useEffect(() => {
    if (!assistantOpen) return;
    const focusTimer = window.setTimeout(() => {
      if (doesFocusableExist('ASSISTANT-CLOSE')) setFocus('ASSISTANT-CLOSE');
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [assistantOpen]);

  const updateSetting = <K extends keyof TVSettings>(key: K, value: TVSettings[K]) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  };

  const openAssistant = useCallback(() => {
    setAssistantClosing(false);
    setAssistantOpen(true);
    window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-assistant-input]')?.focus(), 60);
  }, []);

  const startVoiceAssistant = () => {
    if (assistantCloseTimer.current !== undefined) window.clearTimeout(assistantCloseTimer.current);
    const closeDelay = assistantOpen ? 300 : 160;
    if (assistantOpen) {
      closeAssistant();
    } else {
      setAssistantOpen(false);
      setAssistantClosing(false);
    }
    setAssistantActivityText('');
    if (assistantActivityTimer.current !== undefined) window.clearTimeout(assistantActivityTimer.current);
    window.setTimeout(() => voiceStartRef.current(), closeDelay);
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
        const imported = { ...DEFAULT_SETTINGS, ...(payload.settings as Partial<TVSettings>) };
        if (!WALLPAPERS.some((wallpaper) => wallpaper.id === imported.wallpaper)) imported.wallpaper = DEFAULT_SETTINGS.wallpaper;
        if (imported.temperatureUnit !== 'C' && imported.temperatureUnit !== 'F') imported.temperatureUnit = 'F';
        if (typeof imported.aiEndpoint !== 'string' || !imported.aiEndpoint.trim()) imported.aiEndpoint = DEFAULT_SETTINGS.aiEndpoint;
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

  const runApp = useCallback(async (target: AppTarget): Promise<{ ok: boolean; message: string }> => {
    if (target === 'assistant') {
      openAssistant();
      return { ok: true, message: 'Assistant opened.' };
    }

    if (target === 'selfmusic') {
      setMusicActivity(true);
    }

    const result = await launchTVService(target, installedApps, {
      jellyfinUrl: settings.jellyfinUrl,
      selfMusicUrl: settings.selfMusicUrl,
    });

    if (target === 'selfmusic' && !result.ok) {
      setMusicActivity(false);
    }
    notify(result.message);
    return result;
  }, [installedApps, notify, openAssistant, settings.jellyfinUrl, settings.selfMusicUrl]);

  const launchInstalledApp = useCallback((appId: string) => {
    void launchInstalledAppById(appId, installedApps).then((result) => notify(result.message));
  }, [installedApps, notify]);

  const chooseWallpaper = useCallback((wallpaperId: string) => {
    setSettings((previous) => ({ ...previous, wallpaper: wallpaperId }));
  }, []);

  const submitAssistant = async (rawText?: string) => {
    const text = (rawText ?? draft).trim();
    if (!text || assistantBusy) return;
    setDraft('');
    setMessages((previous) => [...previous, createAssistantMessage('user', text)].slice(-60));
    setAssistantBusy(true);

    let reply = '';
    try {
      const intent = parseLocalIntent(text);
      if (intent?.kind === 'remember') {
        const note = saveNote(intent.note);
        setNotesVersion((value) => value + 1);
        reply = 'Запомнил в заметках этого приложения: «' + note.text + '».';
      } else if (intent?.kind === 'recall') {
        const notes = readSavedNotes();
        reply = notes.length
          ? 'Вот что сохранено в заметках:\n' + notes.slice(-8).map((note, index) => (index + 1) + '. ' + note.text).join('\n')
          : 'Пока нет сохранённых заметок. Скажи, например: «Запомни, что…».';
      } else if (intent?.kind === 'timer') {
        const nextTimer = { endAt: Date.now() + intent.durationMs, label: formatDuration(intent.durationMs) };
        setTimer(nextTimer);
        reply = 'Таймер запущен на ' + nextTimer.label + '. Пока B1O TV закрыт или выгружен системой, звук/системное уведомление не гарантируются.';
      } else if (intent?.kind === 'time') {
        reply = 'Time: ' + new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date()) + '.';
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

  const startVoiceInput = () => {
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
      showAssistantActivity('Voice input is not supported here');
      notify('Voice input is not supported in this browser. On TV, check microphone permissions and firmware support.');
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
        showAssistantActivity('Microphone unavailable');
        notify('Microphone unavailable or speech could not be recognized.');
      };
      recognition.onend = () => setVoiceListening(false);
      setAssistantActivityText('');
      if (assistantActivityTimer.current !== undefined) window.clearTimeout(assistantActivityTimer.current);
      setVoiceListening(true);
      recognition.start();
    } catch {
      setVoiceListening(false);
      showAssistantActivity('Microphone unavailable');
      notify('Could not start speech recognition in this environment.');
    }
  };

  voiceStartRef.current = startVoiceInput;

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
  const activeWallpaper = WALLPAPERS.find((wallpaper) => wallpaper.id === settings.wallpaper) ?? WALLPAPERS[0];
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
          <TVButton className="island-main island-music-main" data-tv-focus="true" onClick={() => void runApp('selfmusic')} aria-label="Return to SelfMusic">
            <span className="island-orb music-orb"><Music2 size={18} /></span>
            <span className="island-copy"><strong>SelfMusic</strong><small>Now active</small></span>
            <Play size={16} />
          </TVButton>
        )}

        {timer && (voiceListening || assistantBusy || assistantActivityText) && <span className="island-secondary"><Timer size={14} /><strong>{formatDuration(remainingMs)}</strong></span>}
        {musicActivity && (voiceListening || assistantBusy || assistantActivityText || timer) && (
          <TVButton className="island-activity-button" data-tv-focus="true" onClick={() => void runApp('selfmusic')} aria-label="Return to SelfMusic"><Music2 size={15} /></TVButton>
        )}
        {timer && (voiceListening || assistantBusy || assistantActivityText) && <TVButton className="island-dismiss" data-tv-focus="true" onClick={() => setTimer(null)} aria-label="Cancel timer"><X size={14} /></TVButton>}
        {musicActivity && (voiceListening || assistantBusy || assistantActivityText || timer) && <TVButton className="island-dismiss" data-tv-focus="true" onClick={() => setMusicActivity(false)} aria-label="Hide music activity"><X size={14} /></TVButton>}
      </div>
      )}

      <header className="topbar">
        <TVButton focusKey="BRAND-HOME" className="brand" data-tv-focus="true" onClick={() => navigateToView('home')} aria-label="B1O TV — Home">
          <img className="brand-logo" src={LOGO_SRC} alt="" draggable={false} />
          <span className="brand-copy"><strong>B1O TV</strong></span>
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

                <aside className="weather-panel" aria-label="Weather">
                  <div className="weather-icon" aria-hidden="true">{weather ? <WeatherIcon code={weather.code} isDay={weather.isDay} /> : <Cloud />}</div>
                  <div className="weather-copy">
                    <strong>{weatherLoading ? '—' : weather ? Math.round(settings.temperatureUnit === 'C' ? (weather.temperatureF - 32) * 5 / 9 : weather.temperatureF) + '°' + settings.temperatureUnit : '—'}</strong>
                    <span>{weather ? describeWeather(weather.code) : weatherError ? 'Weather unavailable' : 'Loading…'}</span>
                    <small>{weather?.city ?? settings.city}</small>
                  </div>
                </aside>
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

        {view === 'apps' && (
          <section className="page-section">
            <div className="page-title-row"><div><span className="eyebrow small">YOUR LIBRARY</span><h1>Apps</h1><p>Featured apps and apps detected on this TV.</p></div><label className="search-box glass-panel"><Search size={18} /><TVInput data-tv-focus="true" aria-label="Search apps" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search apps…" /></label></div>
            <div className="catalog-group"><h2>Featured Services <span>0{filteredApps.featured.length}</span></h2><CardGrid focusKey="APPS-FEATURED-GRID" className="app-catalog-grid">{filteredApps.featured.map((app) => <CatalogAppCard key={app.id} app={app} onLaunch={runApp} />)}</CardGrid></div>
            <div className="catalog-group"><h2>Installed on TV <span>{installedApps.length}</span></h2>{installedApps.length ? <CardGrid focusKey="INSTALLED-APPS-GRID" className="installed-list">{filteredApps.discovered.map((app) => <InstalledAppRow key={app.id} app={app} onSelect={launchInstalledApp} />)}</CardGrid> : <div className="empty-state glass-panel"><Info /><strong>{isTizenRuntime() ? 'App list unavailable' : 'Your TV app list will appear here'}</strong><span>This browser preview cannot read installed apps. On Samsung TV, the list depends on Tizen Web API permissions.</span></div>}</div>
          </section>
        )}

        {view === 'library' && (
          <section className="page-section">
            <div className="page-title-row"><div><span className="eyebrow small">YOUR MEDIA</span><h1>Media Library</h1><p>One place for movies, shows, and music. Configure each service below.</p></div><TVButton className="secondary-button" data-tv-focus="true" onClick={() => navigateToView('settings')}><Settings2 size={17} /> Connections</TVButton></div>
            <div className="library-grid">
              <article className="library-card glass-panel"><div className="library-art jellyfin-art"><Film /></div><div className="library-card-copy"><span className="eyebrow small">MOVIES & TV</span><h2>Jellyfin</h2><p>Your home library, playback, and continue watching.</p><TVButton focusKey="LIBRARY-jellyfin" className="primary-button" data-tv-focus="true" onClick={() => void runApp('jellyfin')}><Play size={17} /> Open Jellyfin</TVButton></div></article>
              <article className="library-card glass-panel"><div className="library-art music-art"><Music2 /></div><div className="library-card-copy"><span className="eyebrow small">YOUR MUSIC</span><h2>SelfMusic</h2><p>Your tracks, cover art, favorites, and playlists on your own server.</p><TVButton focusKey="LIBRARY-selfmusic" className="primary-button" data-tv-focus="true" onClick={() => void runApp('selfmusic')}><Play size={17} /> Open SelfMusic</TVButton></div></article>
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
              <section className="settings-card glass-panel"><div className="settings-card-head"><Sparkles /><div><h2>Appearance</h2><p>Theme, wallpaper, and floating navigation material.</p></div></div><div className="theme-setting-row"><span><strong>Color theme</strong><small>Saved automatically and restored on launch.</small></span><TVButton className="secondary-button theme-toggle-button" data-tv-focus="true" aria-label={'Switch to ' + (mode === 'dark' ? 'light' : 'dark') + ' theme'} onClick={toggleTheme}>{mode === 'dark' ? <Moon size={17} /> : <Sun size={17} />} {mode === 'dark' ? 'Dark theme' : 'Light theme'}</TVButton></div><label className="field-label">Liquid Glass intensity <strong>{settings.glassIntensity}%</strong><TVInput data-tv-focus="true" type="range" min="25" max="100" step="5" value={settings.glassIntensity} onChange={(event) => updateSetting('glassIntensity', Number(event.target.value))} /></label><label className="check-row"><span><strong>Reduce motion</strong><small>Disables non-essential animations.</small></span><TVInput data-tv-focus="true" type="checkbox" checked={settings.reduceMotion} onChange={(event) => updateSetting('reduceMotion', event.target.checked)} /></label></section>
              <section className="settings-card glass-panel"><div className="settings-card-head"><Film /><div><h2>Media Services</h2><p>Your personal media server URLs.</p></div></div><label className="field-label">Jellyfin URL<TVInput data-tv-focus="true" type="url" value={settings.jellyfinUrl} onChange={(event) => updateSetting('jellyfinUrl', event.target.value)} placeholder="https://jellyfin.example.com" /></label><label className="field-label">SelfMusic URL<TVInput data-tv-focus="true" type="url" value={settings.selfMusicUrl} onChange={(event) => updateSetting('selfMusicUrl', event.target.value)} placeholder="https://music.example.com" /></label><p className="field-help">Links are saved locally. Each server must permit access from the TV browser.</p></section>
              <section className="settings-card glass-panel"><div className="settings-card-head"><Mic /><div><h2>AI & Voice</h2><p>Connect your backend endpoint. Keep model API keys on the server.</p></div></div><label className="field-label">AI backend endpoint<TVInput data-tv-focus="true" type="url" value={settings.aiEndpoint} onChange={(event) => updateSetting('aiEndpoint', event.target.value)} placeholder="https://your-worker.example.com/api/assistant" /></label><label className="field-label">Device token<TVInput data-tv-focus="true" type="password" autoComplete="off" value={settings.aiToken} onChange={(event) => updateSetting('aiToken', event.target.value)} placeholder="Your Cloudflare Worker token" /></label><p className="field-help">This is the device access token, not the model API key. It stays in local app storage. The endpoint accepts message/history JSON and returns a reply.</p><label className="check-row"><span><strong>Speak replies aloud</strong><small>Requires Speech Synthesis support in this Tizen browser.</small></span><TVInput data-tv-focus="true" type="checkbox" checked={settings.speakReplies} onChange={(event) => updateSetting('speakReplies', event.target.checked)} /></label><TVButton className="secondary-button test-voice-button" data-tv-focus="true" onClick={startVoiceAssistant}><Mic size={17} /> Test Voice Assistant <ArrowRight size={15} /></TVButton></section>
            </div>
            <section className="settings-card glass-panel setup-transfer-card"><div className="settings-card-head"><Download /><div><h2>PC → TV Setup</h2><p>Configure everything here, then transfer your setup to the TV.</p></div></div><div className="setup-transfer-actions"><TVButton className="primary-button" data-tv-focus="true" onClick={exportTVSetup}><Download size={17} /> Export TV Setup</TVButton><TVButton className="secondary-button" data-tv-focus="true" onClick={() => setupImportRef.current?.click()}><Upload size={17} /> Import TV Setup</TVButton><input ref={setupImportRef} className="visually-hidden" type="file" accept="application/json,.json" aria-label="Import a B1O TV setup file" onChange={(event) => importTVSetup(event.target.files?.[0])} /></div><p className="field-help">Export creates b1o-tv-setup.json with your city, wallpaper, service URLs, temperature unit, AI endpoint, and device token. On the TV, open Settings → Import TV Setup and choose the same file. Keep it private because it contains your device token.</p></section>
          </section>
        )}
      </main>

      <nav className="floating-dock" aria-label="B1O TV navigation">
        <TVButton focusKey="DOCK-apps" className={'dock-item' + (view === 'apps' ? ' active' : '')} data-tv-focus="true" aria-current={view === 'apps' ? 'page' : undefined} onClick={() => navigateToView('apps')}><Grid2X2 size={19} /><span>Apps</span></TVButton>
        <TVButton focusKey="DOCK-jellyfin" className="dock-item" data-tv-focus="true" onClick={() => void runApp('jellyfin')}><Film size={19} /><span>Jellyfin</span></TVButton>
        <TVButton focusKey="DOCK-selfmusic" className="dock-item" data-tv-focus="true" onClick={() => void runApp('selfmusic')}><Music2 size={19} /><span>SelfMusic</span></TVButton>
        <TVButton focusKey="DOCK-settings" className={'dock-item' + (view === 'settings' ? ' active' : '')} data-tv-focus="true" aria-current={view === 'settings' ? 'page' : undefined} onClick={() => navigateToView('settings')}><Settings2 size={19} /><span>Settings</span></TVButton>
        <TVButton focusKey="DOCK-assistant" className="dock-item dock-assistant" data-tv-focus="true" onClick={startVoiceAssistant}><Mic size={19} /><span>Assistant</span></TVButton>
      </nav>

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
            <div className="assistant-footnote"><Volume2 size={13} /> Press Alt + V to open the chat in the browser preview. The physical microphone button depends on TV firmware and API support.</div>
          </FocusGroup>
        </div>
      )}

      {toast && <div className="toast-message" role="status"><Check size={17} /><span>{toast}</span><TVButton onClick={() => setToast('')} aria-label="Dismiss notification"><X size={14} /></TVButton></div>}
    </div>
    </FocusContext.Provider>
  );
}

export default App;