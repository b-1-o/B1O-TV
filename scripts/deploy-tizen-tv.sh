#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="${TIZEN_TOOLS:-$HOME/tizen-studio-baseline/tools}"
TIZEN_CLI="${TIZEN_CLI:-$TOOLS_DIR/ide/bin/tizen}"
SDB_CLI="${SDB_CLI:-$TOOLS_DIR/sdb}"
PROFILE="${TIZEN_PROFILE:-B1O-Final}"
TV_ADDR="${1:-192.168.1.22:26101}"
PACKAGE_ID="B1Otv00001"
APP_ID="B1Otv00001.B1web"
OUT_DIR="$ROOT/release-tizen"
STAGE="$ROOT/.tizen-stage-$$"
STAMP="$(date +%Y%m%d_%H%M%S)"
REMOTE_WGT="/home/owner/share/tmp/sdk_tools/tmp/B1O_TV_$STAMP.wgt"
# Optional pre-signed TizenTube standalone WGT; installed before B1O TV when provided.
TIZENTUBE_WGT="${TIZENTUBE_WGT:-}"
TIZENTUBE_PACKAGE_ID="${TIZENTUBE_PACKAGE_ID:-xvvl3S1TT1}"
REMOTE_TIZENTUBE_WGT="/home/owner/share/tmp/sdk_tools/tmp/TizenTube_$STAMP.wgt"

cleanup() {
  rm -rf -- "$STAGE"
}
trap cleanup EXIT

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -x "$TIZEN_CLI" ]] || fail "Tizen CLI not found: $TIZEN_CLI. Set TIZEN_CLI or TIZEN_TOOLS."
[[ -x "$SDB_CLI" ]] || fail "SDB not found: $SDB_CLI. Set SDB_CLI or TIZEN_TOOLS."
if [[ -n "$TIZENTUBE_WGT" && ! -s "$TIZENTUBE_WGT" ]]; then
  fail "TIZENTUBE_WGT does not exist or is empty: $TIZENTUBE_WGT"
fi
[[ -f "$ROOT/public/config.xml" ]] || fail "Run this script from the B1web repository; public/config.xml is missing."
if [[ ! -x "$ROOT/node_modules/.bin/tsc" || ! -f "$ROOT/node_modules/@noriginmedia/norigin-spatial-navigation/package.json" ]]; then
  printf 'Dependencies are missing or incomplete; syncing package.json and package-lock.json...\n'
  # npm install repairs stale local node_modules and updates an existing local lockfile.
  # Use it rather than npm ci because this repository does not track a package-lock.json yet.
  (cd "$ROOT" && npm install --no-audit --no-fund)
fi

command -v magick >/dev/null 2>&1 || command -v convert >/dev/null 2>&1 || fail "ImageMagick is required. On CachyOS/Arch run: sudo pacman -S imagemagick"
mkdir -p "$OUT_DIR"
rm -f -- "$OUT_DIR/B1O TV.wgt"

printf '\n[1/5] Building optimized B1O TV web app...\n'
(cd "$ROOT" && npm run build)

[[ -s "$ROOT/dist/index.html" ]] || fail "Build did not create dist/index.html."
[[ -s "$ROOT/dist/icon.png" ]] || fail "Build did not create dist/icon.png."

printf '\n[2/5] Preparing clean Tizen package directory...\n'
mkdir -p "$STAGE"
cp -a "$ROOT/dist/." "$STAGE/"
# Keep the checked-in Samsung TV manifest as the single source of truth.
cp "$ROOT/public/config.xml" "$STAGE/config.xml"
[[ -s "$STAGE/config.xml" && -s "$STAGE/icon.png" && -s "$STAGE/index.html" ]] || fail "Tizen package is missing a required root file."

printf '\n[3/5] Signing WGT with the existing profile: %s\n' "$PROFILE"
(cd "$STAGE" && "$TIZEN_CLI" package -t wgt -s "$PROFILE" -- .)
[[ -s "$STAGE/B1O TV.wgt" ]] || fail "Tizen CLI did not create B1O TV.wgt. Check the profile name and Certificate Manager."

cp "$STAGE/B1O TV.wgt" "$OUT_DIR/B1O TV.wgt"
printf 'Signed package saved: %s\n' "$OUT_DIR/B1O TV.wgt"

printf '\n[4/5] Copying package to TV %s...\n' "$TV_ADDR"
"$SDB_CLI" -s "$TV_ADDR" push "$OUT_DIR/B1O TV.wgt" "$REMOTE_WGT"

if [[ -n "$TIZENTUBE_WGT" ]]; then
  printf '\nInstalling optional TizenTube before B1O TV...\n'
  printf 'TizenTube package ID: %s\n' "$TIZENTUBE_PACKAGE_ID"
  printf 'Using provided, already TV-installable WGT: %s\n' "$TIZENTUBE_WGT"
  "$SDB_CLI" -s "$TV_ADDR" push "$TIZENTUBE_WGT" "$REMOTE_TIZENTUBE_WGT"
  "$SDB_CLI" -s "$TV_ADDR" shell 0 vd_appinstall "$TIZENTUBE_PACKAGE_ID" "$REMOTE_TIZENTUBE_WGT"
fi

printf '\n[5/5] Installing and launching B1O TV...\n'
"$SDB_CLI" -s "$TV_ADDR" shell 0 vd_appinstall "$PACKAGE_ID" "$REMOTE_WGT"
"$TIZEN_CLI" run -s "$TV_ADDR" -p "$APP_ID"

printf '\nDone. Signed WGT: %s\n' "$OUT_DIR/B1O TV.wgt"
if [[ -n "$TIZENTUBE_WGT" ]]; then
  printf 'TizenTube was installed separately before B1O TV.\n'
fi
printf 'If the TV app opens but a feature does not work, capture TV logs before changing the certificate/profile.\n'
