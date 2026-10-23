import type { TVSettings } from './types';

/**
 * First-launch defaults for B1O TV.
 * Never place bearer tokens or other secrets in a public frontend bundle:
 * the installed WGT and source files can be inspected. Configure aiToken in
 * Settings or provide it through a protected authentication flow instead.
 */
export const DEFAULT_CONFIG: TVSettings = {
  city: 'North Hollywood',
  reduceMotion: false,
  adaptiveScenery: false,
  glassIntensity: 100,
  aiEndpoint: 'https://b1o-tv-assistant.collab-docs-b1o.workers.dev',
  aiToken: '',
  jellyfinUrl: '',
  selfMusicUrl: '',
  speakReplies: false,
  wallpaper: 'wallhaven',
  temperatureUnit: 'C',
};
