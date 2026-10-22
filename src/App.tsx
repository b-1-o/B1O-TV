import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  Check,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSnow,
  Film,
  Grid2X2,
  Home,
  Info,
  Library,
  LoaderCircle,
  Mic,
  Moon,
  Music2,
  Play,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  Volume2,
  Wifi,
  X,
} from 'lucide-react';
import type { ActiveTimer, AppTarget, AssistantMessage, InstalledTVApp, TVApp, TVSettings, View, WeatherSnapshot } from './types';
import { createAssistantMessage, askConfiguredAssistant, formatDuration, parseLocalIntent, readSavedNotes, saveNote } from './services/assistant';
import { describeWeather, fetchWeather } from './services/weather';
import { getInstalledApps, isTizenRuntime, launchInstalledAppById, launchTVService, registerVoiceRemoteKey } from './platform/tizen';

const SETTINGS_KEY = 'b1o-tv:settings';
const TIMER_KEY = 'b1o-tv:timer';

const DEFAULT_SETTINGS: TVSettings = {
  city: 'Los Angeles',
  reduceMotion: false,
  glassIntensity: 70,
  aiEndpoint: '',
  jellyfinUrl: '',
  selfMusicUrl: '',
  speakReplies: false,
};

const FEATURED_APPS: TVApp[] = [
  { id: 'youtube', name: 'YouTube', subtitle: 'Видео без лишнего шума', category: 'Видео', symbol: 'YT', target: 'youtube' },
  { id: 'jellyfin', name: 'Jellyfin', subtitle: 'Твоя домашняя библиотека', category: 'Кино и сериалы', symbol: 'JF', target: 'jellyfin' },
  { id: 'selfmusic', name: 'SelfMusic', subtitle: 'Музыка на твоих условиях', category: 'Музыка', symbol: 'SM', target: 'selfmusic' },
  { id: 'browser', name: 'Браузер', subtitle: 'Интернет и веб-приложения', category: 'Инструменты', symbol: 'WWW', target: 'browser' },
];

const VIEW_LABELS: Record<View, string> = {
  home: 'Главная',
  apps: 'Приложения',
  library: 'Медиатека',
  settings: 'Настройки',
};

function readSettings(): TVSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(parsed as Partial<TVSettings>) };
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

