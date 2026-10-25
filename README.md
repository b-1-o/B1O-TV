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

Requirements: Node.js 20+ and npm for the browser preview. For a real TV, start with the AI-assisted installer in `PROMPT.md` and enable Developer Mode; Apps2Samsung is the recommended local signing and installation tool. Tizen Studio remains an advanced alternative.

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

**Recommended: AI-assisted installation.** Open [`PROMPT.md`](PROMPT.md) in Claude Code, Codex, Gemini CLI, or another agent with terminal access. It follows [the AI installation playbook](docs/AI-INSTALL.md), checks the environment, builds an unsigned WGT when source is available, and guides installation of B1O TV plus TizenTube when needed. The recommended companion tool is the official [Apps2Samsung desktop installer](https://github.com/Apps2Samsung/Apps2Samsung/releases), which can discover Samsung TVs, manage local signing, and install community apps.

Samsung Tizen is not Android TV: CleanYourTV's Android/ADB debloating workflow does not apply to Samsung Tizen and cannot replace Samsung's system Home screen. B1O TV is a regular Tizen app. The setup flow does not disable system apps or change firmware.

Read the English [installation guide](docs/INSTALL.md), [AI installation playbook](docs/AI-INSTALL.md), [TV setup and test guide](docs/TV-SETUP.md), and [TV performance guide](docs/PERFORMANCE.md). The advanced Tizen Studio deployment helper remains available as `npm run deploy:tizen -- <TV_IP>:26101`; set your own certificate profile and tools path. Release WGT files are unsigned: import them into a supported local signing installer such as Apps2Samsung, or sign them with your own Tizen Studio certificate before installing.

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
docs/                        English installation, AI setup, performance, and roadmap guides
scripts/                     TV diagnostics, WGT packaging, deployment, and asset optimization
PROMPT.md                    Copy-paste AI-assisted installation prompt
AGENTS.md                    Shared instructions for coding agents
```

See [AI-INSTALL.md](docs/AI-INSTALL.md), [ROADMAP.md](docs/ROADMAP.md), [TV-SETUP.md](docs/TV-SETUP.md), [PERFORMANCE.md](docs/PERFORMANCE.md), and [the Worker guide](worker/README.md).
