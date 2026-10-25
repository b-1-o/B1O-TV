import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAppVisible, subscribeToAppVisibility } from './appLifecycle';

afterEach(() => vi.unstubAllGlobals());

describe('app visibility lifecycle', () => {
  it('treats an active document as visible', () => {
    vi.stubGlobal('document', { hidden: false });
    expect(isAppVisible()).toBe(true);
  });

  it('treats a hidden document as inactive', () => {
    vi.stubGlobal('document', { hidden: true });
    expect(isAppVisible()).toBe(false);
  });

  it('pauses on hide and resumes on visibility/pageshow events', () => {
    const documentTarget = new EventTarget() as EventTarget & { hidden: boolean };
    documentTarget.hidden = false;
    const windowTarget = new EventTarget();
    vi.stubGlobal('document', documentTarget);
    vi.stubGlobal('window', windowTarget);

    const listener = vi.fn();
    const unsubscribe = subscribeToAppVisibility(listener);

    documentTarget.hidden = true;
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    windowTarget.dispatchEvent(new Event('pagehide'));
    documentTarget.hidden = false;
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    windowTarget.dispatchEvent(new Event('pageshow'));

    expect(listener.mock.calls.map(([visible]) => visible)).toEqual([false, false, true, true]);

    unsubscribe();
    listener.mockClear();
    windowTarget.dispatchEvent(new Event('pagehide'));
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(listener).not.toHaveBeenCalled();
  });
});
