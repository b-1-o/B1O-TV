import { useEffect, useState } from 'react';
import { isAppVisible, subscribeToAppVisibility } from '../../platform/appLifecycle';

const CLOCK_FORMATTER = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' });
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

export function HomeClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: number | undefined;

    const syncVisibility = (visible: boolean) => {
      if (interval !== undefined) window.clearInterval(interval);
      interval = undefined;
      if (!visible) return;

      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 60_000);
    };

    syncVisibility(isAppVisible());
    const unsubscribe = subscribeToAppVisibility(syncVisibility);
    return () => {
      if (interval !== undefined) window.clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const displayedClock = CLOCK_FORMATTER.format(now);
  const displayedDate = DATE_FORMATTER.format(now);

  return (
    <div className="home-clock-column">
      <div className="clock" aria-label={'Time: ' + displayedClock}>{displayedClock}</div>
      <div className="date-line">{displayedDate}</div>
    </div>
  );
}
