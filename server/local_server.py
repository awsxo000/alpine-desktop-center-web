#!/usr/bin/env python3
"""Local browser bridge for Alpine Desktop Center.

This first portable slice serves the compiled UI and exposes health plus the
closed operation contract. Backend execution adapters are added behind these
named routes; arbitrary shell input is never accepted.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


OPERATIONS = {
    "validate-backend",
    "system-check",
    "check-all-modules",
    "apply-full",
    "apply-diagnostics",
    "refresh-nix-apps",
    "check-stable-channel",
    "migrate-stable-channel",
    "apply-module",
}


def validate_backend(root: Path) -> tuple[bool, str]:
    backend = root / "backend"
    manifest = root / "BACKEND-MANIFEST.sha256"
    if not backend.is_dir() or not manifest.is_file():
        return False, "Embedded backend or manifest is missing."
    try:
        expected: dict[str, str] = {}
        for line in manifest.read_text(encoding="utf-8").splitlines():
            digest, separator, relative = line.partition("  ")
            if separator and len(digest) == 64 and relative:
                expected[relative] = digest
        actual = {
            str(path.relative_to(backend))
            for path in backend.rglob("*")
            if path.is_file()
        }
        if actual != set(expected):
            return False, "Embedded backend files differ from the manifest."
        for relative, expected_digest in expected.items():
            digest = hashlib.sha256((backend / relative).read_bytes()).hexdigest()
            if digest != expected_digest:
                return False, f"Backend checksum mismatch: {relative}"
    except OSError as exc:
        return False, f"Could not validate backend: {exc}"
    return True, "Embedded backend matches the release manifest."


class Handler(BaseHTTPRequestHandler):
    server_version = "AlpineDesktopCenterLocal/0.1"

    @property
    def root(self) -> Path:
        return self.server.root  # type: ignore[attr-defined]

    def log_message(self, fmt: str, *args: object) -> None:
        print(fmt % args, flush=True)

    def send_json(self, payload: dict[str, object], status: int = HTTPStatus.OK) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/api/health":
            valid, message = validate_backend(self.root)
            self.send_json({
                "bridge": "local",
                "backend": "validated" if valid else "failed",
                "message": message,
                "release_root": str(self.root),
            }, HTTPStatus.OK if valid else HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if path == "/api/backend/status":
            valid, message = validate_backend(self.root)
            self.send_json({"valid": valid, "message": message})
            return
        self.serve_static(path)

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        prefix = "/api/operations/"
        if not path.startswith(prefix):
            self.send_json({"error": "Unknown endpoint."}, HTTPStatus.NOT_FOUND)
            return
        operation = path.removeprefix(prefix)
        if operation not in OPERATIONS:
            self.send_json({"error": "Operation is not in the named allowlist."}, HTTPStatus.NOT_FOUND)
            return
        valid, message = validate_backend(self.root)
        if not valid:
            self.send_json({"status": "blocked", "message": message}, HTTPStatus.CONFLICT)
            return
        if operation == "validate-backend":
            self.send_json({"status": "success", "operation": operation, "message": message})
            return
        self.send_json({
            "status": "adapter_pending",
            "operation": operation,
            "message": "The local bridge validated the backend. The execution adapter is the next migration layer.",
        }, HTTPStatus.NOT_IMPLEMENTED)

    def serve_static(self, path: str) -> None:
        relative = "index.html" if path in ("", "/") else path.lstrip("/")
        candidate = (self.root / "frontend" / "dist" / relative).resolve()
        static_root = (self.root / "frontend" / "dist").resolve()
        if static_root not in candidate.parents and candidate != static_root:
            self.send_json({"error": "Invalid path."}, HTTPStatus.BAD_REQUEST)
            return
        if not candidate.is_file():
            candidate = static_root / "index.html"
        try:
            data = candidate.read_bytes()
        except OSError:
            self.send_json({"error": "Asset unavailable."}, HTTPStatus.NOT_FOUND)
            return
        content_type = mimetypes.guess_type(str(candidate))[0] or "application/octet-stream"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> int:
    parser = argparse.ArgumentParser(description="Alpine Desktop Center local browser server")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=43127)
    args = parser.parse_args()
    root = args.root.resolve()
    valid, message = validate_backend(root)
    print(f"Backend validation: {'PASS' if valid else 'FAIL'} — {message}", flush=True)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.root = root  # type: ignore[attr-defined]
    print(f"Alpine Desktop Center listening on http://{args.host}:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
