# Install B1O TV on a Samsung Smart TV

B1O TV is a Tizen Web Application. The public web build is **not a signed WGT**: you must sign it with a Samsung TV certificate that is trusted by your television. Never share or commit your certificate or signing password.

## Requirements

- Node.js 20+ and npm.
- Samsung Tizen Studio, Samsung TV Extension, and Samsung Certificate Extension.
- A Samsung TV with Developer Mode enabled and reachable on the same local network.
- Your own Samsung TV certificate profile.
- ImageMagick for launcher-icon generation and asset optimization.
- Jellyfin and/or SelfMusic servers if you want personal media integration.

## Quick update on an already configured TV

From a terminal on the computer that has Tizen Studio and your certificate configured:

```sh
cd /path/to/B1web
git status --short
git pull --ff-only origin main
npm install
TIZEN_PROFILE="YourCertificateProfile" TIZEN_TOOLS="$HOME/tizen-studio/tools" npm run deploy:tizen -- 192.168.1.50:26101
```

Replace `/path/to/B1web`, the certificate profile, tools path, and example TV address with your own values. The address is `TV_IP:SDB_PORT`; Samsung TV commonly uses port `26101` in Developer Mode. The deployment script builds the web app, optimizes images, generates `icon.png`, signs the WGT with your selected profile, transfers it over SDB, installs it, and launches B1O TV.

Before pulling, inspect `git status --short`. Commit or back up local changes first. Do not run deployment with a guessed TV address or a certificate profile that does not belong to your setup.

If your Tizen Studio tools are installed elsewhere, set `TIZEN_TOOLS` to the directory containing `sdb` and `ide/bin/tizen`. You can also set `TIZEN_CLI` and `SDB_CLI` to explicit executable paths.

## 1. Install the Samsung tools

Use the official Samsung documentation:

- [Tizen Studio downloads](https://developer.tizen.org/development/tizen-studio/download?langredirect=1)
- [Samsung TV Extension](https://developer.samsung.com/smarttv/develop/tools/tv-extension/download.html?device=htv)
- [Install the TV SDK](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/installing-tv-sdk.html)
- [Create certificates](https://developer.samsung.com/smarttv/develop/getting-started/setting-up-sdk/creating-certificates.html)

In Tizen Studio Package Manager, install the Samsung TV Extension / TV Extension Tools and Samsung Certificate Extension. Use a supported desktop environment if the SDK cannot run on your Linux distribution; the TV package itself is independent of the host OS.

## 2. Create your certificate profile

1. Sign in to [Samsung Developer](https://developer.samsung.com/).
2. Open **Tools → Certificate Manager** in Tizen Studio.
3. Select **+ → Samsung → TV** and create a certificate profile.
4. Create both the Author and Distributor certificates. Select your TV/device ID (DUID) if the wizard requests it.
5. Save your certificate backup and password securely.

Updates to the same installed app must use the same author certificate. Never upload the certificate, private key, or password to GitHub.

## 3. Enable Developer Mode on the TV

The exact menu can differ by model and firmware. On many Samsung TVs:

1. Connect the TV and computer to the same home network.
2. Open **Home → Apps → Apps Settings**.
3. Use the on-screen numeric keypad to enter `12345`.
4. Set **Developer Mode** to **On**.
5. Enter the computer's local IPv4 address.
6. Confirm and restart the TV.

See Samsung's [TV Device guide](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html). If the TV's IP changes, update the Developer Mode address and restart the TV.

## 4. Build the web project

Clone the repository and build the app:

```sh
git clone https://github.com/b-1-o/B1web.git
cd B1web
npm install
npm run typecheck
npm run typecheck:assistant
npm run lint
npm test
npm run build
```

The production files are written to `dist/`. The build script optimizes assets and generates the square `icon.png`. Do not copy only `index.html`: the JavaScript, CSS, fonts, and images are also required.

## 5. Install with Tizen Studio

1. Open Tizen Studio and create a **TV / Web Application** project.
2. Copy the contents of `dist/` into the project root, keeping `index.html`, `config.xml`, `icon.png`, `icon.svg`, and `assets/` together.
3. Verify the manifest's application ID and package ID match the project. Keep them unchanged for updates to the same installation.
4. Select your Samsung TV certificate profile in Certificate Manager.
5. Open **Tools → Device Manager**, add the TV in Remote Device Manager, and enable **Connection**.
6. If required, use **Permit to install applications** on the connected device.
7. Choose **Run As → Tizen Web Application** to sign, install, and launch the app. Use **Build Package** to create a WGT file.

A WGT normally is installed over the network with Tizen Studio/SDB, not by opening it from a USB drive. See the [Samsung CLI guide](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html?device=htv).

## 6. Configure B1O TV

Open **Settings** on the TV:

- **Weather:** choose a city and temperature units.
- **Appearance:** choose a wallpaper and reduce motion.
- **Media Services:** enter the reachable Jellyfin and SelfMusic URLs.
- **Jellyfin API key:** create a key under Jellyfin **Dashboard → Advanced → API Keys**, paste it into the app, then select **Connect to Jellyfin** and choose the user's viewing progress.
- **AI & Voice:** enter your deployed Worker endpoint and the device token matching the Cloudflare secret `ASSISTANT_TOKEN`.

For public services use HTTPS. HTTP is only accepted for localhost/private LAN/Tailscale addresses. Never include usernames or passwords in service URLs.

You can configure settings in the browser preview and use **Export TV Setup**, then import the JSON file on the TV. The export contains service credentials and the AI device token: keep it private, do not upload it, and delete copies when no longer required.

## 7. Troubleshooting

- **Install fails / Error 205:** choose a valid Samsung TV certificate profile and rebuild the WGT.
- **Package install failure / Error 118:** verify the device connection, **Permit to install applications**, certificate profile, app ID, and package ID.
- **TV is missing in Device Manager:** check Developer Mode, the TV IP, the computer IP, and that both devices are on the same network.
- **Weather is unavailable:** confirm network access and the city name.
- **AI returns 401 or 503:** verify that the Worker is deployed and the device token matches `ASSISTANT_TOKEN`.
- **Jellyfin Continue Watching fails:** verify the URL and API key. Browser CORS restrictions or server policy may block direct requests from the TV app.
- **Voice input is unavailable:** test text chat first. Microphone capture and speech-to-text depend on the TV's firmware.
- **The TV feels slow:** verify that the release is built with `npm run build`, use the Tizen runtime rather than the desktop preview, and report the TV model/firmware and steps to reproduce.

## Official references

- [Samsung TV Developer Mode and device connection](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html)
- [Samsung TV command-line interface](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html?device=htv)
- [Samsung TV application installation FAQ](https://developer.samsung.com/smarttv/develop/faq/application-installation.html?device=htv)
