import { describe, expect, it } from 'vitest';
import { formatDuration, parseLocalIntent, resolveAssistantEndpoint } from './assistant';

describe('parseLocalIntent', () => {
  it('parses a note command', () => {
    expect(parseLocalIntent('Запомни, что я предпочитаю тёмную тему')).toEqual({
      kind: 'remember',
      note: 'что я предпочитаю тёмную тему',
    });
  });

  it('parses a timer in minutes', () => {
    expect(parseLocalIntent('Поставь таймер на 5 минут')).toEqual({
      kind: 'timer',
      durationMs: 300_000,
    });
  });

  it('parses a timer in seconds', () => {
    expect(parseLocalIntent('таймер на 30 секунд')).toEqual({
      kind: 'timer',
      durationMs: 30_000,
    });
  });

  it('recognizes Jellyfin launch requests', () => {
    expect(parseLocalIntent('Открой Jellyfin')).toEqual({ kind: 'launch', target: 'jellyfin' });
  });

  it('does not turn an ordinary question into an action', () => {
    expect(parseLocalIntent('Почему небо серое?')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(65_000)).toBe('01:05');
  });

  it('formats hours', () => {
    expect(formatDuration(3_661_000)).toBe('1:01:01');
  });
});

describe('resolveAssistantEndpoint', () => {
  it('adds the assistant API path to a Worker origin', () => {
    expect(resolveAssistantEndpoint('https://example.workers.dev').toString()).toBe('https://example.workers.dev/api/assistant');
  });

  it('keeps an already complete assistant endpoint', () => {
    expect(resolveAssistantEndpoint('https://example.workers.dev/api/assistant').toString()).toBe('https://example.workers.dev/api/assistant');
  });

  it('removes trailing slashes before adding the API path', () => {
    expect(resolveAssistantEndpoint('https://example.workers.dev/').toString()).toBe('https://example.workers.dev/api/assistant');
  });

  it('rejects insecure non-local endpoints', () => {
    expect(() => resolveAssistantEndpoint('http://example.com')).toThrow('Use HTTPS for the AI backend.');
  });
});
