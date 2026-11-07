#!/bin/sh
set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
APK_DIR="$REPO_ROOT/packaging/alpine"

if ! command -v abuild >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Alpine APK build tools are not installed.
Run this script inside an Alpine build environment with abuild configured,
or install abuild and apk-tools on Alpine first.
EOF
  exit 127
fi

cd "$APK_DIR"
abuild checksum
abuild -r
printf '%s\n' "APK build complete. Check the abuild/packages directory for the package."