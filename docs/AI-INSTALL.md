# AI-assisted installation and recovery

This guide is designed to be followed by Claude Code, Codex, Gemini CLI, or another coding agent with terminal and internet access. Desktop-control capability is helpful for operating the installer GUI, but not all agents have it. The agent must be honest about any manual hand-off.

## Supported scope

- B1O TV's current Tizen manifest requires Tizen 6.0 or later.
- TizenTube has separate builds and instructions for Samsung Tizen and Android TV. A Samsung TV must use the Tizen route.
- B1O TV is a normal Samsung Tizen app. It does not replace Samsung Home, debloat the firmware, disable system apps, or change system settings.
- Jellyfin, SelfMusic, and the AI assistant are optional integrations. A basic B1O TV install must not depend on them being configured.

## Before starting

1. Ask the owner to keep the TV on, connected to the same LAN, and within reach for prompts that appear on the TV.
2. Inspect the workspace:
   - Run `pwd` and `git status --short`.
   - If this is a source checkout, inspect the current branch and local changes before pulling. Never overwrite unrelated edits.
   - If this is a release kit, check whether `src/`, `package.json`, and `scripts/` exist. The release kit includes a prebuilt unsigned WGT, but not the complete source tree.
3. Read the actual manifest at `public/config.xml` when source is available. Confirm that the target OS is Tizen and that its version satisfies `required_version="6.0"`. If the model or Tizen version cannot be verified, do not claim compatibility.
4. Show a concise plan: inspect, build/package or use the included WGT, find the TV, install required apps, launch and verify.

## Step 1 — Diagnose the computer and network

For a source checkout on Linux/macOS/WSL, run:

```sh
bash scripts/tv-doctor.sh
```

If the TV's address is known, pass it explicitly:

```sh
bash scripts/tv-doctor.sh 192.168.1.22:26101
```

The script checks build tools and, when an address is supplied, attempts an SDB connection to that exact target. It does not scan a subnet or change TV settings. The default SDB port commonly used in Samsung Developer Mode is `26101`; use the actual address shown by the installer/device if it differs.

If the diagnostic finds missing build tools, install only what is needed using the host OS's normal package manager and ask before privileged system changes. For a release-kit install, do not install Node.js/ImageMagick just to use an already-built WGT.

## Step 2 — Enable Developer Mode on Samsung TV

Developer Mode and device confirmation are TV-owner actions. The menu can differ by model and firmware. Samsung's official guide is:

https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html

For many recent Samsung TVs:

1. Open **Apps** or **Apps Settings** on the TV.
2. Enter `12345` using the remote or the on-screen number keypad.
3. Set **Developer Mode** to **On** and set **Host PC IP** to the computer's current LAN IPv4 address.
4. Confirm and reboot the TV using the remote.
5. Leave the TV on and connected to the same network.

Never guess the host IP. Determine it from the active LAN interface and show it to the owner if the on-TV screen needs to be filled manually. If the TV asks to authorize the computer, the owner must accept that prompt. Do not attempt firmware changes or system modifications if Developer Mode is unavailable.

## Step 3 — Use the official Apps2Samsung installer

Recommended installer:

- Project: https://github.com/Apps2Samsung/Apps2Samsung
- Releases: https://github.com/Apps2Samsung/Apps2Samsung/releases
- Official site: https://apps2samsung.com/

Apps2Samsung is a third-party community tool, not a Samsung product. Get the desktop build only from its official GitHub releases. Select a stable release and the asset that matches the computer's OS and CPU architecture. On Linux, use the official AppImage when that is the documented option for the host.

If Apps2Samsung is already installed, open it. If not, download and start the verified official release. Do not install random mirrors or paste credentials into scripts. If the AI agent cannot operate GUI windows, direct the owner through the next clicks and resume after the owner confirms the step.

In Apps2Samsung:

1. Select the TV discovered on the local network, or enter the exact TV address. If more than one TV is present, ask which one is correct.
2. Verify the model/Tizen details shown by the tool before installing anything.
3. Keep the installer open during signing and installation; allow the TV to show its own prompts.
4. Do not remove existing apps as a setup shortcut.

## Step 4 — Install TizenTube only if needed

Official project and instructions:

- Project: https://github.com/reisxd/TizenTube
- Releases: https://github.com/reisxd/TizenTube/releases
- Installation guide: https://github.com/reisxd/TizenTube/blob/main/docs/README.md

First inspect the TV's installed-app list. If a working TizenTube is already present, keep it and verify it launches. Do not reinstall merely to make the checklist look complete. If it is missing:

