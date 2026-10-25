import { useEffect, useState } from 'react';
import { formatDuration } from '../../services/assistant';
import { isAppVisible, subscribeToAppVisibility } from '../../platform/appLifecycle';

export function TimerCountdown({ endAt }: { endAt: number }) {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, endAt - Date.now()));

  useEffect(() => {
    let interval: number | undefined;

    const update = () => {
      const remaining = Math.max(0, endAt - Date.now());
      setRemainingMs(remaining);
      if (remaining === 0 && interval !== undefined) {
        window.clearInterval(interval);
        interval = undefined;
      }
    };

    const syncVisibility = (visible: boolean) => {
      if (interval !== undefined) window.clearInterval(interval);
      interval = undefined;
      update();
      if (visible && endAt > Date.now()) interval = window.setInterval(update, 1_000);
    };

    syncVisibility(isAppVisible());
    const unsubscribe = subscribeToAppVisibility(syncVisibility);

    return () => {
      if (interval !== undefined) window.clearInterval(interval);
      unsubscribe();
    };
  }, [endAt]);

  return <>{formatDuration(remainingMs)}</>;
}
