import { describe, expect, it } from 'vitest';
import {
  getRemoteDirection,
  isBackKey,
  isTizenBackKey,
  isVoiceKey,
  resolveVerticalDockTarget,
} from './remoteNavigation';

describe('remote key normalization', () => {
  it.each([
    ['ArrowLeft', 0, 'left'],
    ['Right', 0, 'right'],
    ['ArrowUp', 0, 'up'],
    ['Down', 0, 'down'],
    ['Enter', 0, 'enter'],
    ['', 40, 'down'],
  ] as const)('normalizes key %s with keyCode %s', (key, keyCode, expected) => {
    expect(getRemoteDirection(key, keyCode)).toBe(expected);
  });

  it('does not treat ordinary Backspace as navigation while typing', () => {
    expect(isBackKey('Backspace', 0, true)).toBe(false);
    expect(isBackKey('Backspace', 0, false)).toBe(true);
  });

  it('recognizes the Samsung Return key without blocking text editing for regular Backspace', () => {
    expect(isTizenBackKey('', 10009)).toBe(true);
    expect(isBackKey('BrowserBack', 0, true)).toBe(true);
  });

  it('recognizes voice and microphone keys without depending on a specific remote label', () => {
    expect(isVoiceKey('AudioInputMicrophone')).toBe(true);
    expect(isVoiceKey('KEY_VOICE')).toBe(true);
    expect(isVoiceKey('ArrowDown')).toBe(false);
  });
});

describe('vertical navigation boundaries', () => {
  const base = {
    inDock: false,
    modalOpen: false,
    hasFocusableBelow: false,
    lastContentFocusKey: 'RESUME-movie-1',
    lastContentFocusExists: true,
    preferredFocusKey: 'CARD-youtube',
    preferredFocusExists: true,
  };

  it('moves to the dock only after the last visible content row', () => {
    expect(resolveVerticalDockTarget({ ...base, direction: 'down', hasFocusableBelow: true })).toBeNull();
    expect(resolveVerticalDockTarget({ ...base, direction: 'down' })).toBe('DOCK-apps');
  });

  it('restores the last focused content item when moving up from the dock', () => {
    expect(resolveVerticalDockTarget({ ...base, direction: 'up', inDock: true })).toBe('RESUME-movie-1');
  });

  it('falls back to the view focus when the remembered item is gone', () => {
    expect(resolveVerticalDockTarget({
      ...base,
      direction: 'up',
      inDock: true,
      lastContentFocusExists: false,
    })).toBe('CARD-youtube');
  });

  it('falls back to the home brand if the view has no focusable control', () => {
    expect(resolveVerticalDockTarget({
      ...base,
      direction: 'up',
      inDock: true,
      lastContentFocusExists: false,
      preferredFocusExists: false,
    })).toBe('BRAND-HOME');
  });

  it('does not steal arrow navigation from a modal dialog', () => {
    expect(resolveVerticalDockTarget({ ...base, direction: 'down', modalOpen: true })).toBeNull();
  });
});
