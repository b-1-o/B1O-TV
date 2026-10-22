import type { AppTarget, AssistantMessage } from '../types';

export type LocalIntent =
  | { kind: 'remember'; note: string }
  | { kind: 'recall' }
  | { kind: 'timer'; durationMs: number }
  | { kind: 'time' }
  | { kind: 'launch'; target: AppTarget };

export interface SavedNote {
  id: string;
  text: string;
  createdAt: number;
}

const NOTES_KEY = 'b1o-tv:notes';

export function parseLocalIntent(raw: string): LocalIntent | null {
  const text = raw.trim().toLocaleLowerCase('ru-RU');

  const noteMatch = raw.trim().match(/^(?:пожалуйста\s+)?(?:запомни|запиши|remember)\s*[, :]?\s*(.+)$/i);
  if (noteMatch?.[1]) return { kind: 'remember', note: noteMatch[1].trim() };

  if (
    text.includes('что ты помнишь') ||
    text.includes('что я просил запомнить') ||
    text.includes('покажи заметки') ||
    text.includes('список заметок') ||
    text === 'мои заметки'
  ) {
    return { kind: 'recall' };
  }

  const timerMatch = text.match(/(?:таймер|отсч[её]т)[^\d]{0,28}(\d+)\s*(секунд(?:у|ы)?|сек|минут(?:у|ы)?|мин|час(?:а|ов)?|ч)(?=\s|$|[,.!?])/);
  if (timerMatch) {
    const amount = Number(timerMatch[1]);
    const unit = timerMatch[2];
    const multiplier = /^(?:секунд|сек)/.test(unit)
      ? 1_000
      : /^(?:минут|мин)/.test(unit)
        ? 60_000
        : 3_600_000;
    if (Number.isFinite(amount) && amount > 0 && amount * multiplier <= 24 * 60 * 60 * 1_000) {
      return { kind: 'timer', durationMs: amount * multiplier };
    }
  }

  if (text.includes('который час') || text.includes('сколько времени') || text.includes('текущее время')) {
    return { kind: 'time' };
  }

  const launchRequested = /(открой|запусти|включи|перейди|open|launch|play)/.test(text);
  if (launchRequested) {
    if (text.includes('youtube') || text.includes('ютуб')) return { kind: 'launch', target: 'youtube' };
    if (text.includes('jellyfin') || text.includes('джеллифин') || text.includes('фильм')) return { kind: 'launch', target: 'jellyfin' };
    if (text.includes('selfmusic') || text.includes('селфмьюзик') || text.includes('музык')) return { kind: 'launch', target: 'selfmusic' };
    if (text.includes('браузер') || text.includes('browser')) return { kind: 'launch', target: 'browser' };
  }

  return null;
}

export function readSavedNotes(): SavedNote[] {
  try {
    const value = localStorage.getItem(NOTES_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedNote =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as SavedNote).id === 'string' &&
        typeof (item as SavedNote).text === 'string' &&
        typeof (item as SavedNote).createdAt === 'number',
    );
  } catch {
    return [];
  }
}

export function saveNote(text: string): SavedNote {
  const note: SavedNote = {
    id: String(Date.now()),
    text: text.trim(),
    createdAt: Date.now(),
  };
  const notes = [...readSavedNotes(), note].slice(-100);
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch {
    // Storage can be unavailable in private or restricted web runtimes.
  }
  return note;
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(remainingSeconds).padStart(2, '0');
  return String(minutes).padStart(2, '0') + ':' + String(remainingSeconds).padStart(2, '0');
}

export function resolveAssistantEndpoint(endpoint: string): URL {
  const cleanEndpoint = endpoint.trim();
  if (!cleanEndpoint) {
    throw new Error('Для свободных ответов подключи AI backend в настройках. Локально я уже умею ставить таймеры, сохранять заметки и открывать доступные приложения.');
  }

  let url: URL;
  try {
    url = new URL(cleanEndpoint);
  } catch {
    throw new Error('Адрес AI backend указан некорректно.');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))) {
    throw new Error('Для AI backend используй HTTPS.');
  }

  let path = url.pathname;
  while (path.endsWith('/')) path = path.slice(0, -1);
  if (!path.endsWith('/api/assistant')) {
    url.pathname = (path || '') + '/api/assistant';
  }
  return url;
}

export async function askConfiguredAssistant(endpoint: string, message: string, history: AssistantMessage[] = [], token = ''): Promise<string> {
  const url = resolveAssistantEndpoint(endpoint);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25_000);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token.trim()) headers.Authorization = 'Bearer ' + token.trim();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        history: history.filter((item) => item.role === 'user' || item.role === 'assistant').slice(-10).map((item) => ({ role: item.role, content: item.text })),
      }),
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') throw new Error(data.error);
      throw new Error('AI backend ответил с ошибкой ' + response.status + '.');
    }
    if (typeof data === 'object' && data !== null && 'reply' in data && typeof data.reply === 'string') {
      return data.reply;
    }
    throw new Error('AI backend должен вернуть JSON с полем reply.');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Ассистент не ответил за 25 секунд. Попробуй ещё раз.');
    }
    if (error instanceof Error) throw error;
    throw new Error('Не удалось связаться с AI backend.');
  } finally {
    window.clearTimeout(timeout);
  }
}

export function createAssistantMessage(role: AssistantMessage['role'], text: string): AssistantMessage {
  return { id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7), role, text };
}