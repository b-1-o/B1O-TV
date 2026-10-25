# B1O TV

**B1O TV** is a personal media dashboard for Samsung Smart TVs running Tizen. It is a regular installable TV application, not a replacement operating system or system-level Home launcher.

The goal is a calm, monochrome, translucent-glass home screen for a personal media setup: clock, weather, TV apps, Jellyfin, the built-in SelfMusic player, and a voice/text AI assistant.

## Features

- **TV-first navigation:** directional remote controls, focusable buttons, Enter/Back handling, and a bottom dock.
- **Neutral Liquid Glass UI:** translucent grayscale surfaces, wallpaper-led atmosphere, and remote focus styling that does not turn selected cards into blue blocks.
- **Home dashboard:** clock, date, current weather, and a seven-day forecast.
- **App catalog:** featured services and installed-app discovery/launch where supported by Tizen.
- **Media:** Jellyfin launch, a Continue Watching rail loaded from the Jellyfin API, and an embedded SelfMusic player.
- **AI assistant:** text chat through Cloudflare Workers AI, local notes, timers, time queries, and supported app-launch commands.
- **Voice input:** browser speech recognition or TV microphone recording with the protected Worker transcription endpoint, if the firmware exposes these capabilities.
- **Personal settings:** wallpapers, city, temperature units, adaptive scenery, reduced motion, server URLs, AI endpoint, and device token.
- **Setup transfer:** export/import settings as a JSON file.
- **TV performance path:** avoids expensive live backdrop blur in the Tizen runtime and supports reduced motion.

## Requirements

- Node.js 20+ and npm.
- For a real Samsung TV: Tizen Studio, a TV certificate profile, Developer Mode, and a reachable TV on your local network.
- For AI responses and speech transcription: a deployed Cloudflare Worker with a Workers AI binding and an ASSISTANT_TOKEN secret.
- For media playback: reachable Jellyfin and/or SelfMusic servers.

## Run locally

```sh
npm install
npm run dev
```

Checks and production build:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

The browser preview is useful for UI checks. Native Tizen app discovery, app launching, and TV microphone behavior must be tested on the actual television.

## Install on Samsung Tizen

1. Follow the detailed [Russian installation guide](docs/INSTALL-RU.md) for Developer Mode, certificates, device connection, signing, and WGT installation.
2. Review [TV setup notes](docs/TV-SETUP.md).
3. Build with `npm run build`.
4. Package and sign the app in Tizen Studio with your own Samsung TV certificate profile. A production web-build archive is not itself a signed `.wgt`.
5. Verify remote navigation, Enter/Back, app discovery, weather, media connectivity, and voice behavior on the TV.

The helper is available via `npm run deploy:tizen`. Review `scripts/deploy-tizen-tv.sh` first and make sure its device address and certificate setup match your environment.

## Configure the AI assistant

The frontend does not contain model-provider API keys. The Worker uses the Cloudflare Workers AI binding.

1. Read [the Worker README](worker/README.md).
2. Deploy from the repository root:

   ```sh
   npx wrangler login
   npx wrangler deploy --config worker/wrangler.toml
   ```

3. Generate a private device token and set it as a Worker secret:

   ```sh
   openssl rand -hex 32
   npx wrangler secret put ASSISTANT_TOKEN --config worker/wrangler.toml
   ```

   Paste the generated value when Wrangler asks for the secret. Never commit or publish it.

4. On B1O TV, open **Settings → AI & Voice**, enter the Worker origin (or full `/api/assistant` URL), and paste the same token into **Device token**.
5. Use **Check AI Connection** to test the authenticated endpoint and get a real model response. This makes a small AI request.
6. Use **Test Voice Assistant** separately: a working text connection does not guarantee microphone capture or speech synthesis on the TV.

The default model in `worker/wrangler.toml` is `@cf/zai-org/glm-4.7-flash`. The Worker exposes `/health`, `/api/assistant`, and `/api/transcribe`. AI answers may be wrong. The assistant does not remotely change system TV settings; local notes, timers, and supported app launches are handled by the TV app.

## Configure Jellyfin and SelfMusic

Open **Settings → Media Services** and enter the addresses reachable by the TV. For Jellyfin, enter the server URL, create an API key in **Dashboard → Advanced → API Keys**, paste it into the Jellyfin API key field inside B1O TV, then press **Connect to Jellyfin** and choose the user whose viewing progress should be displayed. The Home screen then loads that user's Continue Watching list. Selecting a card opens the item's details page in Jellyfin Web, where you can choose Resume/Play. Never send the API key in chat or commit it to source control.

- Use HTTPS for public endpoints.
- HTTP is accepted by the app only for local/private network addresses, such as a LAN host or private Tailscale address.
- A Jellyfin URL can look like `http://192.168.1.10:8096`.
- For SelfMusic, use the exact server origin displayed in the embedded player. If required by your server's policy, add that origin to `SELF_MUSIC_ALLOWED_ORIGINS` in its private environment file.

Do not expose personal media services to the public internet without appropriate access controls. Keep server credentials private.

## Project structure

```text
src/
  App.tsx                    Main TV interface and screen-level behavior
  components/tv/             Focusable TV controls and SelfMusic panel
  contexts/                  Theme context
  platform/                  Tizen APIs and remote-key navigation
  services/                  Assistant intents, AI client, and weather
  styles.css                 Responsive UI, glass materials, TV-specific styles
worker/
  src/index.ts               Cloudflare AI and transcription API
  wrangler.toml              Worker and AI model configuration
docs/
  INSTALL-RU.md              Russian Samsung TV installation guide
  TV-SETUP.md                TV API and configuration notes
  ROADMAP.md                 Implementation roadmap
scripts/
  deploy-tizen-tv.sh         Tizen packaging/deployment helper
  optimize-tv-assets.mjs     Production asset optimization
```

## Known limitations

- **No system launcher replacement:** Tizen applications cannot replace Samsung's system Home screen or freely access every TV setting.
- **App discovery/launch:** depends on Tizen APIs, app privileges, and installed application IDs.
- **Microphone:** Samsung firmware may reserve the microphone key or deny recording access. Test voice input on the actual TV.
- **Timers:** timers work while the app is active; background alarms or notifications are not guaranteed after it closes or is unloaded.
- **API keys and AI security:** the Jellyfin API key and AI device token are stored in this TV app's local settings. Anyone who extracts either credential may be able to use the associated service. Keep exported setup files private, revoke exposed Jellyfin keys in the Dashboard, rotate exposed AI tokens, and configure Cloudflare rate limits/usage alerts.
- **Local notes:** stored in this app's local storage, not synced to a cloud database.
- **YouTube:** B1O TV may launch an installed compatible third-party client; it does not remove ads from the official YouTube app.
- **Real-TV verification:** a passing browser build does not prove every Tizen API works on every firmware version.

## Release checklist

- [ ] Verify all remote-navigation paths on the target Samsung TV.
- [ ] Confirm real app IDs for Jellyfin and the preferred YouTube client.
- [ ] Run **Check AI Connection** using the deployed Worker and device token.
- [ ] Test voice capture and speech synthesis on the target firmware.
- [ ] Measure memory and navigation responsiveness during extended use.
- [ ] Verify Jellyfin/SelfMusic connectivity over LAN and private Tailscale access.

See the [roadmap](docs/ROADMAP.md), [TV setup notes](docs/TV-SETUP.md), and [Worker documentation](worker/README.md).
