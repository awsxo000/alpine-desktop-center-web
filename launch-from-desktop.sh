#!/bin/sh
set -eu
ARG=${1:-}
case "$ARG" in
  file://*)
    if command -v python3 >/dev/null 2>&1; then
      ARG=$(python3 -c 'from urllib.parse import unquote; import sys; print(unquote(sys.argv[1]))' "${ARG#file://}")
    else
      ARG=${ARG#file://}
    fi
    ;;
esac
if [ -n "$ARG" ] && [ -f "$ARG" ]; then
  ROOT=$(CDPATH= cd -- "$(dirname -- "$ARG")" && pwd)
else
  ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
fi
exec "$ROOT/Alpine Desktop Center"