1. Select the **Samsung Tizen** TizenTube option/release in Apps2Samsung; never choose an Android TV APK.
2. Match the build to the detected Tizen version. The Cobalt WGT is for Tizen 6+; the legacy WGT is for older Tizen versions, but that does not make B1O TV compatible with those older versions.
3. Follow the current TizenTube installation guide for certificate requirements. The Cobalt build can require **Force Samsung Certificate** and **Partner Signing** during its installation. Apply special signing only as required by TizenTube's own guide; do not silently change signing settings for other apps.
4. Wait for the installer to confirm completion. Launch TizenTube on the TV if possible.
5. If it shows a network error, use the current official troubleshooting guidance and TV logs. Do not change router DNS or proxy settings automatically.

Do not install multiple TizenTube variants or the Android Cobalt application side by side unless the owner explicitly requests it.

## Step 5 — Build and package B1O TV

For a source checkout:

```sh
npm install --no-audit --no-fund
npm run typecheck
npm run typecheck:assistant
npm run lint
npm test
npm run package:tizen-web
```

The build uses ImageMagick to optimize wallpapers and generate `dist/icon.png`. The package task creates:

```
release-tizen/B1O-TV-unsigned.wgt
```

This is a WGT-shaped ZIP archive with the web project and Tizen manifest at its root, but **it has no Samsung author/distributor signatures**. Its intended use is to import it into a supported local signing flow in Apps2Samsung. Never install it directly through raw SDB or represent it as signed.

For a release kit without source, use its included `B1O-TV-unsigned.wgt`. Do not claim source tests passed if they were not run.

If Apps2Samsung rejects the generated package or its custom-WGT path is not available, stop and use the documented Tizen Studio route instead:

https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/command-line-interface.html?device=htv

For an already-configured Tizen Studio environment, the repository's alternative is:

```sh
TIZEN_PROFILE="YourCertificateProfile" TIZEN_TOOLS="$HOME/tizen-studio/tools" npm run deploy:tizen -- 192.168.1.22:26101
```

Replace the sample target and paths with values actually discovered on this computer. Do not guess certificate profiles or expose signing passwords. This path needs a valid, locally configured certificate profile.

## Step 6 — Verify installation and launch

Do not report success from a build alone.

- Confirm Apps2Samsung reports that B1O TV installed successfully.
- Open the app from the TV's apps list or use a supported launch function in the installer.
- Verify the B1O TV home screen appears without an immediate crash or blank page.
- Test basic Up/Down/Left/Right/Enter/Back navigation with the physical remote.
- If available, inspect TV logs before changing privileges or certificates.
- Confirm TizenTube is present only if installed or already present; launch it and verify it reaches its home screen.
- If launch fails, preserve the prior installation and collect the actual error before trying another signing route.

A UI launch does not prove every feature. Continue Watching requires a reachable Jellyfin server and API key; SelfMusic needs its server; AI needs a configured endpoint/token. Do not invent those settings.

## Step 7 — Configure services without leaking secrets

In B1O TV settings, configure only what the owner has supplied:

- Weather: city and units.
- Jellyfin: reachable base URL, API key, and viewing-history user.
- SelfMusic: server URL and normal sign-in flow.
- AI: Worker endpoint and matching device token.

A setup export JSON includes personal service credentials and an AI device token. Do not place that file in Git, attach it to an issue, display its secret fields in terminal output, or send it to third-party APIs. If the owner already has an export, use it only with their consent and handle it as a secret. Do not start optional services in the background just to make B1O TV launch.

## Troubleshooting matrix

| Symptom | Next safe action |
| --- | --- |
| No TV found | Verify the TV and host are on the same LAN, Developer Mode is on, and Host PC IP matches the computer. Reboot the TV after changing Developer Mode. |
| Installer asks for account/certificate | Pause and let the owner complete the official sign-in/certificate prompt. Never ask for the password in chat or store it in a script. |
| B1O package rejected | Preserve the existing app. Check the target Tizen version, manifest IDs, installer error, and signing flow. If custom WGT signing is unavailable, use the documented Tizen Studio profile route. |
| App installs but does not launch | Record the actual TV error/log, verify model/Tizen compatibility and stable package IDs, then retry without removing the previous version. |
| TizenTube Cobalt reports a network error | Check internet status and current TizenTube official troubleshooting; allow its proxy service a short start-up period after a cold boot. Do not alter DNS/proxy settings automatically. |
| Jellyfin rail is empty | Verify the exact server URL, API key, selected user, and network reachability. This does not mean installation failed. |
| Voice input is unavailable | Text navigation can still work; voice permissions and APIs are model/firmware-dependent. |

## Final report format

At the end, report:

- TV model and Tizen version, if actually verified.
- Whether the target was found and connected.
- Whether B1O TV was built, signed/installed, and launched (separate statuses).
- Whether TizenTube was already present, installed, and launched.
- What was tested on the physical remote.
- Any owner-only steps not completed and the exact next action.

Use `verified`, `not verified`, and `blocked` distinctly. Never turn a failure or untested step into a success claim.
