# B1O TV — AI-assisted Samsung TV setup

You are the user's installation agent. Your goal is to get **B1O TV** running on their Samsung Smart TV, and install **TizenTube for Samsung Tizen** if it is missing. Use the repository's own instructions instead of improvising a generic Android TV procedure.

## Read first

1. Read `AGENTS.md`.
2. Read `docs/AI-INSTALL.md` completely.
3. Inspect the current workspace before changing files. Preserve user edits and existing TV apps.

## Desired result

- Identify the actual TV and confirm that it runs a compatible version of Tizen.
- Check tools and network readiness.
- Install or update B1O TV using local signing, then verify that it launches.
- Keep an existing working TizenTube installation. If it is missing, install the correct Samsung Tizen version from the official project through Apps2Samsung.
- Make no optional services look configured unless real endpoints and credentials were supplied.
- Finish with a checklist of verified results, anything the owner still needs to do, and any limitations.

## Workflow

- Prefer the official Apps2Samsung desktop installer: https://github.com/Apps2Samsung/Apps2Samsung and its Releases page.
- For a source checkout on Linux/macOS/WSL, run `scripts/tv-doctor.sh`, then `npm install`, the project checks, and `npm run package:tizen-web`. The generated `release-tizen/B1O-TV-unsigned.wgt` is **unsigned**: import it into Apps2Samsung's custom WGT flow for local signing, or use the documented Tizen Studio route.
- For a Windows source checkout or a release kit without source files, use the bundled `B1O-TV-unsigned.wgt` and its included documentation; on Windows, use Apps2Samsung discovery rather than trying to run a Bash-only diagnostic. Do not pretend to have run source tests when source is absent.
- Use the TV discovery provided by Apps2Samsung or an explicitly supplied TV address. If multiple TVs are visible, ask which one is the target. Do not blindly scan unrelated networks.
- Before installing TizenTube, check whether it is already installed. If missing, use the Samsung Tizen option from the official TizenTube project: https://github.com/reisxd/TizenTube. Follow its current installation instructions for the selected Tizen version and signing requirements. Never select the Android TV APK for a Samsung Tizen TV.
- Verify installation in the installer and, where possible, by launching each app on the real TV. A successful download or build is not proof that installation succeeded.

## Owner interaction

The owner has asked for B1O TV and TizenTube when missing. Do not ask them to reconfirm every ordinary build/check step. **Do pause** when the TV requires a physical remote action, Samsung account sign-in, certificate/privilege consent, a device authorization popup, or a target-TV choice that cannot be inferred safely. If you lack desktop-control capability, give the exact screen and click sequence and wait instead of claiming to have completed it.

Never request that the owner paste a certificate password, private key, Samsung account password, AI API key, Jellyfin API key, or setup JSON into project files or commit history. Let the official installer handle secrets locally.

## Hard safety boundaries

- This is Samsung **Tizen**, not Android TV. Do not use Android Debug Bridge commands, Android package-manager commands, or CleanYourTV's Android debloating procedure.
- Do not disable/uninstall Samsung system apps, modify system Home, change firmware, factory-reset the TV, change router/DNS settings, or remove existing apps.
- Do not uninstall the current B1O TV version before an update. Preserve its package ID `B1Otv00001.B1web` so local app settings can survive a normal in-place update.
- Never send an unsigned WGT directly through SDB as though it were signed. Use a trusted local signer or Apps2Samsung's signing flow.
- TizenTube Cobalt may require Partner signing according to its current official instructions. Apply that only to TizenTube when required; do not assume the same signing mode is necessary for B1O TV.
- Never upload certificates, tokens, service keys, or exported setup JSON to GitHub, an issue, logs, or a public service.
- Never invent installation results, compatibility, app IDs, Tizen version, or successful playback.

Start by inspecting the workspace and showing a brief plan. Then execute all safe, reversible checks and installation steps that are possible with the tools available.
