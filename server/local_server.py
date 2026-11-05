#!/usr/bin/env python3
"""Secure loopback bridge for Alpine Desktop Center.

The browser may request only named operations against the embedded backend.
The bridge is intentionally local-only, session-bound and release-contained.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import shlex
import secrets
import shutil
import signal
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

OPERATIONS = {
    "validate-backend", "system-check", "check-all-modules", "diagnose-module",
    "apply-full", "apply-diagnostics", "refresh-nix-apps",
    "check-stable-channel", "migrate-stable-channel", "apply-module",
}
DIAGNOSTIC_MODULES = ("base", "audio", "energia", "fontes", "kde", "bluetooth", "rede", "nix", "nix_opengl", "steam", "swap")
PUBLIC_MODULE_ALIASES = {"network": "rede"}
MODULE_LABELS = {
    "base": "Base", "audio": "Audio", "energia": "Energy", "fontes": "Fonts",
    "kde": "KDE Plasma", "bluetooth": "Bluetooth", "rede": "Network",
    "nix": "Nix", "nix_opengl": "Nix OpenGL", "steam": "Steam", "swap": "Swap",
}
PRIVILEGED_OPERATIONS = {"apply-full", "apply-diagnostics", "apply-module", "migrate-stable-channel", "refresh-nix-apps"}


def backend_module(module: object) -> str | None:
    if not isinstance(module, str):
        return None
    normalized = PUBLIC_MODULE_ALIASES.get(module, module)
    return normalized if normalized in DIAGNOSTIC_MODULES else None


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
        actual = {str(path.relative_to(backend)) for path in backend.rglob("*") if path.is_file()}
        if actual != set(expected):
            return False, "Embedded backend files differ from the manifest."
        for relative, expected_digest in expected.items():
            digest = hashlib.sha256((backend / relative).read_bytes()).hexdigest()
            if digest != expected_digest:
                return False, f"Backend checksum mismatch: {relative}"
    except OSError as exc:
        return False, f"Could not validate backend: {exc}"
    return True, "Embedded backend matches the release manifest."


def release_version(root: Path) -> str:
    try:
        for line in (root / "RELEASE-VERSIONS").read_text(encoding="utf-8").splitlines():
            if line.startswith("frontend="):
                return line.partition("=")[2].strip()
    except OSError:
        pass
    return "unknown"


def operation_dir(root: Path) -> Path:
    directory = root / ".alpine-state" / "web" / release_version(root) / "operations"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def command_environment(root: Path) -> dict[str, str]:
    env = os.environ.copy()
    paths = [str(Path.home() / ".local/bin"), str(Path.home() / ".nix-profile/bin"), "/nix/var/nix/profiles/default/bin", "/usr/local/sbin", "/usr/local/bin", "/usr/sbin", "/usr/bin", "/sbin", "/bin", env.get("PATH", "")]
    env["PATH"] = os.pathsep.join(path for path in paths if path)
    env["ALPINE_DESKTOP_CENTER_ROOT"] = str(root)
    return env


def diagnostic_command(module: str) -> list[str]:
    return ["python3", "scripts/diagnostico-modulo.py", module, "--json"]


def english_output(text: str) -> str:
    for source, target in {"sobre PipeWire respondeu.": "responded through PipeWire.", "desconhecido": "unknown"}.items():
        text = text.replace(source, target)
    return text


def terminal_command(script: Path) -> list[str] | None:
    """Return a visible terminal invocation for commands that need a TTY."""
    for name in ("konsole", "xterm", "alacritty", "kitty", "foot", "xfce4-terminal"):
        executable = shutil.which(name)
        if not executable:
            continue
        if name in {"konsole", "xterm", "alacritty", "xfce4-terminal"}:
            return [executable, "-e", "sh", str(script)]
        return [executable, "sh", str(script)]
    return None


def execute_privileged_in_terminal(root: Path, backend: Path, command: list[str], operation_dir_path: Path, operation_id: str, env: dict[str, str]) -> tuple[str, int]:
    """Run an allow-listed privileged command in a visible terminal."""
    output_path = operation_dir_path / f"{operation_id}.terminal-output"
    status_path = operation_dir_path / f"{operation_id}.terminal-status"
    script_path = operation_dir_path / f"{operation_id}.terminal.sh"
    command_line = " ".join(shlex.quote(part) for part in command)
    script_lines = [
        "#!/bin/sh",
        "set +e",
        "printf '%s\\n' 'Alpine Desktop Center privileged operation' 'The command may ask for your doas password in this terminal.' 'The password is handled by doas and is not collected or stored by the application.' ''",
        f"printf '$ %s\\n\\n' {shlex.quote(command_line)}",
        f"cd {shlex.quote(str(backend))} || exit 125",
        f"{command_line} > {shlex.quote(str(output_path))} 2>&1",
        "status=$?",
        f"cat {shlex.quote(str(output_path))}",
        f'''printf '%s' "$status" > {shlex.quote(str(status_path))}''',
        "printf '\\n\\nOperation finished with exit code %s. Press Enter to close this terminal...' \"$status\"",
        "read -r _",
        "exit \"$status\"",
        "",
    ]
    script_path.write_text("\n".join(script_lines), encoding="utf-8")
    script_path.chmod(0o700)
    invocation = terminal_command(script_path)
    if invocation is None:
        return "No supported terminal emulator was found for the doas-authenticated operation.", 127
    try:
        terminal = subprocess.Popen(invocation, cwd=backend, env=env, start_new_session=False)
    except OSError as exc:
        return f"Could not open a terminal for the privileged operation: {exc}", 1
    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        if status_path.is_file():
            try:
                return output_path.read_text(encoding="utf-8", errors="replace"), int(status_path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                pass
        if terminal.poll() is not None and not status_path.exists():
            return "The terminal closed before the privileged operation reported a result.", 1
        time.sleep(0.2)
    if terminal.poll() is None:
        terminal.terminate()
    return "The privileged operation exceeded the 15-minute safety timeout.", 124


def resolve_command(operation: str, payload: dict[str, object]) -> tuple[list[list[str]], str]:
    if operation == "system-check":
        return ([diagnostic_command(module) for module in ("base", "audio", "rede", "energia")], "read-only system checks")
    if operation == "check-all-modules":
        return ([diagnostic_command(module) for module in DIAGNOSTIC_MODULES], "all module diagnostics")
    if operation == "diagnose-module":
        module = backend_module(payload.get("module"))
        if module is None:
            raise ValueError("A valid module identifier is required for diagnose-module.")
        return ([diagnostic_command(module)], f"check module {module}")
    simple = {
        "check-stable-channel": (["python3", "scripts/canal-stable-nix.py", "verificar"], "check official Stable Nix channel"),
        "migrate-stable-channel": (["python3", "scripts/canal-stable-nix.py", "migrar"], "migrate official Stable Nix channel"),
        "refresh-nix-apps": (["make", "atualizar-aplicativos-nix"], "refresh Nix applications"),
        "apply-full": (["make", "aplicar"], "apply full configuration"),
        "apply-diagnostics": (["make", "diagnostico"], "apply configuration with diagnostics"),
    }
    if operation in simple:
        command, description = simple[operation]
        return ([command], description)
    if operation == "apply-module":
        module = backend_module(payload.get("module"))
        if module is None:
            raise ValueError("A valid module identifier is required for apply-module.")
        return ([["make", "aplicar-modulo", f"MODULO={module}"]], f"apply module {module}")
    raise ValueError(f"Unsupported operation: {operation}")


def execute_operation(root: Path, operation: str, payload: dict[str, object], lock: threading.Lock) -> dict[str, object]:
    if not lock.acquire(blocking=False):
        return {"status": "blocked", "operation": operation, "message": "Another backend operation is already running. Wait for it to finish."}
    try:
        valid, message = validate_backend(root)
        if not valid:
            return {"status": "blocked", "operation": operation, "message": message}
        if operation == "validate-backend":
            return {"status": "success", "operation": operation, "message": message, "output": message}
        try:
            commands, description = resolve_command(operation, payload)
        except ValueError as exc:
            return {"status": "error", "operation": operation, "message": str(exc)}

        operation_id = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
        log_path = operation_dir(root) / f"{operation_id}.log"
        started = time.monotonic()
        env = command_environment(root)
        backend = root / "backend"
        output_parts = [f"Operation: {description}", f"Started: {datetime.now().astimezone().isoformat(timespec='seconds')}", f"Backend: {backend}", "Backend integrity: PASS immediately before execution", ""]
        return_code = 0
        try:
            with log_path.open("w", encoding="utf-8") as log:
                for command in commands:
                    valid, validation_message = validate_backend(root)
                    if not valid:
                        return_code = 2
                        output_parts.append(f"Backend validation failed immediately before command: {validation_message}")
                        break
                    command_line = " ".join(command)
                    output_parts.append(f"$ {command_line}")
                    log.write(f"$ {command_line}\n")
                    log.flush()
                    if operation in PRIVILEGED_OPERATIONS:
                        command_output, return_code = execute_privileged_in_terminal(root, backend, command, log_path.parent, operation_id, env)
                    else:
                        process = subprocess.Popen(command, cwd=backend, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
                        try:
                            command_output, _ = process.communicate(timeout=900)
                        except subprocess.TimeoutExpired:
                            os.killpg(process.pid, signal.SIGTERM)
                            try:
                                command_output, _ = process.communicate(timeout=10)
                            except subprocess.TimeoutExpired:
                                os.killpg(process.pid, signal.SIGKILL)
                                command_output, _ = process.communicate()
                            return_code = 124
                            output_parts.append("The backend command exceeded the 15-minute safety timeout and its process group was terminated.")
                    command_output = english_output(command_output or "")
                    log.write(command_output)
                    log.flush()
                    output_parts.append(command_output.rstrip())
                    if return_code or (operation not in PRIVILEGED_OPERATIONS and process.returncode != 0):
                        return_code = return_code or process.returncode
                        break
        except FileNotFoundError as exc:
            return_code = 127
            output_parts.append(f"Cannot start backend command: {exc}. Install the required backend dependencies first.")
        except OSError as exc:
            return_code = 1
            output_parts.append(f"Could not execute backend command: {exc}")

        output = "\n".join(part for part in output_parts if part is not None)
        log_path.write_text(output + "\n", encoding="utf-8")
        elapsed = round(time.monotonic() - started, 2)
        status = "success" if return_code == 0 else "error"
        return {"status": status, "operation": operation, "message": f"{description.capitalize()} {'completed successfully.' if return_code == 0 else 'failed.'}", "output": output, "log_id": operation_id, "log_path": str(log_path.relative_to(root)), "return_code": return_code, "elapsed_seconds": elapsed}
    finally:
        lock.release()


class Handler(BaseHTTPRequestHandler):
    server_version = "AlpineDesktopCenterLocal/0.3"

    @property
    def app_server(self) -> ThreadingHTTPServer:
        return self.server  # type: ignore[return-value]

    @property
    def root(self) -> Path:
        return self.app_server.root  # type: ignore[attr-defined]

    def log_message(self, fmt: str, *args: object) -> None:
        print(fmt % args, flush=True)

    def send_json(self, payload: dict[str, object], status: int = HTTPStatus.OK) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def reject(self, message: str, status: int = HTTPStatus.FORBIDDEN) -> None:
        self.send_json({"status": "blocked", "message": message}, status)

    def authorized(self) -> bool:
        parsed = urlparse(self.path)
        host = self.headers.get("Host", "").split(":", 1)[0].lower()
        if host not in {"127.0.0.1", "localhost", "[::1]"}:
            self.reject("The local bridge accepts requests only through loopback.")
            return False
        origin = self.headers.get("Origin")
        if origin and not (origin.startswith("http://127.0.0.1:") or origin.startswith("http://localhost:")):
            self.reject("The request origin is not allowed.")
            return False
        token = self.headers.get("X-ADC-Token")
        if not token or not secrets.compare_digest(token, self.app_server.session_token):
            self.reject("A valid local session token is required.")
            return False
        if parsed.path.startswith("/api/") and self.command == "POST" and self.headers.get_content_type() != "application/json":
            self.reject("Operation requests must use application/json.", HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
            return False
        return True

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path.startswith("/api/") and not self.authorized():
            return
        if path == "/api/health":
            valid, message = validate_backend(self.root)
            self.send_json({"bridge": "local", "backend": "validated" if valid else "failed", "message": message, "release_root": str(self.root), "frontend_version": release_version(self.root)}, HTTPStatus.OK if valid else HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if path == "/api/backend/status":
            valid, message = validate_backend(self.root)
            self.send_json({"valid": valid, "message": message, "frontend_version": release_version(self.root)})
            return
        if path == "/api/modules":
            self.send_json({"modules": [{"id": module, "name": MODULE_LABELS[module], "state": "Unknown", "detail": "Run a live diagnostic."} for module in DIAGNOSTIC_MODULES]})
            return
        if path == "/api/logs":
            logs = []
            for log_path in sorted(operation_dir(self.root).glob("*.log"), reverse=True)[:50]:
                logs.append({"id": log_path.stem, "path": str(log_path.relative_to(self.root)), "modified": log_path.stat().st_mtime})
            self.send_json({"logs": logs})
            return
        if path.startswith("/api/"):
            self.send_json({"error": "Unknown API endpoint."}, HTTPStatus.NOT_FOUND)
            return
        self.serve_static(path)

    def do_POST(self) -> None:  # noqa: N802
        if not self.authorized():
            return
        path = urlparse(self.path).path
        prefix = "/api/operations/"
        if not path.startswith(prefix):
            self.send_json({"error": "Unknown API endpoint."}, HTTPStatus.NOT_FOUND)
            return
        operation = path.removeprefix(prefix)
        if operation not in OPERATIONS:
            self.send_json({"error": "Operation is not in the named allowlist."}, HTTPStatus.NOT_FOUND)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length else b"{}"
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("Request body must be a JSON object.")
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json({"status": "error", "message": f"Invalid operation request: {exc}"}, HTTPStatus.BAD_REQUEST)
            return
        result = execute_operation(self.root, operation, payload, self.app_server.operation_lock)
        status = {"success": HTTPStatus.OK, "error": HTTPStatus.BAD_GATEWAY, "blocked": HTTPStatus.CONFLICT}.get(str(result.get("status")), HTTPStatus.BAD_REQUEST)
        self.send_json(result, status)

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
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mimetypes.guess_type(str(candidate))[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main() -> int:
    parser = argparse.ArgumentParser(description="Alpine Desktop Center local browser server")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=43127)
    parser.add_argument("--token", default="", help="Per-launch token supplied by the local launcher")
    args = parser.parse_args()
    root = args.root.resolve()
    token = args.token or secrets.token_urlsafe(32)
    valid, message = validate_backend(root)
    make_status = shutil.which("make", path=command_environment(root)["PATH"]) or "not found"
    print(f"Backend validation: {'PASS' if valid else 'FAIL'} — {message}", flush=True)
    print(f"Make executable: {make_status}", flush=True)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.root = root  # type: ignore[attr-defined]
    server.session_token = token  # type: ignore[attr-defined]
    server.operation_lock = threading.Lock()  # type: ignore[attr-defined]
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
