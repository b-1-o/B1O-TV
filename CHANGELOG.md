# Changelog

## Unreleased

- Add an AI-agent installation playbook for Samsung Tizen TVs.
- Package an unsigned WGT for local signing through a supported installer.
- Add non-destructive TV/tool diagnostics and include the AI install prompt in release artifacts.


Notable changes are documented here for each public version.

## 0.4.0 — 2026-10-25

### Added
- Jellyfin Continue Watching on Home, including user selection, posters, and playback progress.
- A repeatable remote-key test suite and predictable Back/exit-confirmation behavior.
- Visibility-aware scheduling for clock, timers, weather, and Jellyfin; embedded SelfMusic playback pauses when the app is hidden.
- English-only installation and TV setup guides, release automation, and contribution templates.

### Improved
- Neutral grayscale Liquid Glass surfaces and a less expensive Tizen rendering path.
- Portable Tizen deployment: an explicit TV address is required instead of a personal LAN default.
- Public project metadata, setup docs, and reproducible quality checks.

### Notes
- The release archive is the unsigned TV web project. Users must sign their own WGT with their own Samsung TV certificate.
- Voice capture and native app launching depend on the target TV firmware and installed app IDs.
