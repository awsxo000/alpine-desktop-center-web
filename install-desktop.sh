#!/bin/sh
set -eu
APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DATA_HOME=${XDG_DATA_HOME:-"$HOME/.local/share"}
ICON_DIR="$DATA_HOME/icons/hicolor/scalable/apps"
APP_DIR_DESKTOP="$DATA_HOME/applications"
APP_EXEC=$(printf '%s' "$APP_DIR/launch-from-desktop.sh" | sed 's/\\/\\\\/g; s/"/\\"/g; s/%/%%/g')
mkdir -p "$ICON_DIR" "$APP_DIR_DESKTOP"
chmod 0755 "$APP_DIR/Alpine Desktop Center" "$APP_DIR/launch-from-desktop.sh"
cp "$APP_DIR/alpine-desktop-center.svg" "$ICON_DIR/alpine-desktop-center.svg"
cat > "$APP_DIR_DESKTOP/alpine-desktop-center.desktop" <<EOF
[Desktop Entry]
Name=Alpine Desktop Center
Comment=Open Alpine Desktop Center in its own local application window
Exec="$APP_EXEC"
Terminal=false
Type=Application
Categories=Settings;System;
Icon=alpine-desktop-center
StartupNotify=true
StartupWMClass=AlpineDesktopCenter
X-GNOME-SingleWindow=true
X-KDE-SubstituteUID=false
EOF
chmod 0644 "$APP_DIR_DESKTOP/alpine-desktop-center.desktop"
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APP_DIR_DESKTOP" >/dev/null 2>&1 || true
fi
if command -v gio >/dev/null 2>&1; then
  gio set "$APP_DIR_DESKTOP/alpine-desktop-center.desktop" metadata::trusted true >/dev/null 2>&1 || true
fi
printf '%s\n' "Installed Alpine Desktop Center in the application menu."
printf '%s\n' "Launch it from the menu as: Alpine Desktop Center"
