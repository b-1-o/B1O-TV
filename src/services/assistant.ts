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

  const noteMatch = raw.trim().match(/^(?:please\s+)?(?:запомни|запиши|remember(?:\s+that)?|save\s+(?:this\s+)?note|note\s+this)\s*[, :]?\s*(.+)$/i);
  if (noteMatch?.[1]) return { kind: 'remember', note: noteMatch[1].trim() };

  if (
    text.includes('что ты помнишь') ||
    text.includes('что я просил запомнить') ||
    text.includes('покажи заметки') ||
    text.includes('список заметок') ||
    text === 'мои заметки' ||
    text.includes('what do you remember') ||
    text.includes('what did i ask you to remember') ||
    text.includes('show my notes') ||
    text.includes('list notes') ||
    text === 'my notes' ||
    text === 'show notes'
  ) return { kind: 'recall' };

  const units = '(?:секунд(?:у|ы)?|сек|seconds?|secs?|минут(?:у|ы)?|мин|minutes?|mins?|час(?:а|ов)?|ч|hours?|hrs?)';
  const timerMatch =
    text.match(new RegExp('(?:таймер|отсч[её]т|timer|countdown)[^\\d]{0,40}(\\d+)\\s*(' + units + ')(?=\\s|$|[,.!?])')) ??
    text.match(new RegExp('(\\d+)\\s*(' + units + ')\\s+(?:таймер|timer|countdown)(?=\\s|$|[,.!?])'));
  if (timerMatch) {
    const amount = Number(timerMatch[1]);
    const unit = timerMatch[2];
    const multiplier = /^(?:секунд|сек|second|sec)/.test(unit)
      ? 1_000
      : /^(?:минут|мин|minute|min)/.test(unit)
        ? 60_000
        : 3_600_000;
    if (Number.isFinite(amount) && amount > 0 && amount * multiplier <= 24 * 60 * 60 * 1_000) {
      return { kind: 'timer', durationMs: amount * multiplier };
    }
  }

  if (
    text.includes('который час') ||
    text.includes('сколько времени') ||
    text.includes('текущее время') ||
    /\b(?:what(?:'s| is) the time|what time is it|current time|tell me the time|time now)\b/.test(text)
  ) return { kind: 'time' };

  if (/(открой|запусти|включи|перейди|open|launch|play|start|show|watch)/.test(text)) {
    if (text.includes('youtube') || text.includes('ютуб')) return { kind: 'launch', target: 'youtube' };
    if (
      text.includes('jellyfin') || text.includes('джеллифин') ||
      text.includes('фильм') || text.includes('movie') || text.includes('movies') ||
      text.includes('film') || text.includes('films')
    ) return { kind: 'launch', target: 'jellyfin' };
    if (
      text.includes('selfmusic') || text.includes('селфмьюзик') ||
      text.includes('музык') || text.includes('music') || text.includes('song')
    ) return { kind: 'launch', target: 'selfmusic' };
    if (text.includes('браузер') || text.includes('browser') || text.includes('internet')) {
      return { kind: 'launch', target: 'browser' };
    }
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
    throw new Error('Connect an AI backend in Settings for open-ended answers. Timers, notes, and app launching also work locally.');
  }

  let url: URL;
  try {
    url = new URL(cleanEndpoint);
  } catch {
    throw new Error('The AI backend URL is invalid.');
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1'))) {
    throw new Error('Use HTTPS for the AI backend.');
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
      if (response.status === 401) {
        throw new Error('The device token does not match the Cloudflare Worker secret. In Settings → AI & Voice, enter the same token used for a successful backend request.');
      }
      if (response.status === 503) {
        throw new Error('The AI backend is not configured. Check the ASSISTANT_TOKEN secret and the deployed Cloudflare Worker.');
      }
      if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
        throw new Error(data.error);
      }
      throw new Error('AI backend ответил с ошибкой ' + response.status + '.');
    }
    if (typeof data === 'object' && data !== null && 'reply' in data && typeof data.reply === 'string') {
      return data.reply;
    }
    throw new Error('AI backend должен вернуть JSON с полем reply.');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The assistant did not respond within 25 seconds. Try again.');
    }
    if (error instanceof Error) throw error;
    throw new Error('Could not reach the AI backend.');
  } finally {
    window.clearTimeout(timeout);
  }
}

export function createAssistantMessage(role: AssistantMessage['role'], text: string): AssistantMessage {
  return { id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 7), role, text };
}

export function resolveTranscriptionEndpoint(endpoint: string): URL {
  const url = resolveAssistantEndpoint(endpoint);
  url.pathname = url.pathname.replace(/\/api\/assistant\/?$/, '/api/transcribe');
  return url;
}

/** Transcribe a short microphone recording without storing it on the server. */
export async function transcribeRecordedAudio(endpoint: string, audio: Blob, token: string): Promise<string> {
  if (!token.trim()) {
    throw new Error('Voice-to-text needs the Device token in Settings → AI & Voice. Samsung voice commands may still control the TV.');
  }
  if (!audio.size) throw new Error('No audio was recorded. Try the microphone again.');

  const url = resolveTranscriptionEndpoint(endpoint);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token.trim(),
        'Content-Type': audio.type || 'application/octet-stream',
      },
      body: audio,
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) throw new Error('The device token does not match the Worker secret. Update it in Settings → AI & Voice.');
      if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'string') {
        throw new Error(data.error);
      }
      throw new Error('Speech-to-text service returned ' + response.status + '.');
    }
    if (typeof data === 'object' && data !== null && 'transcript' in data && typeof data.transcript === 'string' && data.transcript.trim()) {
      return data.transcript.trim();
    }
    throw new Error('Speech-to-text service returned no transcript.');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Speech recognition took too long. Try a shorter recording.');
    }
    if (error instanceof Error) throw error;
    throw new Error('Could not reach the speech-to-text service.');
  } finally {
    window.clearTimeout(timeout);
  }
}

