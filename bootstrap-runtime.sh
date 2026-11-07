#!/bin/sh
set -eu

APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
STATE_DIR="$APP_DIR/.alpine-state/web"
MARKER="$STATE_DIR/runtime-ready"

has_browser() {
  command -v chromium >/dev/null 2>&1 || \
    command -v chromium-browser >/dev/null 2>&1 || \
    command -v google-chrome >/dev/null 2>&1 || \
    command -v brave-browser >/dev/null 2>&1 || \
    command -v firefox >/dev/null 2>&1
}

missing_runtime() {
  missing=""
  command -v python3 >/dev/null 2>&1 || missing="$missing python3"
  command -v make >/dev/null 2>&1 || missing="$missing make"
  command -v ansible-playbook >/dev/null 2>&1 || missing="$missing ansible"
  if [ "$(id -u)" -ne 0 ] && ! command -v doas >/dev/null 2>&1 && ! command -v sudo >/dev/null 2>&1; then
    missing="$missing doas"
  fi
  has_browser || missing="$missing chromium"
  printf '%s' "$missing"
}

missing=$(missing_runtime)
if [ -z "$missing" ]; then
  mkdir -p "$STATE_DIR"
  chmod 0700 "$STATE_DIR"
  : > "$MARKER"
  chmod 0600 "$MARKER"
  printf '%s\n' 'Alpine Desktop Center runtime is ready.'
  exit 0
fi

if [ "$(id -u)" -eq 0 ]; then
  APK='apk add'
elif command -v doas >/dev/null 2>&1; then
  APK='doas apk add'
elif command -v sudo >/dev/null 2>&1; then
  APK='sudo apk add'
else
  printf '%s\n' 'This first run needs administrator access to install Alpine packages.' >&2
  printf '%s\n' 'Run this command as root, then launch Alpine Desktop Center again:' >&2
  printf '%s\n' "apk add$missing" >&2
  exit 2
fi

printf '%s\n' 'Alpine Desktop Center first-run setup'
printf '%s\n' "Missing runtime packages:$missing"
printf '%s\n' "The following command will install the local runtime: $APK$missing"
printf '%s' 'Continue? [y/N] '
read -r answer
case "$answer" in
  y|Y|yes|YES) ;;
  *) printf '%s\n' 'Setup cancelled. No system changes were made.'; exit 3 ;;
esac

# The package list is derived from command checks above. Chromium is the
# default app-window browser; Firefox or another supported browser also works
# when already installed.
$APK $missing
mkdir -p "$STATE_DIR"
chmod 0700 "$STATE_DIR"
: > "$MARKER"
chmod 0600 "$MARKER"
printf '%s\n' 'Runtime setup completed successfully.'
