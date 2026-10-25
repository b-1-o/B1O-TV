#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TV_ADDR="${1:-${B1O_TV_ADDR:-}}"
TIZEN_TOOLS_DIR="${TIZEN_TOOLS:-}"
FAILURES=0

ok() { printf '[OK]      %s\n' "$*"; }
warn() { printf '[INFO]    %s\n' "$*"; }
missing() { printf '[MISSING] %s\n' "$*"; FAILURES=$((FAILURES + 1)); }

find_tizen_tools() {
  if [[ -n "$TIZEN_TOOLS_DIR" && -d "$TIZEN_TOOLS_DIR" ]]; then return; fi
  for candidate in "$HOME/tizen-studio/tools" "$HOME/tizen-studio-baseline/tools" "$HOME/.tizen-extension-platform/tools"; do
    if [[ -x "$candidate/sdb" || -x "$candidate/ide/bin/tizen" ]]; then
      TIZEN_TOOLS_DIR="$candidate"
      return
    fi
  done
}

find_tizen_tools
SDB_CLI="${SDB_CLI:-}"
TIZEN_CLI="${TIZEN_CLI:-}"
if [[ -z "$SDB_CLI" && -n "$TIZEN_TOOLS_DIR" && -x "$TIZEN_TOOLS_DIR/sdb" ]]; then SDB_CLI="$TIZEN_TOOLS_DIR/sdb"; fi
if [[ -z "$SDB_CLI" ]]; then SDB_CLI="$(command -v sdb 2>/dev/null || true)"; fi
if [[ -z "$TIZEN_CLI" && -n "$TIZEN_TOOLS_DIR" && -x "$TIZEN_TOOLS_DIR/ide/bin/tizen" ]]; then TIZEN_CLI="$TIZEN_TOOLS_DIR/ide/bin/tizen"; fi
if [[ -z "$TIZEN_CLI" ]]; then TIZEN_CLI="$(command -v tizen 2>/dev/null || true)"; fi

printf 'B1O TV — local setup diagnostics\n'
printf 'Workspace: %s\n' "$ROOT"
printf 'Host: %s / %s\n' "$(uname -s 2>/dev/null || echo unknown)" "$(uname -m 2>/dev/null || echo unknown)"
printf '\nRequired build tools (source checkout)\n'

if command -v node >/dev/null 2>&1; then ok "Node.js: $(node --version)"; else missing "Node.js (20+ required)"; fi
if command -v npm >/dev/null 2>&1; then ok "npm: $(npm --version)"; else missing "npm"; fi
if command -v python3 >/dev/null 2>&1; then ok "Python: $(python3 --version 2>&1)"; elif command -v python >/dev/null 2>&1; then ok "Python: $(python --version 2>&1)"; elif command -v py >/dev/null 2>&1; then ok "Python launcher is present (verify it runs Python 3)"; else missing "Python 3 (required to package the unsigned WGT)"; fi
if command -v magick >/dev/null 2>&1; then ok "ImageMagick: magick"; elif command -v convert >/dev/null 2>&1; then ok "ImageMagick: convert"; else missing "ImageMagick (required by the current build)"; fi

printf '\nRepository files\n'
for file in package.json public/config.xml src/main.tsx scripts/package-tizen-tv.py scripts/package-tizen-tv.mjs; do
  if [[ -s "$ROOT/$file" ]]; then ok "$file"; else missing "$file"; fi
done

printf '\nOptional installers / SDK tools\n'
if [[ -n "$SDB_CLI" && -x "$SDB_CLI" ]]; then ok "SDB: $SDB_CLI"; else warn "SDB not found; Apps2Samsung can provide its own TV connection flow"; fi
if [[ -n "$TIZEN_CLI" && -x "$TIZEN_CLI" ]]; then ok "Tizen CLI: $TIZEN_CLI"; else warn "Tizen CLI not found; the Apps2Samsung signing flow is the recommended path"; fi
if command -v apps2samsung >/dev/null 2>&1; then ok "Apps2Samsung command is available"; else warn "Apps2Samsung is not on PATH (a desktop release may still be installed separately)"; fi
if [[ -n "${TIZEN_PROFILE:-}" ]]; then warn "TIZEN_PROFILE is set to '${TIZEN_PROFILE}' (profile name only; no key/password is read)"; else warn "No TIZEN_PROFILE set; only required if using the Tizen Studio deployment fallback"; fi

if [[ -n "$TV_ADDR" ]]; then
  if [[ "$TV_ADDR" != *:* ]]; then TV_ADDR="$TV_ADDR:26101"; fi
  printf '\nExplicit target: %s\n' "$TV_ADDR"
  if [[ -n "$SDB_CLI" && -x "$SDB_CLI" ]]; then
    printf 'Attempting SDB connection to the exact supplied target (no subnet scan)...\n'
    "$SDB_CLI" connect "$TV_ADDR" 2>&1 || warn "SDB connect did not succeed; verify Developer Mode / Host PC IP or use Apps2Samsung discovery"
    DEVICES="$("$SDB_CLI" devices 2>&1 || true)"
    printf '%s\n' "$DEVICES"
    if printf '%s\n' "$DEVICES" | grep -F "$TV_ADDR" >/dev/null 2>&1; then
      ok "SDB lists the supplied target"
    else
      warn "SDB does not list the supplied target as connected"
    fi
  else
    warn "Cannot probe the target through SDB because the CLI is not available"
  fi
else
  printf '\nSDB devices (if SDB is installed)\n'
  if [[ -n "$SDB_CLI" && -x "$SDB_CLI" ]]; then
    "$SDB_CLI" devices 2>&1 || warn "Unable to list SDB devices"
  else
    warn "No SDB CLI. Use Apps2Samsung's built-in TV discovery or pass a known TV IP after installing Tizen tools."
  fi
  warn "No TV address supplied; this diagnostic will not scan the LAN."
fi

printf '\nRecommended companion installer: https://github.com/Apps2Samsung/Apps2Samsung/releases\n'
printf 'This diagnostic does not install software or change TV settings. When an address is supplied, it only attempts an SDB connection to that exact address.\n'
if [[ "$FAILURES" -gt 0 ]]; then
  printf '\nFound %s required build-tool/file issue(s). Fix them before packaging from source.\n' "$FAILURES"
  exit 1
fi
printf '\nRequired local checks passed. Next: follow PROMPT.md and docs/AI-INSTALL.md.\n'
