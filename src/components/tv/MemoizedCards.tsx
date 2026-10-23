import { memo, useCallback, type CSSProperties } from 'react';
import { ArrowRight, Check, Film, Grid2X2, Music2, Play, Sparkles } from 'lucide-react';
import type { AppTarget, InstalledTVApp, TVApp } from '../../types';
import { FocusableCard } from './FocusableCard';
import { TVButton } from './FocusableControls';

type AppLauncher = (target: AppTarget) => unknown;

export const AppSymbol = memo(function AppSymbol({ app }: { app: TVApp }) {
  const className = 'app-symbol app-symbol-' + app.id;
  return (
    <span className={className} aria-hidden="true">
      {app.id === 'jellyfin' ? <Film /> : app.id === 'selfmusic' ? <Music2 /> : app.id === 'browser' ? <Grid2X2 /> : <Play />}
    </span>
  );
});

export const FeaturedAppCard = memo(function FeaturedAppCard({
  app,
  index,
  onLaunch,
}: {
  app: TVApp;
  index: number;
  onLaunch: AppLauncher;
}) {
  const handleSelect = useCallback(() => {
    void onLaunch(app.target);
  }, [app.target, onLaunch]);

  return (
    <FocusableCard
      id={app.id}
      title={app.name}
      className={'featured-card glass-panel card-' + app.id}
      data-tv-focus="true"
      onSelect={handleSelect}
    >
      <div className="card-cardinal"><span>0{index + 1}</span><ArrowRight size={16} /></div>
      <AppSymbol app={app} />
      <div className="featured-card-text"><strong>{app.name}</strong><span>{app.subtitle}</span></div>
    </FocusableCard>
  );
});

export const AssistantFeaturedCard = memo(function AssistantFeaturedCard({ onOpen }: { onOpen: () => void }) {
  return (
    <FocusableCard
      id="assistant"
      title="AI Assistant"
      className="featured-card assistant-card glass-panel"
      data-tv-focus="true"
      onSelect={onOpen}
    >
      <div className="card-cardinal"><span>04</span><Sparkles size={16} /></div>
      <span className="app-symbol app-symbol-assistant"><Sparkles /></span>
      <div className="featured-card-text"><strong>AI Assistant</strong><span>Answers, timers, and voice control</span></div>
    </FocusableCard>
  );
});

export const CatalogAppCard = memo(function CatalogAppCard({
  app,
  onLaunch,
}: {
  app: TVApp;
  onLaunch: AppLauncher;
}) {
  const handleSelect = useCallback(() => {
    void onLaunch(app.target);
  }, [app.target, onLaunch]);

  return (
    <TVButton
      focusKey={'CATALOG-' + app.id}
      className={'catalog-card glass-panel card-' + app.id}
      data-tv-focus="true"
      onClick={handleSelect}
    >
      <AppSymbol app={app} />
      <strong>{app.name}</strong>
      <span>{app.subtitle}</span>
      <div className="catalog-card-footer">{app.category}<ArrowRight size={16} /></div>
    </TVButton>
  );
});

export const InstalledAppRow = memo(function InstalledAppRow({
  app,
  onSelect,
}: {
  app: InstalledTVApp;
  onSelect: (appId: string) => void;
}) {
  const handleSelect = useCallback(() => onSelect(app.id), [app.id, onSelect]);

  return (
    <TVButton
      focusKey={'INSTALLED-' + app.id}
      className="installed-row glass-panel"
      data-tv-focus="true"
      onClick={handleSelect}
    >
      <span className="installed-icon"><Grid2X2 /></span>
      <span><strong>{app.name}</strong><small>{app.id}{app.version ? ' · v' + app.version : ''}</small></span>
      <ArrowRight size={17} />
    </TVButton>
  );
});

export const HomeInstalledAppCard = memo(function HomeInstalledAppCard({
  app,
  onSelect,
  preview = false,
}: {
  app: InstalledTVApp;
  onSelect: (appId: string) => void;
  preview?: boolean;
}) {
  const handleSelect = useCallback(() => onSelect(app.id), [app.id, onSelect]);
  const iconUrl = app.iconPath?.startsWith('/') ? 'file://' + app.iconPath : app.iconPath;

  return (
    <TVButton
      focusKey={'HOME-INSTALLED-' + app.id}
      className="home-installed-app"
      data-tv-focus="true"
      aria-label={'Open ' + app.name}
      onClick={handleSelect}
    >
      <span className="home-app-icon" aria-hidden="true">
        <Grid2X2 className="home-app-fallback" />
        {iconUrl ? <img src={iconUrl} alt="" draggable={false} onError={(event) => { event.currentTarget.style.display = 'none'; }} /> : null}
      </span>
      <span className="home-app-copy"><strong>{app.name}</strong><small>{preview ? "Preview only" : "Installed on TV"}</small></span>
      <ArrowRight size={17} />
    </TVButton>
  );
});

export interface WallpaperCardData {
  id: string;
  name: string;
  src: string;
}

export const WallpaperChoiceCard = memo(function WallpaperChoiceCard({
  wallpaper,
  isSelected,
  onChoose,
}: {
  wallpaper: WallpaperCardData;
  isSelected: boolean;
  onChoose: (wallpaperId: string) => void;
}) {
  const handleChoose = useCallback(() => onChoose(wallpaper.id), [onChoose, wallpaper.id]);

  return (
    <TVButton
      className={'wallpaper-choice' + (isSelected ? ' selected' : '')}
      focusKey={'WALLPAPER-' + wallpaper.id}
      data-tv-focus="true"
      aria-pressed={isSelected}
      aria-label={'Choose wallpaper: ' + wallpaper.name}
      style={{ '--wallpaper-thumb': `url("${wallpaper.src}")` } as CSSProperties}
      onClick={handleChoose}
    >
      <span className="wallpaper-choice-check" aria-hidden="true">{isSelected ? <Check size={17} /> : null}</span>
      <span className="wallpaper-choice-name">{wallpaper.name}</span>
    </TVButton>
  );
});
