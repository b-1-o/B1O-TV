import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

describe('B1O TV native-feeling service integration', () => {
  it('uses the built-in SelfMusic screen instead of launching another website', () => {
    const app = readSource('src/App.tsx');
    const player = readSource('src/components/tv/SelfMusicPanel.tsx');

    expect(app).toContain("view === 'selfmusic'");
    expect(app).toContain('<SelfMusicPanel');
    expect(app).toContain("navigateToView('selfmusic')");
    const launcherBranch = app.match(/if \(target === 'selfmusic'\) \{[\s\S]*?\n {4}\}/);
    expect(launcherBranch?.[0]).toContain("navigateToView('selfmusic')");
    expect(launcherBranch?.[0]).not.toContain('launchTVService');

    expect(player).toContain("'/api/auth/login'");
    expect(player).toContain("'/api/tracks'");
    expect(player).toContain("'/api/favorites/'");
    expect(player).toContain("'/api/playlists/'");
    expect(player).toContain("'/api/embed/media-tickets'");
    expect(player).toContain("'/api/stream/'");
    expect(player).toContain("'/api/auth/logout'");
    expect(player).toContain("const createPlaylist = useCallback");
    expect(player).toContain("setStreamUrl('');");
    expect(player).toContain("const addTrackToPlaylist = useCallback");
    expect(player).toContain('<audio');
  });

  it('does not manufacture installed apps for the browser preview', () => {
    const app = readSource('src/App.tsx');
    const cards = readSource('src/components/tv/MemoizedCards.tsx');

    expect(app).not.toContain('PREVIEW_INSTALLED_APPS');
    expect(app).not.toContain('BROWSER PREVIEW · SAMPLE APPS');
    expect(app).not.toContain('Sample apps · preview only');
    expect(cards).not.toContain('Preview only');
    expect(app).toContain('isTizenRuntime() && (');
    expect(app).toContain('Installed on TV');
  });

  it('styles the built-in player with the same glass material and focus states', () => {
    const player = readSource('src/components/tv/SelfMusicPanel.tsx');
    const css = readSource('src/styles.css');

    expect(player).toContain('selfmusic-now-playing glass-panel');
    expect(player).toContain('selfmusic-library glass-panel');
    expect(css).toContain('.selfmusic-now-playing,');
    expect(css).toContain('.selfmusic-track-select.tv-focusable--focused');
    expect(css).toContain('.home-installed-app.glass-panel');
    expect(css).toContain('.selfmusic-playlist-create');
    expect(css).toContain('.selfmusic-playlist-picker');
    expect(css).toContain('.selfmusic-origin-warning');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
