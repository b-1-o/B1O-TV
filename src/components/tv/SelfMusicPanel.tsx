import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Copy,
  Disc3,
  Heart,
  Library,
  ListMusic,
  ListPlus,
  LoaderCircle,
  LogOut,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Search,
  SkipBack,
  SkipForward,
  Shuffle,
  Volume2,
  X,
} from 'lucide-react';
import { TVButton, TVInput } from './FocusableControls';

type JsonRecord = Record<string, unknown>;

interface SelfMusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  genre: string;
  year: number | null;
}

interface SelfMusicPlaylist {
  id: string;
  name: string;
  trackCount: number;
}

interface SelfMusicPanelProps {
  baseUrl: string;
  onServerUrlChange: (value: string) => void;
  accessToken: string;
  onAccessTokenChange: (value: string) => void;
  onPlaybackChange: (state: { isPlaying: boolean; title: string }) => void;
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : fallback;
}

function normalizeBaseUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function parseTrack(value: unknown): SelfMusicTrack | null {
  const item = asRecord(value);
  if (!item || typeof item.id !== 'string' || !item.id) return null;
  const rawDuration = typeof item.duration === 'number' ? item.duration : Number(item.duration ?? 0);
  const rawYear = typeof item.year === 'number' ? item.year : null;
  return {
    id: item.id,
    title: asText(item.title, 'Untitled track'),
    artist: asText(item.artist || item.albumArtist, 'Unknown artist'),
    album: asText(item.album, 'Unknown album'),
    duration: Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0,
    genre: asText(item.genre),
    year: rawYear,
  };
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const total = Math.floor(value);
  return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
}

async function readResponseMessage(response: Response): Promise<string> {
  try {
    const body = asRecord(await response.json());
    return asText(body?.message || body?.error, 'SelfMusic request failed.');
  } catch {
    return response.statusText || 'SelfMusic request failed.';
  }
}

async function apiRequest<T>(
  baseUrl: string,
  endpoint: string,
  accessToken = '',
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', 'Bearer ' + accessToken);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(baseUrl + endpoint, {
    ...init,
    headers,
    credentials: 'omit',
    cache: 'no-store',
  });
  if (!response.ok) {
    const message = await readResponseMessage(response);
    throw new Error(response.status === 401 ? 'Session expired. Sign in to SelfMusic again.' : message);
  }
  return await response.json() as T;
}