function greeting(hour: number): string {
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function WeatherIcon({ code, isDay }: { code: number; isDay: boolean }) {
  if (code === 0) return isDay ? <Sun /> : <Moon />;
  if (code === 45 || code === 48) return <CloudFog />;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return <CloudRain />;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow />;
  return <Cloud />;
}

function AppSymbol({ app }: { app: TVApp }) {
  const className = 'app-symbol app-symbol-' + app.id;
  return (
    <span className={className} aria-hidden="true">
      {app.id === 'jellyfin' ? <Film /> : app.id === 'selfmusic' ? <Music2 /> : app.id === 'browser' ? <Grid2X2 /> : <Play />}
    </span>
  );
}

function App() {
  const [view, setView] = useState<View>('home');
  const [settings, setSettings] = useState<TVSettings>(readSettings);
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherError, setWeatherError] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [installedApps, setInstalledApps] = useState<InstalledTVApp[]>([]);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([
    createAssistantMessage('assistant', 'Я B1O Assistant. Могу отвечать на вопросы через подключённый AI backend, сохранять заметки, ставить таймеры и открывать установленные приложения.'),
  ]);
  const [timer, setTimer] = useState<ActiveTimer | null>(readTimer);
  const [remainingMs, setRemainingMs] = useState(0);
  const [notesVersion, setNotesVersion] = useState(0);
  const voiceStartRef = useRef<() => void>(() => undefined);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== undefined) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3_000);
  }, []);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(clock);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      notify('Хранилище настроек недоступно в этом режиме.');
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
        setWeatherError(error instanceof Error ? error.message : 'Погода недоступна.');
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

  useEffect(() => registerVoiceRemoteKey(() => {
    setAssistantOpen(true);
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
        notify('Таймер завершён: ' + timer.label);
      } else {
        setRemainingMs(next);
      }
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [timer, notify]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTyping = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
      if (event.key === 'Escape' || event.key === 'Backspace') {
        if (assistantOpen) {
          event.preventDefault();
          setAssistantOpen(false);
          return;
        }
        if (view !== 'home') {
          event.preventDefault();
          setView('home');
          return;
        }
      }

      const micKey = event.key === 'Microphone' || event.key === 'AudioInputMicrophone';
      if (micKey) {
        event.preventDefault();
        setAssistantOpen(true);
        window.setTimeout(() => voiceStartRef.current(), 180);
        return;
      }
      if (event.altKey && event.key.toLocaleLowerCase() === 'v' && !isTyping) {
        event.preventDefault();
        setAssistantOpen(true);
        return;
      }

      if (isTyping || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const direction = event.key.replace('Arrow', '').toLocaleLowerCase();
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[data-tv-focus="true"]:not(:disabled)'))
        .filter((button) => button.getAttribute('aria-hidden') !== 'true')
        .filter((button) => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && getComputedStyle(button).visibility !== 'hidden';
        });
      if (!buttons.length) return;
      const current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
      if (!current || !buttons.includes(current)) {
        buttons[0]?.focus();
        event.preventDefault();
        return;
      }
      const from = current.getBoundingClientRect();
      const originX = from.left + from.width / 2;
      const originY = from.top + from.height / 2;
      let best: { element: HTMLButtonElement; score: number } | null = null;
      for (const candidate of buttons) {
        if (candidate === current) continue;
        const rect = candidate.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - originX;
        const dy = rect.top + rect.height / 2 - originY;
        const primary = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
        if (primary <= 1) continue;
        const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
        const score = primary + secondary * 1.7;
        if (!best || score < best.score) best = { element: candidate, score };
      }
      if (best) {
        best.element.focus();
        event.preventDefault();
      } else if (direction === 'down' || direction === 'up') {
        window.scrollBy({ top: direction === 'down' ? Math.max(300, window.innerHeight * 0.65) : -Math.max(300, window.innerHeight * 0.65), behavior: settings.reduceMotion ? 'auto' : 'smooth' });
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [assistantOpen, view, settings.reduceMotion]);

  const updateSetting = <K extends keyof TVSettings>(key: K, value: TVSettings[K]) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  };

  const openAssistant = () => {
    setAssistantOpen(true);
    window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-assistant-input]')?.focus(), 60);
  };

  const runApp = async (target: AppTarget) => {
    if (target === 'assistant') {
      openAssistant();
      return;
    }
    const result = await launchTVService(target, installedApps, {
      jellyfinUrl: settings.jellyfinUrl,
      selfMusicUrl: settings.selfMusicUrl,
    });
    notify(result.message);
  };

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
        reply = 'Сейчас ' + new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date()) + '.';
      } else if (intent?.kind === 'launch') {
        const result = await launchTVService(intent.target, installedApps, {
          jellyfinUrl: settings.jellyfinUrl,
          selfMusicUrl: settings.selfMusicUrl,
        });
        reply = result.message;
      } else {
        reply = await askConfiguredAssistant(settings.aiEndpoint, text);
      }
    } catch (error) {
      reply = error instanceof Error ? error.message : 'Не получилось выполнить команду. Попробуй ещё раз.';
    }

    setMessages((previous) => [...previous, createAssistantMessage('assistant', reply)].slice(-60));
    setAssistantBusy(false);
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
      notify('Голосовой ввод браузером не поддерживается. Проверь TV Voice Control API на устройстве.');
      return;
    }
    try {
      const recognition = new Constructor();
      recognition.lang = 'ru-RU';
      recognition.interimResults = false;
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) void submitAssistant(transcript);
      };
      recognition.onerror = () => {
        setVoiceListening(false);
        notify('Микрофон недоступен или речь не распознана.');
      };
      recognition.onend = () => setVoiceListening(false);
      setVoiceListening(true);
      recognition.start();
    } catch {
      setVoiceListening(false);
      notify('Не удалось запустить распознавание речи в этой среде.');
    }
  };

  voiceStartRef.current = startVoiceInput;

  const filteredApps = useMemo(() => {
    const value = search.trim().toLocaleLowerCase('ru-RU');
    const featured = FEATURED_APPS.filter((app) => !value || [app.name, app.subtitle, app.category].some((field) => field.toLocaleLowerCase('ru-RU').includes(value)));
    const discovered = installedApps.filter((app) => !value || app.name.toLocaleLowerCase('ru-RU').includes(value));
    return { featured, discovered };
  }, [search, installedApps]);

  const notes = useMemo(() => {
    void notesVersion;
    return readSavedNotes();
  }, [notesVersion]);

  const shellClass = 'app-shell' + (settings.reduceMotion ? ' reduce-motion' : '');
  const displayedClock = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(now);
  const displayedDate = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);

  return (
    <div className={shellClass} style={{ '--glass-intensity': settings.glassIntensity / 100 } as CSSProperties}>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="ambient ambient-three" aria-hidden="true" />

      <header className="topbar">
        <button className="brand" data-tv-focus="true" onClick={() => setView('home')} aria-label="B1O TV — главная">
          <span className="brand-mark">b1o</span>
          <span className="brand-copy"><strong>B1O</strong><small>AMBIENT MEDIA</small></span>
        </button>
        <nav className="main-nav" aria-label="Основная навигация">
          <button className={'nav-item' + (view === 'home' ? ' active' : '')} data-tv-focus="true" onClick={() => setView('home')}><Home size={17} /> Главная</button>
          <button className={'nav-item' + (view === 'apps' ? ' active' : '')} data-tv-focus="true" onClick={() => setView('apps')}><Grid2X2 size={17} /> Приложения</button>
          <button className={'nav-item' + (view === 'library' ? ' active' : '')} data-tv-focus="true" onClick={() => setView('library')}><Library size={17} /> Медиатека</button>
        </nav>
        <div className="top-actions">
          <span className={'runtime-pill' + (isTizenRuntime() ? ' connected' : '')} title={isTizenRuntime() ? 'Tizen Web API обнаружен' : 'Работает в режиме веб-прототипа'}>
            <span className="status-dot" />{isTizenRuntime() ? 'TIZEN' : 'PREVIEW'}
          </span>
          <button className="icon-button assistant-shortcut" data-tv-focus="true" onClick={openAssistant} aria-label="Открыть голосового ассистента"><Mic size={19} /></button>
          <button className="icon-button" data-tv-focus="true" onClick={() => setView('settings')} aria-label="Настройки"><Settings2 size={19} /></button>
        </div>
      </header>

      <main className="main-content">
        {view === 'home' && (
          <>
            <section className="hero-section">
              <div className="hero-copy">
                <div className="eyebrow"><span className="eyebrow-line" /> ТВОЁ ПРОСТРАНСТВО</div>
                <h1>{greeting(now.getHours())}<br /><span>Добро пожаловать домой.</span></h1>
                <p className="hero-description">Фильмы, музыка и идеи — в одной спокойной среде.</p>
                <div className="hero-actions">
                  <button className="primary-button" data-tv-focus="true" onClick={() => setView('apps')}><Grid2X2 size={18} /> Открыть приложения <ArrowRight size={16} /></button>
                  <button className="secondary-button" data-tv-focus="true" onClick={openAssistant}><Mic size={17} /> Поговорить с AI</button>
                </div>
              </div>

              <div className="atmosphere-panel glass-panel">
                <div className="panel-topline"><span>СЕЙЧАС</span><span className="live-indicator"><i /> LIVE</span></div>
                <div className="clock">{displayedClock}</div>
                <div className="date-line">{displayedDate}</div>
                <div className="panel-divider" />
                <div className="weather-row">
                  <div className="weather-icon">{weather ? <WeatherIcon code={weather.code} isDay={weather.isDay} /> : <Cloud />}</div>
                  <div className="weather-copy">
                    <strong>{weatherLoading ? 'Загружаю погоду…' : weather ? Math.round(weather.temperatureF) + '°F' : '—'}</strong>
                    <span>{weather ? describeWeather(weather.code) : weatherError || 'Погода недоступна'}</span>
                    <small>{weather?.city ?? settings.city}</small>
                  </div>
                  <button className="small-icon-button" data-tv-focus="true" onClick={() => setView('settings')} aria-label="Настроить погоду"><Settings2 size={16} /></button>
                </div>
                {timer && <div className="timer-chip"><Timer size={16} /><span>{timer.label}</span><strong>{formatDuration(remainingMs)}</strong><button onClick={() => setTimer(null)} aria-label="Отменить таймер"><X size={14} /></button></div>}
                {weatherError && <button className="text-action" data-tv-focus="true" onClick={() => setView('settings')}>Проверить город в настройках <ArrowRight size={14} /></button>}
              </div>
            </section>

            <section className="section-block featured-section">
              <div className="section-heading">
                <div><span className="eyebrow small">БЫСТРЫЙ ДОСТУП</span><h2>Твоё медиа</h2></div>
                <button className="text-action" data-tv-focus="true" onClick={() => setView('apps')}>Вся библиотека <ArrowRight size={15} /></button>
              </div>
              <div className="featured-grid">
                {FEATURED_APPS.slice(0, 3).map((app, index) => (
                  <button className={'featured-card glass-panel card-' + app.id} data-tv-focus="true" key={app.id} onClick={() => void runApp(app.target)}>
                    <div className="card-cardinal"><span>0{index + 1}</span><ArrowRight size={16} /></div>
                    <AppSymbol app={app} />
                    <div className="featured-card-text"><strong>{app.name}</strong><span>{app.subtitle}</span></div>
                  </button>
                ))}
                <button className="featured-card assistant-card glass-panel" data-tv-focus="true" onClick={openAssistant}>
                  <div className="card-cardinal"><span>04</span><Sparkles size={16} /></div>
                  <span className="app-symbol app-symbol-assistant"><Sparkles /></span>
                  <div className="featured-card-text"><strong>AI Assistant</strong><span>Ответы, таймеры и команды</span></div>
                </button>
              </div>
            </section>

            <section className="section-block utilities-section">
              <div className="section-heading">
                <div><span className="eyebrow small">МАЛЕНЬКИЕ ПОМОЩНИКИ</span><h2>Всё под рукой</h2></div>
              </div>
              <div className="utility-grid">
                <button className="utility-card glass-panel" data-tv-focus="true" onClick={() => setView('library')}><BookOpen /><span><strong>Медиатека</strong><small>Фильмы и музыка</small></span><ArrowRight size={16} /></button>
                <button className="utility-card glass-panel" data-tv-focus="true" onClick={openAssistant}><Timer /><span><strong>Таймер и заметки</strong><small>{timer ? 'Таймер ' + formatDuration(remainingMs) : notes.length + ' сохранённых заметок'}</small></span><ArrowRight size={16} /></button>
                <button className="utility-card glass-panel" data-tv-focus="true" onClick={() => setView('settings')}><Settings2 /><span><strong>Настроить среду</strong><small>Вид, погода и сервисы</small></span><ArrowRight size={16} /></button>
              </div>
            </section>

            <div className="scroll-hint"><ArrowDown size={15} /> Прокрути вниз, чтобы открыть каталог приложений</div>
            <section className="section-block embedded-catalog" id="catalog-preview">
              <div className="section-heading">
                <div><span className="eyebrow small">БИБЛИОТЕКА</span><h2>Продолжить в приложении</h2></div>
                <button className="text-action" data-tv-focus="true" onClick={() => setView('apps')}>Открыть каталог <ArrowRight size={15} /></button>
              </div>
              <div className="mini-app-row">
                {FEATURED_APPS.map((app) => (
                  <button className="mini-app glass-panel" data-tv-focus="true" key={app.id} onClick={() => void runApp(app.target)}><AppSymbol app={app} /><span><strong>{app.name}</strong><small>{app.category}</small></span></button>
                ))}
              </div>
            </section>
          </>
        )}

        {view === 'apps' && (
          <section className="page-section">
            <div className="page-title-row"><div><span className="eyebrow small">ТВОЯ БИБЛИОТЕКА</span><h1>Приложения</h1><p>Избранное и приложения, которые обнаружил телевизор.</p></div><label className="search-box glass-panel"><Search size={18} /><input data-tv-focus="true" aria-label="Поиск приложений" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Найти приложение…" /></label></div>
            <div className="catalog-group"><h2>Избранные сервисы <span>0{filteredApps.featured.length}</span></h2><div className="app-catalog-grid">{filteredApps.featured.map((app) => <button className={'catalog-card glass-panel card-' + app.id} data-tv-focus="true" key={app.id} onClick={() => void runApp(app.target)}><AppSymbol app={app} /><strong>{app.name}</strong><span>{app.subtitle}</span><div className="catalog-card-footer">{app.category}<ArrowRight size={16} /></div></button>)}</div></div>
            <div className="catalog-group"><h2>Установлено на телевизоре <span>{installedApps.length}</span></h2>{installedApps.length ? <div className="installed-list">{filteredApps.discovered.map((app) => <button className="installed-row glass-panel" data-tv-focus="true" key={app.id} onClick={() => void launchInstalledAppById(app.id, installedApps).then((result) => notify(result.message))}><span className="installed-icon"><Grid2X2 /></span><span><strong>{app.name}</strong><small>{app.id}{app.version ? ' · v' + app.version : ''}</small></span><ArrowRight size={17} /></button>)}</div> : <div className="empty-state glass-panel"><Info /><strong>{isTizenRuntime() ? 'Список приложений недоступен' : 'Список появится на телевизоре'}</strong><span>В браузере работает предпросмотр. На Samsung список загружается через Tizen Web API и его разрешения.</span></div>}</div>
          </section>
        )}

        {view === 'library' && (
          <section className="page-section">
            <div className="page-title-row"><div><span className="eyebrow small">ТВОЙ КОНТЕНТ</span><h1>Медиатека</h1><p>Единое место для кино, сериалов и музыки. Подключение сервисов настраивается отдельно.</p></div><button className="secondary-button" data-tv-focus="true" onClick={() => setView('settings')}><Settings2 size={17} /> Подключения</button></div>
            <div className="library-grid">
              <article className="library-card glass-panel"><div className="library-art jellyfin-art"><Film /></div><div className="library-card-copy"><span className="eyebrow small">КИНО И СЕРИАЛЫ</span><h2>Jellyfin</h2><p>Домашняя библиотека, просмотр и продолжение с того места, где остановился.</p><button className="primary-button" data-tv-focus="true" onClick={() => void runApp('jellyfin')}><Play size={17} /> Открыть Jellyfin</button></div></article>
              <article className="library-card glass-panel"><div className="library-art music-art"><Music2 /></div><div className="library-card-copy"><span className="eyebrow small">ЛИЧНАЯ МУЗЫКА</span><h2>SelfMusic</h2><p>Твои треки, обложки, избранное и очереди воспроизведения на собственном сервере.</p><button className="primary-button" data-tv-focus="true" onClick={() => void runApp('selfmusic')}><Play size={17} /> Открыть SelfMusic</button></div></article>
            </div>
            <div className="note-area glass-panel"><div className="note-area-title"><BookOpen /><div><h2>Память ассистента</h2><p>Локальные заметки сохраняются в этом приложении.</p></div><button className="secondary-button" data-tv-focus="true" onClick={openAssistant}>Спросить ассистента</button></div>{notes.length ? <div className="notes-list">{notes.slice(-5).reverse().map((note) => <div className="note-row" key={note.id}><span>{note.text}</span><small>{new Date(note.createdAt).toLocaleDateString('ru-RU')}</small></div>)}</div> : <div className="empty-notes">Здесь появятся вещи, которые ты попросишь запомнить.</div>}</div>
          </section>
        )}

        {view === 'settings' && (
          <section className="page-section settings-page">
            <div className="page-title-row"><div><span className="eyebrow small">ПОД ТЕБЯ</span><h1>Настройки среды</h1><p>Тема, погода, подключения и поведение оболочки.</p></div><span className="settings-saved"><Check size={15} /> Сохраняется автоматически</span></div>
            <div className="settings-grid">
              <section className="settings-card glass-panel"><div className="settings-card-head"><Cloud /><div><h2>Погода</h2><p>Выбери город для главного экрана.</p></div></div><label className="field-label">Город<input data-tv-focus="true" value={settings.city} onChange={(event) => updateSetting('city', event.target.value)} placeholder="Например, Burbank" /></label><p className="field-help">Текущая погода загружается через Open-Meteo. Геолокация автоматически не включается.</p></section>
              <section className="settings-card glass-panel"><div className="settings-card-head"><Sparkles /><div><h2>Внешний вид</h2><p>Меньше шума, больше атмосферы.</p></div></div><label className="field-label">Интенсивность стекла <strong>{settings.glassIntensity}%</strong><input data-tv-focus="true" type="range" min="25" max="100" step="5" value={settings.glassIntensity} onChange={(event) => updateSetting('glassIntensity', Number(event.target.value))} /></label><label className="check-row"><span><strong>Уменьшить движение</strong><small>Отключает плавание фоновых слоёв.</small></span><input data-tv-focus="true" type="checkbox" checked={settings.reduceMotion} onChange={(event) => updateSetting('reduceMotion', event.target.checked)} /></label></section>
              <section className="settings-card glass-panel"><div className="settings-card-head"><Film /><div><h2>Медиасервисы</h2><p>Адреса твоих собственных серверов.</p></div></div><label className="field-label">Jellyfin URL<input data-tv-focus="true" type="url" value={settings.jellyfinUrl} onChange={(event) => updateSetting('jellyfinUrl', event.target.value)} placeholder="https://jellyfin.example.com" /></label><label className="field-label">SelfMusic URL<input data-tv-focus="true" type="url" value={settings.selfMusicUrl} onChange={(event) => updateSetting('selfMusicUrl', event.target.value)} placeholder="https://music.example.com" /></label><p className="field-help">Ссылки сохраняются локально. При прямом открытии сайт должен разрешать доступ и поддерживать браузер телевизора.</p></section>
              <section className="settings-card glass-panel"><div className="settings-card-head"><Mic /><div><h2>AI и голос</h2><p>Подключай сервер, не API-ключ в приложении.</p></div></div><label className="field-label">AI backend endpoint<input data-tv-focus="true" type="url" value={settings.aiEndpoint} onChange={(event) => updateSetting('aiEndpoint', event.target.value)} placeholder="https://your-worker.example.com/api/assistant" /></label><p className="field-help">Endpoint должен принимать POST JSON { '{ message }' } и возвращать { '{ reply }' }. Ключ модели хранится на сервере, не на телевизоре.</p><label className="check-row"><span><strong>Озвучивать ответы</strong><small>Зависит от поддержки Speech Synthesis в Tizen.</small></span><input data-tv-focus="true" type="checkbox" checked={settings.speakReplies} onChange={(event) => updateSetting('speakReplies', event.target.checked)} /></label><button className="secondary-button test-voice-button" data-tv-focus="true" onClick={openAssistant}><Mic size={17} /> Проверить ассистента <ArrowRight size={15} /></button></section>
            </div>
            <div className="notice-card"><ShieldCheck size={18} /><span><strong>Приватность:</strong> заметки и настройки остаются в локальном хранилище приложения. Не добавляй секретные API-ключи в поля на телевизоре или в исходный код.</span></div>
          </section>
        )}
      </main>

      <footer className="footer-bar"><span><span className="brand-mark footer-mark">b1o</span> <strong>B1O TV</strong> <span className="footer-separator">/</span> {VIEW_LABELS[view]}</span><span className="footer-right"><Wifi size={14} /> <span>Твоя среда, твои правила</span><button data-tv-focus="true" className="footer-settings" onClick={() => setView('settings')} aria-label="Настройки"><Settings2 size={15} /></button></span></footer>

      {assistantOpen && (
        <div className="assistant-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAssistantOpen(false); }}>
          <section className="assistant-panel glass-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
            <header className="assistant-header"><div className="assistant-avatar"><Sparkles /></div><div><span className="eyebrow small">B1O INTELLIGENCE</span><h2 id="assistant-title">AI Assistant</h2><p>Голос, ответы и управление средой</p></div><button className="icon-button" data-tv-focus="true" onClick={() => setAssistantOpen(false)} aria-label="Закрыть ассистента"><X /></button></header>
            <div className="assistant-capabilities"><span><Check size={13} /> Заметки</span><span><Check size={13} /> Таймеры</span><span><Check size={13} /> Приложения</span><span><Info size={13} /> AI backend: {settings.aiEndpoint ? 'подключён' : 'не настроен'}</span></div>
            <div className="chat-messages" aria-live="polite">
              {messages.slice(-30).map((message) => <div className={'chat-message ' + message.role} key={message.id}><span className="chat-avatar">{message.role === 'assistant' ? <Sparkles size={15} /> : 'Я'}</span><p>{message.text}</p></div>)}
              {assistantBusy && <div className="chat-message assistant"><span className="chat-avatar"><Sparkles size={15} /></span><p className="typing-indicator"><i /><i /><i /></p></div>}
            </div>
            <div className="assistant-input-area"><button className={'voice-button' + (voiceListening ? ' listening' : '')} data-tv-focus="true" onClick={startVoiceInput} aria-label="Начать голосовой ввод">{voiceListening ? <LoaderCircle className="spin" /> : <Mic />}</button><form className="assistant-form" onSubmit={(event) => { event.preventDefault(); void submitAssistant(); }}><input data-tv-focus="true" data-assistant-input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Спроси что-нибудь…" aria-label="Сообщение ассистенту" /><button data-tv-focus="true" disabled={!draft.trim() || assistantBusy} aria-label="Отправить сообщение"><ArrowRight /></button></form></div>
            <div className="assistant-footnote"><Volume2 size={13} /> Для открытия с клавиатуры предпросмотра нажми Alt + V. Аппаратная кнопка микрофона зависит от прошивки и TV API.</div>
          </section>
        </div>
      )}

      {toast && <div className="toast-message" role="status"><Check size={17} /><span>{toast}</span><button onClick={() => setToast('')} aria-label="Закрыть уведомление"><X size={14} /></button></div>}
    </div>
  );
}

export default App;