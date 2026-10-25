export type RemoteDirection = 'left' | 'right' | 'up' | 'down' | 'enter';

export function getRemoteDirection(key: string, keyCode = 0): RemoteDirection | null {
  const normalized = key.toLocaleLowerCase();
  if (normalized === 'arrowleft' || normalized === 'left' || keyCode === 37) return 'left';
  if (normalized === 'arrowright' || normalized === 'right' || keyCode === 39) return 'right';
  if (normalized === 'arrowup' || normalized === 'up' || keyCode === 38) return 'up';
  if (normalized === 'arrowdown' || normalized === 'down' || keyCode === 40) return 'down';
  if (normalized === 'enter' || normalized === 'select' || keyCode === 13) return 'enter';
  return null;
}

export function isTizenBackKey(key: string, keyCode = 0): boolean {
  return keyCode === 10009 || key === 'BrowserBack' || key === 'GoBack';
}

/** Backspace remains normal text editing while a text-capable control is focused. */
export function isBackKey(key: string, keyCode = 0, isTyping = false): boolean {
  return key === 'Escape' || isTizenBackKey(key, keyCode) || (key === 'Backspace' && !isTyping);
}

export function isVoiceKey(key: string): boolean {
  return /voice|microphone|mic/i.test(key);
}

export interface VerticalDockTransitionInput {
  direction: 'up' | 'down';
  inDock: boolean;
  modalOpen: boolean;
  hasFocusableBelow: boolean;
  lastContentFocusKey: string | null;
  lastContentFocusExists: boolean;
  preferredFocusKey: string;
  preferredFocusExists: boolean;
}

/** A deterministic boundary rule used by the app and tested independently of the TV WebView. */
export function resolveVerticalDockTarget(input: VerticalDockTransitionInput): string | null {
  if (input.modalOpen) return null;

  if (input.direction === 'up' && input.inDock) {
    if (input.lastContentFocusKey && input.lastContentFocusExists) return input.lastContentFocusKey;
    if (input.preferredFocusExists) return input.preferredFocusKey;
    return 'BRAND-HOME';
  }

  if (input.direction === 'down' && !input.inDock && !input.hasFocusableBelow) {
    return 'DOCK-apps';
  }

  return null;
}