export function SelfMusicPanel({
  baseUrl,
  onServerUrlChange,
  accessToken,
  onAccessTokenChange,
  onPlaybackChange,
}: SelfMusicPanelProps) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousUrlRef = useRef(normalizedUrl);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [profileName, setProfileName] = useState('');
  const [tracks, setTracks] = useState<SelfMusicTrack[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [playlists, setPlaylists] = useState<SelfMusicPlaylist[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState('');
  const [playlistTrackIds, setPlaylistTrackIds] = useState<string[]>([]);
  const [playlistNameDraft, setPlaylistNameDraft] = useState('');
  const [playlistCreating, setPlaylistCreating] = useState(false);
  const [playlistPickerTrackId, setPlaylistPickerTrackId] = useState('');
  const [playlistActionKey, setPlaylistActionKey] = useState('');
  const [scope, setScope] = useState<'library' | 'favorites'>('library');
  const [query, setQuery] = useState('');
  const [currentTrackId, setCurrentTrackId] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [imageTickets, setImageTickets] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [busyTrackId, setBusyTrackId] = useState('');
  const [favoriteBusyId, setFavoriteBusyId] = useState('');
  const [artworkFailed, setArtworkFailed] = useState(false);

  const currentTrack = tracks.find((track) => track.id === currentTrackId) ?? null;

  const visibleTracks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const sourceTracks = activePlaylistId
      ? playlistTrackIds.map((id) => tracks.find((track) => track.id === id)).filter((track): track is SelfMusicTrack => Boolean(track))
      : tracks;
    return sourceTracks.filter((track) => {
      if (scope === 'favorites' && !favoriteIds.includes(track.id)) return false;
      if (!normalizedQuery) return true;
      return [track.title, track.artist, track.album, track.genre].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    });
  }, [tracks, favoriteIds, query, scope, activePlaylistId, playlistTrackIds]);

  const friendlyNetworkError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Could not connect to SelfMusic.';
    if (/failed to fetch|networkerror|load failed|cors/i.test(message)) {
      return 'SelfMusic did not allow this B1O origin. Add the exact origin shown below to SELF_MUSIC_ALLOWED_ORIGINS in the SelfMusic .env file, then restart its server. Keep the server private; do not use a wildcard.';
    }
    return message;
  }, []);

  const loadLibrary = useCallback(async (token: string) => {
    if (!normalizedUrl) {
      setLoadError('Enter a valid SelfMusic server URL first.');
      return;
    }
    setLoadingLibrary(true);
    setLoadError('');
    setStatusMessage('');
    try {
      const [profileBody, tracksBody] = await Promise.all([
        apiRequest<unknown>(normalizedUrl, '/api/auth/profile', token),
        apiRequest<unknown>(normalizedUrl, '/api/tracks', token),
      ]);
      const profile = asRecord(profileBody);
      const profileUser = asRecord(profile?.user) ?? profile;
      const trackBody = asRecord(tracksBody);
      const loadedTracks = Array.isArray(trackBody?.tracks)
        ? trackBody.tracks.map(parseTrack).filter((track): track is SelfMusicTrack => track !== null)
        : [];
      setProfileName(asText(profileUser?.username, 'Signed in'));
      setTracks(loadedTracks);

      const [favoritesResult, playlistsResult] = await Promise.allSettled([
        apiRequest<unknown>(normalizedUrl, '/api/favorites', token),
        apiRequest<unknown>(normalizedUrl, '/api/playlists', token),
      ]);

      if (favoritesResult.status === 'fulfilled') {
        const body = asRecord(favoritesResult.value);
        const items = Array.isArray(body?.tracks) ? body.tracks : [];
        setFavoriteIds(items.flatMap((item) => {
          const record = asRecord(item);
          return typeof record?.id === 'string' ? [record.id] : typeof item === 'string' ? [item] : [];
        }));
      } else {
        setFavoriteIds([]);
      }

      if (playlistsResult.status === 'fulfilled') {
        const body = asRecord(playlistsResult.value);
        const items = Array.isArray(body?.playlists) ? body.playlists : [];
        setPlaylists(items.flatMap((item) => {
          const record = asRecord(item);
          if (typeof record?.id !== 'string') return [];
          return [{
            id: record.id,
            name: asText(record.name, 'Untitled playlist'),
            trackCount: Number(record.trackCount ?? record.track_count ?? 0) || 0,
          }];
        }));
      } else {
        setPlaylists([]);
      }

      if (!loadedTracks.length) setStatusMessage('Your library is connected, but no tracks are indexed yet.');
      else setStatusMessage('Connected · ' + loadedTracks.length.toLocaleString() + ' tracks in your library.');
    } catch (error) {
      setLoadError(friendlyNetworkError(error));
      if (error instanceof Error && /session expired|unauthorized|sign in to access/i.test(error.message.toLowerCase())) {
        onAccessTokenChange('');
      }
    } finally {
      setLoadingLibrary(false);
    }
  }, [normalizedUrl, friendlyNetworkError, onAccessTokenChange]);

  useEffect(() => {
    if (previousUrlRef.current !== normalizedUrl) {
      previousUrlRef.current = normalizedUrl;
      setTracks([]);
      setFavoriteIds([]);
      setPlaylists([]);
      setActivePlaylistId('');
      setPlaylistTrackIds([]);
      setPlaylistNameDraft('');
      setPlaylistPickerTrackId('');
      setPlaylistActionKey('');
      setCurrentTrackId('');
      setStreamUrl('');
      setImageTickets({});
      setIsPlaying(false);
      setLoadError('');
      setStatusMessage('');
      setProfileName('');
      onAccessTokenChange('');
      return;
    }
    if (!accessToken || !normalizedUrl) {
      setTracks([]);
      setFavoriteIds([]);
      setPlaylists([]);
      setActivePlaylistId('');
      setPlaylistTrackIds([]);
      setPlaylistNameDraft('');
      setPlaylistPickerTrackId('');
      setPlaylistActionKey('');
      setImageTickets({});
      setProfileName('');
      return;
    }
    void loadLibrary(accessToken);
  }, [accessToken, normalizedUrl, loadLibrary, onAccessTokenChange]);

  useEffect(() => {
    onPlaybackChange({ isPlaying, title: isPlaying && currentTrack ? currentTrack.title : '' });
  }, [isPlaying, currentTrack, onPlaybackChange]);

  useEffect(() => {
    if (!accessToken || !normalizedUrl || tracks.length === 0) return;
    let cancelled = false;
    const trackIds = tracks.slice(0, 100).map((track) => track.id);
    void apiRequest<unknown>(normalizedUrl, '/api/embed/media-tickets', accessToken, {
      method: 'POST',
      body: JSON.stringify({ purpose: 'artwork', trackIds }),
    }).then((body) => {
      const record = asRecord(body);
      const tickets = asRecord(record?.tickets);
      if (!cancelled && tickets) {
        const result: Record<string, string> = {};
        for (const [id, ticket] of Object.entries(tickets)) {
          if (typeof ticket === 'string') result[id] = ticket;
        }
        setImageTickets(result);
      }
    }).catch(() => {
      if (!cancelled) setImageTickets({});
    });
    return () => { cancelled = true; };
  }, [accessToken, normalizedUrl, tracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;
    setIsBuffering(true);
    setCurrentTime(0);
    audio.src = streamUrl;
    audio.load();
    const attemptPlayback = async () => {
      try {
        await audio.play();
        setIsPlaying(true);
        setLoadError('');
      } catch {
        setIsPlaying(false);
        setStatusMessage('Track loaded. Press Play to start playback.');
      }
    };
    void attemptPlayback();
    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    };
  }, [streamUrl]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = normalizeBaseUrl(baseUrl);
    if (!url) {
      setLoginError('Enter a valid SelfMusic URL using http:// or https://.');
      return;
    }
    if (!password) {
      setLoginError('Enter your SelfMusic password.');
      return;
    }

    setSigningIn(true);
    setLoginError('');
    setLoadError('');
    try {
      const loginBody = username.trim() ? { username: username.trim(), password } : { password };
      const response = await fetch(url + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginBody),
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(await readResponseMessage(response));
      const body = asRecord(await response.json());
      if (typeof body?.accessToken !== 'string' || !body.accessToken) {
        throw new Error('SelfMusic authenticated the request but did not return an embedded access token. Add the exact B1O origin shown below to SELF_MUSIC_ALLOWED_ORIGINS in the SelfMusic .env file and restart the server.');
      }
      onAccessTokenChange(body.accessToken);
      setPassword('');
      setLoginError('');
      setStatusMessage('Signed in. Loading your library…');
    } catch (error) {
      setLoginError(friendlyNetworkError(error));
    } finally {
      setSigningIn(false);
    }
  };

  const openPlaylist = useCallback(async (playlist: SelfMusicPlaylist) => {
    if (!accessToken || !normalizedUrl) return;
    setLoadError('');
    setStatusMessage('');
    try {
      const body = asRecord(await apiRequest<unknown>(
        normalizedUrl,
        '/api/playlists/' + encodeURIComponent(playlist.id),
        accessToken,
      ));
      const record = asRecord(body?.playlist);
      const list = Array.isArray(record?.tracks) ? record.tracks : [];
      const ids = list.flatMap((value) => {
        const track = asRecord(value);
        return typeof track?.id === 'string' ? [track.id] : [];
      });
      setActivePlaylistId(playlist.id);
      setPlaylistTrackIds(ids);
      setScope('library');
      setStatusMessage('Playlist · ' + playlist.name + ' · ' + ids.length + ' tracks');
    } catch (error) {
      setLoadError(friendlyNetworkError(error));
      if (error instanceof Error && /session expired|unauthorized/i.test(error.message.toLowerCase())) {
        onAccessTokenChange('');
      }
    }
  }, [accessToken, normalizedUrl, friendlyNetworkError, onAccessTokenChange]);

  const createPlaylist = useCallback(async () => {
    const name = playlistNameDraft.trim();
    if (!name || !accessToken || !normalizedUrl || playlistCreating) return;
    setPlaylistCreating(true);
    setLoadError('');
    try {
      const body = asRecord(await apiRequest<unknown>(normalizedUrl, '/api/playlists', accessToken, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }));
      const record = asRecord(body?.playlist);
      if (typeof record?.id !== 'string') throw new Error('SelfMusic did not return the new playlist.');
      const playlist: SelfMusicPlaylist = {
        id: record.id,
        name: asText(record.name, name),
        trackCount: Number(record.trackCount ?? 0) || 0,
      };
      setPlaylists((previous) => [playlist, ...previous.filter((item) => item.id !== playlist.id)]);
      setPlaylistNameDraft('');
      setActivePlaylistId(playlist.id);
      setPlaylistTrackIds([]);
      setScope('library');
      setPlaylistPickerTrackId('');
      setStatusMessage('Playlist created · ' + playlist.name);
    } catch (error) {
      setLoadError(friendlyNetworkError(error));
      if (error instanceof Error && /session expired|unauthorized/i.test(error.message.toLowerCase())) {
        onAccessTokenChange('');
      }
    } finally {
      setPlaylistCreating(false);
    }
  }, [playlistNameDraft, accessToken, normalizedUrl, playlistCreating, friendlyNetworkError, onAccessTokenChange]);

  const addTrackToPlaylist = useCallback(async (playlist: SelfMusicPlaylist, track: SelfMusicTrack) => {
    if (!accessToken || !normalizedUrl) return;
    const actionKey = track.id + ':' + playlist.id;
    setPlaylistActionKey(actionKey);
    setLoadError('');
    try {
      const body = asRecord(await apiRequest<unknown>(
        normalizedUrl,
        '/api/playlists/' + encodeURIComponent(playlist.id) + '/tracks',
        accessToken,
        { method: 'POST', body: JSON.stringify({ trackId: track.id }) },
      ));
      const added = Number(body?.added ?? 0) > 0;
      if (added) {
        setPlaylists((previous) => previous.map((item) => item.id === playlist.id
          ? { ...item, trackCount: item.trackCount + 1 }
          : item));
        if (activePlaylistId === playlist.id) {
          setPlaylistTrackIds((previous) => previous.includes(track.id) ? previous : [...previous, track.id]);
        }
      }
      setPlaylistPickerTrackId('');
      setStatusMessage(added
        ? track.title + ' added to ' + playlist.name + '.'
        : track.title + ' is already in ' + playlist.name + '.');
    } catch (error) {
      setLoadError(friendlyNetworkError(error));
      if (error instanceof Error && /session expired|unauthorized/i.test(error.message.toLowerCase())) {
        onAccessTokenChange('');
      }
    } finally {
      setPlaylistActionKey('');
    }
  }, [accessToken, normalizedUrl, activePlaylistId, friendlyNetworkError, onAccessTokenChange]);

  const createMediaTicket = useCallback(async (purpose: 'stream' | 'artwork', trackId: string) => {
    if (!accessToken || !normalizedUrl) throw new Error('Sign in to SelfMusic first.');
    const body = await apiRequest<unknown>(normalizedUrl, '/api/embed/media-tickets', accessToken, {
      method: 'POST',
      body: JSON.stringify({ purpose, trackIds: [trackId] }),
    });
    const record = asRecord(body);
    const tickets = asRecord(record?.tickets);
    const ticket = tickets?.[trackId];
    if (typeof ticket !== 'string' || !ticket) throw new Error('SelfMusic did not issue a playback ticket.');
    return ticket;
  }, [accessToken, normalizedUrl]);

  const playTrack = useCallback(async (track: SelfMusicTrack) => {
    setBusyTrackId(track.id);
    setLoadError('');
    setStatusMessage('');
    setIsPlaying(false);
    try {
      const ticket = await createMediaTicket('stream', track.id);
      let artTicket = '';
      try {
        artTicket = await createMediaTicket('artwork', track.id);
      } catch {
        // Artwork is optional; a missing cover must never block audio playback.
      }
      if (artTicket) setImageTickets((previous) => ({ ...previous, [track.id]: artTicket }));
      setCurrentTrackId(track.id);
      setStreamUrl(normalizedUrl + '/api/stream/' + encodeURIComponent(track.id) + '?ticket=' + encodeURIComponent(ticket));
      setDuration(track.duration);
      setArtworkFailed(false);
    } catch (error) {
      setLoadError(friendlyNetworkError(error));
    } finally {
      setBusyTrackId('');
    }
  }, [createMediaTicket, normalizedUrl, friendlyNetworkError]);

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    if (!streamUrl || !currentTrack) {
      const first = visibleTracks[0];
      if (first) void playTrack(first);
      return;
    }
    try {
      await audio.play();
      setIsPlaying(true);
      setLoadError('');
    } catch {
      setStatusMessage('Playback was blocked. Press Play again to continue.');
    }
  }, [isPlaying, streamUrl, currentTrack, visibleTracks, playTrack]);

  const skipTrack = useCallback((direction: -1 | 1) => {
    if (visibleTracks.length === 0) return;
    const currentIndex = visibleTracks.findIndex((track) => track.id === currentTrackId);
    let nextIndex = currentIndex + direction;
    if (shuffle && visibleTracks.length > 1) {
      do { nextIndex = Math.floor(Math.random() * visibleTracks.length); }
      while (nextIndex === currentIndex);
    } else if (repeatMode === 'all') {
      nextIndex = (nextIndex + visibleTracks.length) % visibleTracks.length;
    }
    if (nextIndex < 0 || nextIndex >= visibleTracks.length) return;
    void playTrack(visibleTracks[nextIndex]);
  }, [visibleTracks, currentTrackId, shuffle, repeatMode, playTrack]);

  const handleEnded = () => {
    if (repeatMode === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play();
      return;
    }
    if (repeatMode === 'all' || shuffle) {
      skipTrack(1);
      return;
    }
    const index = visibleTracks.findIndex((track) => track.id === currentTrackId);
    if (index >= 0 && index < visibleTracks.length - 1) skipTrack(1);
    else setIsPlaying(false);
  };

  const toggleFavorite = async (track: SelfMusicTrack) => {
    if (!accessToken) return;
    setFavoriteBusyId(track.id);
    const isFavorite = favoriteIds.includes(track.id);
    try {
      await apiRequest<unknown>(normalizedUrl, '/api/favorites/' + encodeURIComponent(track.id), accessToken, {
        method: isFavorite ? 'DELETE' : 'POST',
      });
      setFavoriteIds((previous) => isFavorite
        ? previous.filter((id) => id !== track.id)
        : [...previous, track.id]);
      setStatusMessage(isFavorite ? 'Removed from favorites.' : 'Added to favorites.');
    } catch (error) {
      setLoadError(friendlyNetworkError(error));
    } finally {
      setFavoriteBusyId('');
    }
  };

  const handleSignOut = () => {
    audioRef.current?.pause();
    if (audioRef.current) {
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    setIsPlaying(false);
    setStreamUrl('');
    setCurrentTrackId('');
    setTracks([]);
    setFavoriteIds([]);
    setPlaylists([]);
    setActivePlaylistId('');
    setPlaylistTrackIds([]);
    setPlaylistNameDraft('');
    setPlaylistPickerTrackId('');
    setPlaylistActionKey('');
    setImageTickets({});
    setPassword('');
    setProfileName('');
    setStatusMessage('Signed out of SelfMusic.');
    onAccessTokenChange('');
  };

  const artworkTicket = currentTrack ? imageTickets[currentTrack.id] : '';
  const artworkUrl = currentTrack && artworkTicket
    ? normalizedUrl + '/api/artwork/' + encodeURIComponent(currentTrack.id) + '?ticket=' + encodeURIComponent(artworkTicket)
    : '';

  return (
    <div className="selfmusic-view">
      <header className="selfmusic-page-heading">
        <div className="selfmusic-page-title">
          <span className="eyebrow small">PERSONAL MUSIC SERVER</span>
          <h1>SelfMusic</h1>
          <p>Your music, inside B1O TV. No redirect to another app or website.</p>
        </div>
        {accessToken ? (
          <div className="selfmusic-account-chip glass-panel">
            <span className="selfmusic-live-dot" />
            <span><strong>{profileName || 'Signed in'}</strong><small>{tracks.length.toLocaleString()} tracks</small></span>
            <TVButton focusKey="SELFMUSIC-SIGNOUT" className="selfmusic-icon-button" data-tv-focus="true" onClick={handleSignOut} aria-label="Sign out of SelfMusic"><LogOut size={17} /></TVButton>
          </div>
        ) : null}
      </header>

      {!accessToken ? (
        <div className="selfmusic-connect-grid">
          <form className="selfmusic-login-card glass-panel" onSubmit={(event) => void handleSignIn(event)}>
            <div className="selfmusic-login-art"><span><Music2 size={30} /></span><i /><i /><i /><i /><i /></div>
            <div className="selfmusic-form-heading"><span className="eyebrow small">YOUR PRIVATE LIBRARY</span><h2>Connect SelfMusic</h2><p>Sign in with the same account you use for your music server.</p></div>
            <label className="selfmusic-field-label">SelfMusic server URL
              <TVInput focusKey="SELFMUSIC-SERVER-URL" data-tv-focus="true" type="url" value={baseUrl} onChange={(event) => onServerUrlChange(event.target.value)} placeholder="http://192.168.1.10:8787" autoComplete="url" />
              <span>On this PC, localhost:8787 is fine. On the TV, use the music server computer’s LAN IP or a private HTTPS/Tailscale URL — localhost points to the TV itself.</span>
            </label>
            <label className="selfmusic-field-label">Username <span>Optional for the shared owner password</span>
              <TVInput focusKey="SELFMUSIC-USERNAME" data-tv-focus="true" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Your SelfMusic username" autoComplete="username" />
            </label>
            <label className="selfmusic-field-label">Password
              <TVInput focusKey="SELFMUSIC-PASSWORD" data-tv-focus="true" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="SelfMusic password" autoComplete="current-password" />
            </label>
            {loginError ? <p className="selfmusic-error" role="alert"><AlertCircle size={16} />{loginError}</p> : null}
            <TVButton focusKey="SELFMUSIC-SIGNIN" className="selfmusic-signin-button" data-tv-focus="true" disabled={signingIn || !password.trim()} onClick={() => undefined} type="submit">
              {signingIn ? <LoaderCircle className="spin" size={17} /> : <Play size={17} />}
              {signingIn ? 'Connecting…' : 'Connect library'}
            </TVButton>
            <p className="selfmusic-security-note"><AlertCircle size={14} /> Your password is used only for sign-in and is not saved in B1O TV. The signed access token stays in memory.</p>
          </form>

          <aside className="selfmusic-setup-card glass-panel">
            <span className="selfmusic-setup-icon"><Library size={24} /></span>
            <span className="eyebrow small">ONE-TIME SERVER SETUP</span>
            <h2>Allow B1O TV to connect</h2>
            <p>SelfMusic allows embedded clients only when their exact origin is configured. On the computer running SelfMusic, add this origin to the comma-separated value in its private <code>.env</code> file:</p>
            <div className="selfmusic-origin-box"><small>B1O TV ORIGIN</small><code>{typeof window !== 'undefined' ? window.location.origin : 'Current app origin'}</code></div>
            {typeof window !== 'undefined' && window.location.origin === 'null' ? <p className="selfmusic-origin-warning">This TV runtime reports an opaque origin (null). Null origins are shared by different sandboxed contexts. Only allow this origin if you trust every page that can reach your private SelfMusic server; keep that server off the public internet.</p> : null}
            <div className="selfmusic-env-line"><code>SELF_MUSIC_ALLOWED_ORIGINS={typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'}</code><TVButton className="selfmusic-copy-button" data-tv-focus="true" onClick={() => {
              const line = 'SELF_MUSIC_ALLOWED_ORIGINS=' + (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');
              if (!navigator.clipboard?.writeText) {
                setStatusMessage('Clipboard access is unavailable here. Copy the displayed line manually into SelfMusic .env.');
                return;
              }
              void navigator.clipboard.writeText(line).then(
                () => setStatusMessage('Environment line copied.'),
                () => setStatusMessage('Clipboard access was denied. Copy the displayed line manually into SelfMusic .env.'),
              );
            }} aria-label="Copy SelfMusic origin setting"><Copy size={15} /></TVButton></div>
            <p>If SELF_MUSIC_ALLOWED_ORIGINS already exists, append the new trusted origin with a comma instead of creating a second variable. Save the file and restart SelfMusic. For the TV, use the exact origin shown by B1O TV on the television itself. Keep SelfMusic on your private LAN/Tailscale network and use HTTPS on any untrusted network. Never expose port 8787 directly to the public internet.</p>
            {statusMessage ? <p className="selfmusic-inline-status" role="status">{statusMessage}</p> : null}
          </aside>
        </div>
      ) : (
        <>
          <div className="selfmusic-player-layout">
            <section className="selfmusic-now-playing glass-panel" aria-label="Now playing">
              <div className="selfmusic-player-topline"><span className="eyebrow small">NOW PLAYING</span><span className="selfmusic-player-status">{isBuffering ? <LoaderCircle className="spin" size={13} /> : <Volume2 size={13} />}{isBuffering ? 'Loading audio' : isPlaying ? 'Playing' : 'Ready'}</span></div>
              <div className="selfmusic-player-main">
                <div className="selfmusic-cover">
                  {artworkUrl && !artworkFailed ? <img src={artworkUrl} alt="" onError={() => setArtworkFailed(true)} /> : <div className="selfmusic-cover-fallback"><Disc3 size={58} /><Music2 size={25} /></div>}
                  <span className="selfmusic-cover-glint" />
                </div>
                <div className="selfmusic-track-copy">
                  <span className="eyebrow small">{currentTrack?.album || 'PERSONAL LIBRARY'}</span>
                  <h2>{currentTrack?.title || 'Choose a track'}</h2>
                  <p>{currentTrack?.artist || 'Your music collection will appear here.'}</p>
                  {currentTrack?.genre ? <span className="selfmusic-genre">{currentTrack.genre}</span> : null}
                </div>
              </div>
              <div className="selfmusic-progress">
                <TVInput focusKey="SELFMUSIC-SEEK" data-tv-focus="true" type="range" min={0} max={Math.max(duration, 1)} step={1} value={Math.min(currentTime, Math.max(duration, 1))} onChange={(event) => { const next = Number(event.target.value); setCurrentTime(next); if (audioRef.current) audioRef.current.currentTime = next; }} aria-label="Seek in current track" />
                <div><span>{formatTime(currentTime)}</span><span>{formatTime(duration || currentTrack?.duration || 0)}</span></div>
              </div>
              <div className="selfmusic-player-controls">
                <TVButton focusKey="SELFMUSIC-SHUFFLE" className={'selfmusic-minor-control' + (shuffle ? ' is-active' : '')} data-tv-focus="true" onClick={() => setShuffle((value) => !value)} aria-label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}><Shuffle size={18} /></TVButton>
                <TVButton focusKey="SELFMUSIC-PREVIOUS" className="selfmusic-transport-button" data-tv-focus="true" onClick={() => skipTrack(-1)} aria-label="Previous track"><SkipBack size={22} fill="currentColor" /></TVButton>
                <TVButton focusKey="SELFMUSIC-PLAY" className="selfmusic-play-button" data-tv-focus="true" onClick={() => void togglePlayback()} aria-label={isPlaying ? 'Pause' : 'Play'}>{isBuffering ? <LoaderCircle className="spin" size={23} /> : isPlaying ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" />}</TVButton>
                <TVButton focusKey="SELFMUSIC-NEXT" className="selfmusic-transport-button" data-tv-focus="true" onClick={() => skipTrack(1)} aria-label="Next track"><SkipForward size={22} fill="currentColor" /></TVButton>
                <TVButton focusKey="SELFMUSIC-REPEAT" className={'selfmusic-minor-control' + (repeatMode !== 'off' ? ' is-active' : '')} data-tv-focus="true" onClick={() => setRepeatMode((mode) => mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off')} aria-label={'Repeat ' + repeatMode}>{repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}</TVButton>
              </div>
              <audio
                ref={audioRef}
                preload="metadata"
                onPlay={() => { setIsPlaying(true); setIsBuffering(false); }}
                onPause={() => setIsPlaying(false)}
                onWaiting={() => setIsBuffering(true)}
                onCanPlay={() => setIsBuffering(false)}
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || currentTrack?.duration || 0)}
                onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                onEnded={handleEnded}
                onError={() => { setIsBuffering(false); setIsPlaying(false); setLoadError('Audio could not be played. Check the SelfMusic server connection and try the track again.'); }}
              />
              {loadError ? <p className="selfmusic-error selfmusic-player-error" role="alert"><AlertCircle size={16} />{loadError}</p> : null}
            </section>

            <section className="selfmusic-library glass-panel">
              <header className="selfmusic-library-header">
                <div><span className="eyebrow small">YOUR COLLECTION</span><h2>{activePlaylistId ? (playlists.find((playlist) => playlist.id === activePlaylistId)?.name || 'Playlist') : scope === 'favorites' ? 'Favorites' : 'Music library'} <span>{visibleTracks.length.toLocaleString()}</span></h2></div>
                <label className="selfmusic-search"><Search size={17} /><TVInput focusKey="SELFMUSIC-SEARCH" data-tv-focus="true" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tracks, artists…" aria-label="Search SelfMusic library" /></label>
              </header>
              <div className="selfmusic-library-tabs">
                <TVButton focusKey="SELFMUSIC-TAB-LIBRARY" className={'selfmusic-filter-tab' + (scope === 'library' && !activePlaylistId ? ' is-active' : '')} data-tv-focus="true" onClick={() => { setScope('library'); setActivePlaylistId(''); setPlaylistTrackIds([]); }}><Library size={15} /> All tracks</TVButton>
                <TVButton focusKey="SELFMUSIC-TAB-FAVORITES" className={'selfmusic-filter-tab' + (scope === 'favorites' ? ' is-active' : '')} data-tv-focus="true" onClick={() => { setScope('favorites'); setActivePlaylistId(''); setPlaylistTrackIds([]); }}><Heart size={15} /> Favorites <span>{favoriteIds.length}</span></TVButton>
                <span className="selfmusic-playlist-count"><ListMusic size={15} /> {playlists.length} playlists</span>
              </div>
              <form className="selfmusic-playlist-create" onSubmit={(event) => { event.preventDefault(); void createPlaylist(); }}>
                <TVInput focusKey="SELFMUSIC-NEW-PLAYLIST" data-tv-focus="true" value={playlistNameDraft} onChange={(event) => setPlaylistNameDraft(event.target.value)} placeholder="New playlist name…" aria-label="New playlist name" maxLength={100} />
                <TVButton focusKey="SELFMUSIC-CREATE-PLAYLIST" className="selfmusic-create-playlist-button" data-tv-focus="true" type="submit" disabled={playlistCreating || !playlistNameDraft.trim()}>{playlistCreating ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Create playlist</TVButton>
              </form>
              {playlists.length ? <div className="selfmusic-playlist-strip" aria-label="Your playlists">{playlists.map((playlist) => <TVButton key={playlist.id} focusKey={'SELFMUSIC-PLAYLIST-' + playlist.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)} className={'selfmusic-playlist-chip' + (activePlaylistId === playlist.id ? ' is-active' : '')} data-tv-focus="true" onClick={() => void openPlaylist(playlist)} title={'Open playlist ' + playlist.name} aria-pressed={activePlaylistId === playlist.id}><ListMusic size={13} /><span>{playlist.name}</span><small>{playlist.trackCount}</small></TVButton>)}</div> : null}
              <div className="selfmusic-track-list" role="list" aria-label="Music tracks">
                {loadingLibrary ? <div className="selfmusic-empty"><LoaderCircle className="spin" size={22} /><strong>Loading your library…</strong></div>
                  : visibleTracks.length ? visibleTracks.slice(0, 400).map((track, index) => {
                    const ticket = imageTickets[track.id];
                    const imageUrl = ticket ? normalizedUrl + '/api/artwork/' + encodeURIComponent(track.id) + '?ticket=' + encodeURIComponent(ticket) : '';
                    const favorite = favoriteIds.includes(track.id);
                    return (
                      <div className="selfmusic-track-row-wrap" key={track.id}>
                        <div className={'selfmusic-track-row' + (track.id === currentTrackId ? ' is-current' : '')} role="listitem">
                          <TVButton focusKey={'SELFMUSIC-TRACK-' + track.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)} className="selfmusic-track-select" data-tv-focus="true" onClick={() => void playTrack(track)} aria-label={'Play ' + track.title}>
                            <span className="selfmusic-track-number">{busyTrackId === track.id ? <LoaderCircle className="spin" size={17} /> : track.id === currentTrackId && isPlaying ? <Volume2 size={16} /> : String(index + 1).padStart(2, '0')}</span>
                            <span className="selfmusic-track-thumb">{imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <Music2 size={18} />}</span>
                            <span className="selfmusic-track-row-copy"><strong>{track.title}</strong><small>{track.artist}{track.album ? ' · ' + track.album : ''}</small></span>
                            <span className="selfmusic-track-length">{formatTime(track.duration)}</span>
                          </TVButton>
                          <TVButton focusKey={'SELFMUSIC-FAVORITE-' + track.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 55)} className={'selfmusic-favorite-button' + (favorite ? ' is-favorite' : '')} data-tv-focus="true" disabled={favoriteBusyId === track.id} onClick={() => void toggleFavorite(track)} aria-label={favorite ? 'Remove ' + track.title + ' from favorites' : 'Add ' + track.title + ' to favorites'}>{favoriteBusyId === track.id ? <LoaderCircle className="spin" size={15} /> : <Heart size={16} fill={favorite ? 'currentColor' : 'none'} />}</TVButton>
                          <TVButton focusKey={'SELFMUSIC-ADD-TO-PLAYLIST-' + track.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50)} className="selfmusic-add-playlist-button" data-tv-focus="true" onClick={() => setPlaylistPickerTrackId((current) => current === track.id ? '' : track.id)} aria-label={'Add ' + track.title + ' to a playlist'} aria-expanded={playlistPickerTrackId === track.id}><ListPlus size={16} /></TVButton>
                        </div>
                        {playlistPickerTrackId === track.id ? (
                          <div className="selfmusic-playlist-picker glass-panel" role="group" aria-label={'Choose a playlist for ' + track.title}>
                            <div className="selfmusic-playlist-picker-heading"><span>Add to playlist</span><TVButton className="selfmusic-picker-close" data-tv-focus="true" onClick={() => setPlaylistPickerTrackId('')} aria-label="Close playlist picker"><X size={14} /></TVButton></div>
                            {playlists.length ? playlists.map((playlist) => {
                              const actionKey = track.id + ':' + playlist.id;
                              return <TVButton key={playlist.id} focusKey={'SELFMUSIC-ADD-' + track.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 36) + '-' + playlist.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)} className="selfmusic-playlist-choice" data-tv-focus="true" disabled={playlistActionKey === actionKey} onClick={() => void addTrackToPlaylist(playlist, track)}>{playlistActionKey === actionKey ? <LoaderCircle className="spin" size={14} /> : <ListMusic size={14} />}<span>{playlist.name}</span></TVButton>;
                            }) : <span className="selfmusic-playlist-picker-empty">Create a playlist above, then add tracks here.</span>}
                          </div>
                        ) : null}
                      </div>
                    );
                  }) : <div className="selfmusic-empty"><Music2 size={25} /><strong>{activePlaylistId ? 'This playlist is empty' : scope === 'favorites' ? 'No favorites yet' : query ? 'No matches' : 'Your library is empty'}</strong><span>{activePlaylistId ? 'This playlist has no tracks in the current library.' : scope === 'favorites' ? 'Mark tracks with the heart to find them here.' : 'Add music to your SelfMusic server and refresh the library.'}</span></div>}
                {visibleTracks.length > 400 ? <p className="selfmusic-list-limit">Showing the first 400 matches for smooth TV navigation.</p> : null}
              </div>
              <footer className="selfmusic-library-footer">
                <span>{tracks.length.toLocaleString()} tracks · {favoriteIds.length.toLocaleString()} favorites</span>
                <TVButton focusKey="SELFMUSIC-REFRESH" className="selfmusic-refresh-button" data-tv-focus="true" disabled={loadingLibrary} onClick={() => void loadLibrary(accessToken)}><LoaderCircle className={loadingLibrary ? 'spin' : ''} size={15} /> Refresh library</TVButton>
              </footer>
            </section>
          </div>
          {statusMessage ? <p className="selfmusic-status-line" role="status">{statusMessage}</p> : null}
          <div className="selfmusic-session-footer"><span className="selfmusic-live-dot" /> Connected · signed one-hour token kept in memory <TVButton className="selfmusic-signout-link" data-tv-focus="true" onClick={handleSignOut}><LogOut size={14} /> Sign out</TVButton></div>
        </>
      )}
    </div>
  );
}

export default SelfMusicPanel;
