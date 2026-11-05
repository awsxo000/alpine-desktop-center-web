#!/bin/sh
set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
FRONTEND_VERSION=${1:-0.1.0-alpha.5-web}
BACKEND_VERSION=${2:-v1.43}
BACKEND_REPO=${BACKEND_REPO:-https://github.com/awsxo000/alpine.git}
BACKEND_SOURCE=${BACKEND_SOURCE:-}
BACKEND_MANIFEST=${BACKEND_MANIFEST:-}
BUILD_ROOT=${BUILD_ROOT:-"$REPO_ROOT/dist-portable"}
PACKAGE_NAME="Alpine-Desktop-Center-Web-v$FRONTEND_VERSION"
STAGE="$BUILD_ROOT/$PACKAGE_NAME"
BACKEND_TMP=$(mktemp -d)
trap 'rm -rf "$BACKEND_TMP"' EXIT HUP INT TERM

if [ -n "$BACKEND_SOURCE" ]; then
  echo "Using local backend source $BACKEND_SOURCE..."
  [ -d "$BACKEND_SOURCE" ] || { echo "Backend source does not exist: $BACKEND_SOURCE" >&2; exit 1; }
  cp -R "$BACKEND_SOURCE/." "$BACKEND_TMP/backend/"
else
  echo "Cloning backend $BACKEND_VERSION from $BACKEND_REPO..."
  git clone --quiet --depth 1 --branch "$BACKEND_VERSION" "$BACKEND_REPO" "$BACKEND_TMP/backend"
fi

if BACKEND_COMMIT=$(git -C "$BACKEND_TMP/backend" rev-parse HEAD 2>/dev/null); then
  :
else
  BACKEND_COMMIT=${BACKEND_COMMIT_OVERRIDE:-unavailable}
fi
rm -rf "$BACKEND_TMP/backend/.git"

pnpm --dir "$REPO_ROOT" build
rm -rf "$STAGE"
mkdir -p "$STAGE/frontend/dist" "$STAGE/server" "$STAGE/backend" "$STAGE/.alpine-state"
cp -R "$REPO_ROOT/dist/." "$STAGE/frontend/dist/"
cp "$REPO_ROOT/server/local_server.py" "$STAGE/server/"
cp -R "$BACKEND_TMP/backend/." "$STAGE/backend/"
cp "$REPO_ROOT/Alpine Desktop Center" "$REPO_ROOT/Alpine Desktop Center.desktop" "$REPO_ROOT/launch-from-desktop.sh" "$REPO_ROOT/install-desktop.sh" "$REPO_ROOT/alpine-desktop-center.svg" "$STAGE/"
chmod 0755 "$STAGE/Alpine Desktop Center" "$STAGE/launch-from-desktop.sh" "$STAGE/install-desktop.sh"
cp "$REPO_ROOT/README.md" "$REPO_ROOT/TODO.md" "$STAGE/"
chmod 0755 "$STAGE/Alpine Desktop Center" "$STAGE/launch-from-desktop.sh" "$STAGE/server/local_server.py"

if [ -n "$BACKEND_MANIFEST" ] && [ -f "$BACKEND_MANIFEST" ]; then
  cp "$BACKEND_MANIFEST" "$STAGE/BACKEND-MANIFEST.sha256"
else
  (cd "$STAGE/backend" && find . -type f -print | sort | sed 's#^./##' | xargs sha256sum) > "$STAGE/BACKEND-MANIFEST.sha256"
fi

cat > "$STAGE/RELEASE-VERSIONS" <<EOF
frontend=$FRONTEND_VERSION
backend=$BACKEND_VERSION
backend_commit=$BACKEND_COMMIT
diagnostic_schema=1
runtime=python3-local-browser
EOF

SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH:-0}
find "$STAGE" -exec touch -h -d "@$SOURCE_DATE_EPOCH" {} +
mkdir -p "$BUILD_ROOT"
tar -C "$BUILD_ROOT" --sort=name --owner=0 --group=0 --numeric-owner \
  --mtime="@$SOURCE_DATE_EPOCH" -cf - "$PACKAGE_NAME" | gzip -n > "$BUILD_ROOT/$PACKAGE_NAME.tar.gz"
printf '%s\n' "$BUILD_ROOT/$PACKAGE_NAME.tar.gz"
