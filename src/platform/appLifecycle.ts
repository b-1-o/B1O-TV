export type AppVisibilityListener = (visible: boolean) => void;

/** Treat non-browser test/render contexts as active; a real page uses the Page Visibility API. */
export function isAppVisible(): boolean {
  return typeof document === 'undefined' || !document.hidden;
}

/**
 * Samsung Tizen TV fires visibilitychange when the user leaves or returns to an app.
 * pagehide/pageshow are fallbacks for browser navigation and lower-level WebView lifecycle events.
 */
export function subscribeToAppVisibility(listener: AppVisibilityListener): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => undefined;

  const handleVisibilityChange = () => listener(!document.hidden);
  const handlePageHide = () => listener(false);
  const handlePageShow = () => listener(!document.hidden);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('pageshow', handlePageShow);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('pageshow', handlePageShow);
  };
}
