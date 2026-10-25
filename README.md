# B1O TV

[![CI](https://github.com/b-1-o/B1web/actions/workflows/ci.yml/badge.svg)](https://github.com/b-1-o/B1web/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/b-1-o/B1web?style=social)](https://github.com/b-1-o/B1web/stargazers)

**A remote-first, monochrome media dashboard for Samsung Smart TVs running Tizen.**

B1O TV combines a calm translucent-glass home screen, weather, Jellyfin Continue Watching, an embedded SelfMusic player, and an optional AI assistant. It is a regular TV app, not a replacement for Samsung's system Home screen.

## Why B1O TV?

- **Designed for the TV remote:** visible focus, predictable dock navigation, modal boundaries, and a Back flow that closes the topmost surface first.
- **Neutral Liquid Glass:** translucent grayscale materials with white focus outlines, rather than opaque blue selection blocks.
- **Personal media home:** resume unfinished videos from Jellyfin and browse/play music through SelfMusic without leaving the shell.
- **Optional local-first controls:** notes, timers, clock queries, and supported app launches work inside the TV app; general questions can use a private Cloudflare Worker.
- **TV-aware lifecycle:** stops its own weather/Jellyfin refresh loops while hidden, pauses embedded SelfMusic playback, and avoids expensive backdrop blur on Tizen.
- **Privacy-conscious setup:** model API keys stay on the server; personal service credentials are configured on-device.

## Features

- Home screen with clock, weather, forecast, and selectable wallpapers.
- Installed Tizen app discovery and launch where allowed by the TV firmware.
- Jellyfin Continue Watching rail with posters and progress.
- Built-in SelfMusic integration for playlists, favorites, and audio playback.
- Text/voice AI assistant with local notes, timers, and supported launch intents.
- TV setup import/export and automatic settings persistence.
- Reduced-motion support and a simplified low-cost Tizen rendering path.

## Quick start

Requirements: Node.js 20+, npm, and (for a real TV) Tizen Studio, Samsung TV Extension, a certificate profile, and Developer Mode.

```sh
git clone https://github.com/b-1-o/B1web.git
cd B1web
npm install
npm run dev
```

Open `http://localhost:5173` for a browser preview. The preview is useful for UI checks but cannot validate native Samsung APIs or actual remote behavior.

Before installing on a TV, run the full checks:

```sh
npm run typecheck
npm run typecheck:assistant
npm run lint
npm test
npm run build
```

## Install on Samsung Tizen

Read the English [installation guide](docs/INSTALL.md), [TV setup and test guide](docs/TV-SETUP.md), and [TV performance guide](docs/PERFORMANCE.md). The deployment helper is available as `npm run deploy:tizen -- <TV_IP>:26101`; review `scripts/deploy-tizen-tv.sh` and set your own certificate profile/tools paths. A web-project archive is not a signed `.wgt`. Each user must sign a TV package with their own Samsung certificate.

## Configure Jellyfin

1. Open Jellyfin Dashboard → **Advanced → API Keys** and create a dedicated key for B1O TV.
2. In B1O TV, open **Settings → Media Services** and enter the base URL, such as `http://192.168.1.10:8096` for a private LAN server.
3. Paste the key into **Jellyfin API key**, choose **Connect to Jellyfin**, and select the viewing-history user.
4. Return Home. The Continue Watching rail will show unfinished videos for the selected user. Selecting an item opens Jellyfin Web details; use Resume/Play there.

For public servers, use HTTPS. HTTP is allowed only for private/local network addresses. API keys are saved in this app's local settings and included in exported setup JSON, so keep exports private and revoke any exposed key from the Jellyfin Dashboard.

## Configure the AI assistant

The TV frontend contains no model-provider API key. Deploy the Worker and set `ASSISTANT_TOKEN` as a Cloudflare secret:

```sh
npx wrangler login
openssl rand -hex 32
npx wrangler secret put ASSISTANT_TOKEN --config worker/wrangler.toml
npx wrangler deploy --config worker/wrangler.toml
```

Enter the Worker origin (or `/api/assistant` endpoint) and the same device token in **Settings → AI & Voice**. Press **Check AI Connection** before testing voice. Read [worker/README.md](worker/README.md) for the API contract and security notes.

## Releases

Visit [GitHub Releases](https://github.com/b-1-o/B1web/releases) for packaged builds. Release archives contain the TV web project, not a certificate-signed WGT. Sign the app with your own Samsung TV certificate before installation. To publish a release, open **Actions → Publish Release**, run the workflow with a semantic version such as `0.4.0`, and check the generated release notes and archive.

## Performance and platform limits

- The manifest disables Tizen background support for B1O TV; the app also pauses its own polling and embedded audio when hidden.
- Tizen manages the lifecycle of other apps and system services. B1O TV does not attempt to terminate Samsung system apps.
- B1O TV cannot replace the system Home screen or freely change system TV settings.
- Timers are not system alarms and cannot guarantee notifications while the app is suspended or closed.
- Voice recording, app discovery, app launch, and deep links depend on TV model, firmware, privileges, and installed app IDs.
- A physical-remote pass on the target television remains required even when automated tests pass.

## Project structure

```text
src/
  App.tsx                    Screen state and TV-first behavior
  components/tv/             Focusable controls and SelfMusic player
  platform/                  Tizen APIs, lifecycle, and remote-key rules
  services/                  AI assistant, Jellyfin API, and weather
  styles.css                 Grayscale glass materials and TV runtime styling
worker/                      Cloudflare Workers AI backend
docs/                        English installation, setup, and roadmap
scripts/                     Tizen packaging and asset optimization
```

See [ROADMAP.md](docs/ROADMAP.md), [TV-SETUP.md](docs/TV-SETUP.md), [PERFORMANCE.md](docs/PERFORMANCE.md), and [the Worker guide](worker/README.md).
