#!/bin/sh
set -eu

REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PACKAGE_VERSION=$(cd "$REPO_ROOT" && node -p "require('./package.json').version")
FRONTEND_VERSION=${1:-$PACKAGE_VERSION}
BACKEND_VERSION=${2:-v1.43}
BACKEND_REPO=${BACKEND_REPO:-https://github.com/awsxo000/alpine.git}
BACKEND_SOURCE=${BACKEND_SOURCE:-}
BACKEND_MANIFEST=${BACKEND_MANIFEST:-}
BACKEND_COMMIT_EXPECTED=${BACKEND_COMMIT_EXPECTED:-}
BUILD_ROOT=${BUILD_ROOT:-"$REPO_ROOT/dist-portable"}
PACKAGE_NAME="Alpine-Desktop-Center-Web-v$FRONTEND_VERSION"
STAGE="$BUILD_ROOT/$PACKAGE_NAME"
BACKEND_TMP=$(mktemp -d)
trap 'rm -rf "$BACKEND_TMP"' EXIT HUP INT TERM

if [ "$FRONTEND_VERSION" != "$PACKAGE_VERSION" ]; then
  echo "Frontend version mismatch: requested $FRONTEND_VERSION but package.json declares $PACKAGE_VERSION." >&2
  exit 1
fi
if [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
  echo "Refusing to package a dirty frontend checkout. Commit or discard changes first." >&2
  exit 1
fi
FRONTEND_COMMIT=$(git -C "$REPO_ROOT" rev-parse HEAD)
if [ "$BACKEND_VERSION" = "v1.43" ]; then
  PINNED_V143_COMMIT=9efb8a8320958a1b9b79becf65b049814599af56
  if [ -n "$BACKEND_COMMIT_EXPECTED" ] && [ "$BACKEND_COMMIT_EXPECTED" != "$PINNED_V143_COMMIT" ]; then
    echo "Backend v1.43 is pinned to $PINNED_V143_COMMIT; a different override is not allowed." >&2
    exit 1
  fi
  BACKEND_COMMIT_EXPECTED=$PINNED_V143_COMMIT
fi
case "$BACKEND_COMMIT_EXPECTED" in
  *[!0-9a-f]*|'')
    echo "BACKEND_COMMIT_EXPECTED must be a lowercase 40-character commit SHA." >&2
    exit 1
    ;;
esac
if [ "${#BACKEND_COMMIT_EXPECTED}" -ne 40 ]; then
  echo "BACKEND_COMMIT_EXPECTED must be a lowercase 40-character commit SHA." >&2
  exit 1
fi

if [ -n "$BACKEND_SOURCE" ]; then
  echo "Using local backend source $BACKEND_SOURCE..."
  [ -d "$BACKEND_SOURCE" ] || { echo "Backend source does not exist: $BACKEND_SOURCE" >&2; exit 1; }
  if [ -n "$(git -C "$BACKEND_SOURCE" status --porcelain --untracked-files=all --ignored 2>/dev/null)" ]; then
    echo "Refusing a dirty backend source checkout, including ignored or untracked files." >&2
    exit 1
  fi
  mkdir -p "$BACKEND_TMP/backend"
  cp -R "$BACKEND_SOURCE/." "$BACKEND_TMP/backend/"
else
  echo "Cloning backend $BACKEND_VERSION from $BACKEND_REPO..."
  git clone --quiet --depth 1 --branch "$BACKEND_VERSION" "$BACKEND_REPO" "$BACKEND_TMP/backend"
fi

if ! BACKEND_COMMIT=$(git -C "$BACKEND_TMP/backend" rev-parse HEAD 2>/dev/null); then
  echo "Backend source must be a Git checkout with a verifiable commit." >&2
  exit 1
fi
if [ "$BACKEND_COMMIT" != "$BACKEND_COMMIT_EXPECTED" ]; then
  echo "Backend commit mismatch: expected $BACKEND_COMMIT_EXPECTED, got $BACKEND_COMMIT." >&2
  exit 1
fi
rm -rf "$BACKEND_TMP/backend/.git"

pnpm --dir "$REPO_ROOT" install --frozen-lockfile
pnpm --dir "$REPO_ROOT" check
pnpm --dir "$REPO_ROOT" test
pnpm --dir "$REPO_ROOT" build
if [ -e "$STAGE" ] || [ -L "$STAGE" ]; then
  find "$STAGE" -type d -exec chmod u+w {} +
  rm -rf "$STAGE"
fi
mkdir -p "$STAGE/frontend/dist" "$STAGE/server" "$STAGE/backend" "$STAGE/.alpine-state"
cp -R "$REPO_ROOT/dist/." "$STAGE/frontend/dist/"
cp "$REPO_ROOT/server/local_server.py" "$STAGE/server/"
cp -R "$BACKEND_TMP/backend/." "$STAGE/backend/"
find "$STAGE/backend" -type f -exec chmod a-w {} +
find "$STAGE/backend" -type d -exec chmod a-w {} +
cp "$REPO_ROOT/Alpine Desktop Center" "$REPO_ROOT/Alpine Desktop Center.desktop" "$REPO_ROOT/launch-from-desktop.sh" "$REPO_ROOT/install-desktop.sh" "$REPO_ROOT/alpine-desktop-center.svg" "$STAGE/"
chmod 0755 "$STAGE/Alpine Desktop Center" "$STAGE/launch-from-desktop.sh" "$STAGE/install-desktop.sh" "$STAGE/server/local_server.py"
cp "$REPO_ROOT/README.md" "$REPO_ROOT/CHANGELOG.md" "$REPO_ROOT/TODO.md" "$STAGE/"

if [ -n "$BACKEND_MANIFEST" ] && [ -f "$BACKEND_MANIFEST" ]; then
  cp "$BACKEND_MANIFEST" "$STAGE/BACKEND-MANIFEST.sha256"
else
  (cd "$STAGE/backend" && find . -type f -print | sort | sed 's#^./##' | xargs sha256sum) > "$STAGE/BACKEND-MANIFEST.sha256"
fi

cat > "$STAGE/RELEASE-VERSIONS" <<EOF
frontend=$FRONTEND_VERSION
frontend_commit=$FRONTEND_COMMIT
backend=$BACKEND_VERSION
backend_commit=$BACKEND_COMMIT
diagnostic_schema=1
runtime=python3-local-browser
EOF

PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="$STAGE/server" python3 -B - "$STAGE" <<'PY'
import sys
from pathlib import Path
import local_server
valid, message = local_server.validate_backend(Path(sys.argv[1]))
print(message)
raise SystemExit(0 if valid else 1)
PY

SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH:-0}
find "$STAGE" -exec touch -h -d "@$SOURCE_DATE_EPOCH" {} +
mkdir -p "$BUILD_ROOT"
tar -C "$BUILD_ROOT" --sort=name --owner=0 --group=0 --numeric-owner \
  --mtime="@$SOURCE_DATE_EPOCH" -cf - "$PACKAGE_NAME" | gzip -n > "$BUILD_ROOT/$PACKAGE_NAME.tar.gz"
printf '%s\n' "$BUILD_ROOT/$PACKAGE_NAME.tar.gz"
