#!/bin/sh
set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
FRONTEND_VERSION=${1:-0.1.0-alpha.5-web}
BACKEND_SOURCE=${BACKEND_SOURCE:-}
BACKEND_MANIFEST=${BACKEND_MANIFEST:-}
BUILD_ROOT=${BUILD_ROOT:-"$REPO_ROOT/dist-portable"}
PACKAGE_NAME="Alpine-Desktop-Center-Web-v$FRONTEND_VERSION"
STAGE="$BUILD_ROOT/$PACKAGE_NAME"

[ -n "$BACKEND_SOURCE" ] || { echo "BACKEND_SOURCE must point to the embedded backend directory." >&2; exit 1; }
[ -d "$BACKEND_SOURCE" ] || { echo "Backend source does not exist: $BACKEND_SOURCE" >&2; exit 1; }

pnpm --dir "$REPO_ROOT" build
rm -rf "$STAGE"
mkdir -p "$STAGE/frontend/dist" "$STAGE/server" "$STAGE/backend" "$STAGE/.alpine-state"
cp -R "$REPO_ROOT/dist/." "$STAGE/frontend/dist/"
cp "$REPO_ROOT/server/local_server.py" "$STAGE/server/"
cp -R "$BACKEND_SOURCE/." "$STAGE/backend/"
cp "$REPO_ROOT/Alpine Desktop Center" "$REPO_ROOT/Alpine Desktop Center.desktop" "$REPO_ROOT/launch-from-desktop.sh" "$STAGE/"
cp "$REPO_ROOT/README.md" "$REPO_ROOT/TODO.md" "$STAGE/"
chmod 0755 "$STAGE/Alpine Desktop Center" "$STAGE/launch-from-desktop.sh" "$STAGE/server/local_server.py"

if [ -n "$BACKEND_MANIFEST" ] && [ -f "$BACKEND_MANIFEST" ]; then
  cp "$BACKEND_MANIFEST" "$STAGE/BACKEND-MANIFEST.sha256"
else
  (cd "$STAGE/backend" && find . -type f -print | sort | sed 's#^./##' | xargs sha256sum) > "$STAGE/BACKEND-MANIFEST.sha256"
fi

cat > "$STAGE/RELEASE-VERSIONS" <<EOF
frontend=$FRONTEND_VERSION
backend=v1.43
diagnostic_schema=1
runtime=python3-local-browser
EOF

SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH:-0}
find "$STAGE" -exec touch -h -d "@$SOURCE_DATE_EPOCH" {} +
mkdir -p "$BUILD_ROOT"
tar -C "$BUILD_ROOT" --sort=name --owner=0 --group=0 --numeric-owner \
  --mtime="@$SOURCE_DATE_EPOCH" -cf - "$PACKAGE_NAME" | gzip -n > "$BUILD_ROOT/$PACKAGE_NAME.tar.gz"
printf '%s\n' "$BUILD_ROOT/$PACKAGE_NAME.tar.gz"
