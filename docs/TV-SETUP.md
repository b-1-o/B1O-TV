# Samsung TV / Tizen Setup and Test Guide

## 1. Run the browser preview

From the repository root:

```sh
npm install
npm run typecheck
npm run typecheck:assistant
npm run lint
npm test
npm run build
npm run dev
```

Open `http://localhost:5173`. To test from another device, use the computer's LAN address and port 5173. The preview can exercise layout, settings, local assistant intents, and keyboard focus, but it cannot prove that Samsung-specific APIs work on the TV.

## 2. Build and install on Samsung Tizen

1. Install Tizen Studio, Samsung TV Extension, and Samsung Certificate Extension.
2. Enable Developer Mode on the TV and connect it using Device Manager.
3. Create/select your own Samsung TV certificate profile.
4. Build with `npm run build`, or use the deployment script after configuring the tools path and certificate profile.
5. Install and launch the signed WGT over the local network. USB is not the normal WGT installation path for Samsung Smart TVs.

Read [INSTALL.md](INSTALL.md) for the full installation and update process. Never commit signing certificates or passwords.

## 3. Configure services

### Jellyfin

In **Settings → Media Services**, enter the reachable server URL, create a key under **Dashboard → Advanced → API Keys**, paste it in **Jellyfin API key**, and select **Connect to Jellyfin**. Pick the user whose viewing progress should be shown. Home then loads that user's Continue Watching items and progress bars. Selecting a card opens Jellyfin Web details so you can choose Resume/Play.

Use HTTPS for public endpoints. HTTP is allowed only for private/local network URLs. The API key is stored in local app settings; exported TV setup files also contain it, so keep exports private. Revoke an exposed key from the Jellyfin Dashboard.

### SelfMusic

Enter the SelfMusic server URL in **Settings → Media Services**. Sign in from the built-in player with the server's normal account flow. If the server checks allowed browser origins, add the exact origin shown by the player to `SELF_MUSIC_ALLOWED_ORIGINS` in the server's private environment file, then restart SelfMusic. Do not place a password in a URL.

### AI assistant

Deploy the Worker and set `ASSISTANT_TOKEN` as a Cloudflare Worker secret. In **Settings → AI & Voice**, enter the Worker origin (or `/api/assistant` endpoint) and the same device token. Use **Check AI Connection** before testing voice. Voice recording depends on the TV firmware; Samsung Voice Interaction navigation is not the same as speech-to-text.

## 4. Remote-control acceptance matrix

Run these checks on the actual TV, not only in a desktop browser.

| Scenario | Expected behavior |
| --- | --- |
| Home opens | Initial focus is visible; there is no blank screen or focus hidden behind the dock. |
| Left/Right | Focus moves between items in the current row or dock without skipping randomly. |
| Down through content | Focus continues through visible rows; at the last row, Down enters the dock. |
| Up from dock | Focus returns to the last valid content control, falling back to the current view's default if that control disappeared. |
| Enter | Activates the selected control once; disabled controls cannot be activated. |
| Back in a dialog | Closes only the topmost dialog and restores a useful focus target. |
| Back on a page | Returns to Home. |
| Back on Home | Opens an exit confirmation; cancel keeps B1O TV open. |
| Backspace while typing | Edits text and does not navigate away. |
| Hidden/resumed app | Weather and Jellyfin polling pause while hidden, then refresh when B1O TV is visible again. Embedded SelfMusic audio pauses when hidden. |
| Network/API error | An inline message appears; navigation and settings remain usable. |
| Long session | No repeated polling while hidden, stuck microphone capture, or noticeable focus drift. |

Unit tests cover key normalization and focus-boundary rules. They cannot replace a physical-remote run on the target TV.

## 5. Performance and background behavior

The Tizen manifest sets `background-support="disable"`. The app also observes `visibilitychange`, `pagehide`, and `pageshow`: its clock and timer intervals stop while hidden, weather/Jellyfin requests are aborted or skipped, and SelfMusic playback pauses. On resume, the clock updates immediately and eligible service data reloads.

Tizen controls the lifecycle of other apps and system services. B1O TV does not try to kill or disable Samsung system apps; that is not a safe or portable way to improve performance. Background behavior varies by TV model and firmware.

The Tizen runtime disables live backdrop filters and unnecessary background animation. The design keeps subtle transitions and neutral focus outlines rather than replacing surfaces with opaque blue fills.

## 6. Known limitations

- B1O TV is a regular Tizen app, not a replacement for Samsung's system Home screen.
- A clicked Jellyfin item opens a details page in Jellyfin Web; launching a precise item directly in a separate Jellyfin TV client depends on that client supporting deep links.
- Timers are not system alarms and cannot guarantee a notification while the app is suspended or closed.
- Voice recording depends on TV firmware permissions and microphone exposure.
- App discovery and app launch depend on the installed app IDs, privileges, and firmware.
