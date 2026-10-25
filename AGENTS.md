# Agent instructions for B1O TV

## Project contract

- This repository is a React + TypeScript web application packaged for Samsung Smart TV on Tizen.
- The app requires Tizen 6.0 or later according to `public/config.xml`.
- Keep `B1Otv00001.B1web` and package ID `B1Otv00001` stable for normal upgrades.
- B1O TV is an app, not a system launcher. Never attempt to replace Samsung Home or disable system applications.
- Project documentation and prompts must be written in English.
- TizenTube is a separate third-party app. Do not bundle its binaries or claim it is installed by the B1O TV build; use its official project and a supported local installer.

## Working rules

- Read the relevant documentation and inspect `git status --short` before changing code.
- Preserve local user edits, secrets, certificates, service endpoints, settings exports, and signing profiles.
- Never put credentials into source code, examples, build output, screenshots, or Git history.
- The generated `B1O-TV-unsigned.wgt` is a ZIP-format web package without Samsung signatures. It must be locally signed by a supported installer before installation; do not send it directly to SDB.
- Prefer official project release pages for external installers and companion apps. Verify the selected asset matches the host OS and Samsung Tizen target.
- Avoid destructive steps. Never factory-reset the TV, disable system apps, change router/DNS settings, or uninstall an existing app as a troubleshooting shortcut.
- Any new TV behavior should remain usable with the remote, pause unnecessary work while hidden, and preserve the monochrome Liquid Glass design.

## Validate code changes

Run:

```sh
npm install --no-audit --no-fund
npm run typecheck
npm run typecheck:assistant
npm run lint
npm test
npm run package:tizen-web
```

The package build requires ImageMagick. The generated unsigned WGT is written to `release-tizen/B1O-TV-unsigned.wgt`. CI validates the package structure, but it does not prove remote-control behavior or playback on a real TV.

## Installation task

For an end-to-end install, follow [PROMPT.md](PROMPT.md) and [docs/AI-INSTALL.md](docs/AI-INSTALL.md). Pause for owner-only confirmation when Developer Mode, Samsung sign-in, a certificate, or a device authorization prompt requires user interaction.
