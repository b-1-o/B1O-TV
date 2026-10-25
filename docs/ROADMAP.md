# B1O TV Roadmap

B1O TV is a remote-first, monochrome media home for Samsung Smart TVs running Tizen. The roadmap favors reliable navigation, quick startup, and useful personal-media workflows over visual effects that consume TV memory.

## Shipped in the current development line

- Home dashboard with clock, weather, forecast, wallpaper selection, and a compact media dock.
- Neutral translucent-glass surfaces with a readable remote focus state.
- Tizen app discovery and launching where the TV exposes the required APIs.
- Embedded SelfMusic player with account sign-in, playlists, favorites, playback, and cover art.
- Jellyfin API integration for a user-specific Continue Watching rail and playback progress.
- Optional Cloudflare Workers AI assistant with local notes, timers, app-launch intents, and a protected speech-transcription endpoint.
- English setup guides and a CI/release workflow.
- Visibility-aware work scheduling: weather/Jellyfin polling and clock/timer intervals stop while B1O TV is hidden; embedded SelfMusic playback pauses when the app is hidden.
- Predictable Back behavior: close the topmost surface first, return to Home from a page, and confirm exit from Home.

## Next priorities

### 1. Remote-control acceptance

- Exercise every dock item, every settings control, each modal, and every Home card using only the physical Samsung remote.
- Verify ArrowDown enters the dock only at the end of a visible content column and ArrowUp restores the last focused item.
- Test Back/Escape, Enter, long lists, disabled controls, native select menus, and text editing in settings.
- Keep reproducible unit tests for key normalization and focus-boundary decisions; hardware validation is still required for each Tizen firmware family.

### 2. Performance and lifecycle

- Test a 30–60 minute session, opening and closing settings, switching to another TV app, and resuming B1O TV.
- Inspect TV logs for memory growth, audio capture that remains active, repeated network requests, and focus loss.
- Keep infinite animations, live blur, video backgrounds, and unnecessary polling off in the TV runtime.
- Respect Tizen's lifecycle and avoid trying to terminate other installed/system apps from B1O TV.

### 3. Personal media features

- Add a unified Resume Hub that can restore the last SelfMusic track or playlist alongside Jellyfin Continue Watching.
- Add Jellyfin playback position refresh and a clear "last synced" state.
- Add a small universal search across Jellyfin and SelfMusic only where supported APIs make the results reliable.
- Consider optional home-server health cards for Jellyfin, SelfMusic, and the AI Worker without blocking startup.

### 4. Public release quality

- Keep README, installation instructions, release notes, issue templates, and changelog in English.
- Publish an unsigned TV web-project archive with each version; users sign their own WGT with their own certificate.
- Attach verified screenshots from a real TV and a short remote-navigation recording before promoting a stable release.
- Document supported Tizen versions, known limitations, privacy behavior, and reproducible bug reports.

## Engineering rules

- Never put provider keys or private certificates in the frontend bundle.
- Do not promise that Tizen can replace the system Home screen, force-close arbitrary apps, or show notifications while the app is suspended.
- Every visible action must be reachable from the remote and have a clear selected state.
- Network failures must leave the interface navigable.
- Test TypeScript, Worker configuration, lint, unit tests, and production build before publishing.
