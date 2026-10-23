export type View = 'home' | 'apps' | 'library' | 'settings';

export type AppTarget = 'youtube' | 'jellyfin' | 'selfmusic' | 'browser' | 'assistant';

export interface TVApp {
  id: AppTarget;
  name: string;
  subtitle: string;
  category: string;
  symbol: string;
  target: AppTarget;
}

export interface InstalledTVApp {
  id: string;
  name: string;
  iconPath?: string;
  version?: string;
}

export interface TVSettings {
  city: string;
  reduceMotion: boolean;
  glassIntensity: number;
  aiEndpoint: string;
  aiToken: string;
  jellyfinUrl: string;
  selfMusicUrl: string;
  speakReplies: boolean;
  wallpaper: string;
  temperatureUnit: 'F' | 'C';
}

export interface WeatherDay {
  date: string;
  code: number;
  highF: number;
  lowF: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherSnapshot {
  city: string;
  temperatureF: number;
  code: number;
  isDay: boolean;
  forecast: WeatherDay[];
}

export interface ActiveTimer {
  endAt: number;
  label: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}