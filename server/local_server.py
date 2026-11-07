#!/usr/bin/env python3
"""Secure loopback bridge for Alpine Desktop Center.

The browser may request only named operations against the embedded backend.
The bridge is intentionally local-only, session-bound and release-contained.
"""
from __future__ import annotations

import argparse
import codecs
import dataclasses
import errno
import fcntl
import hashlib
import ipaddress
import json
import mimetypes
import os
import pty
import select
import re
import shlex
import secrets
import shutil
import signal
import stat
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from typing import TextIO
from urllib.parse import parse_qs, urlparse

COMMAND_TIMEOUT_SECONDS = 900
PTY_TERMINATION_GRACE_SECONDS = 2
PTY_HARD_STOP_GRACE_SECONDS = 2
MAX_REQUEST_BODY_BYTES = 16_384
MAX_SESSION_OUTPUT_CHARS = 1_000_000
MAX_CACHED_SESSIONS = 100
MAX_PERSISTED_LOGS = 50
MAX_PERSISTED_LOG_BYTES = 50_000_000
DIAGNOSTIC_MAX_AGE_SECONDS = 600
OPERATIONS = {
    "validate-backend", "system-check", "check-all-modules", "diagnose-module",
    "simulate-full", "apply-full", "apply-diagnostics", "refresh-nix-apps",
    "update-nix-apps", "list-nix-apps", "search-nix-packages", "install-nix-package", "uninstall-nix-app", "collect-nix-garbage", "refresh-kde-apps", "check-stable-channel",
    "migrate-stable-channel", "apply-module",
}
DIAGNOSTIC_MODULES = ("base", "audio", "energia", "fontes", "kde", "bluetooth", "rede", "nix", "nix_opengl", "steam", "swap")
PUBLIC_MODULE_ALIASES = {"network": "rede"}
MODULE_LABELS = {
    "base": "Base", "audio": "Audio", "energia": "Energy", "fontes": "Fonts",
    "kde": "KDE Plasma", "bluetooth": "Bluetooth", "rede": "Network",
    "nix": "Nix", "nix_opengl": "Nix OpenGL", "steam": "Steam", "swap": "Swap",
}
MODULE_ACCENTS = {
    "base": "cyan", "audio": "amber", "energia": "amber", "fontes": "pink",
    "kde": "violet", "bluetooth": "blue", "rede": "green", "nix": "blue",
    "nix_opengl": "cyan", "steam": "pink", "swap": "amber",
}
MODULE_DESKTOP_TARGETS = {
    "kde": ("kde",),
}
DIAGNOSTIC_STATUSES = {"complete", "partial", "incomplete", "unknown"}
CHECK_STATUSES = {"ok", "warning", "error", "unknown"}
DEPENDENCY_STATUSES = {"not_checked", *DIAGNOSTIC_STATUSES}
PRIVILEGED_OPERATIONS = {
    "simulate-full", "apply-full", "apply-diagnostics", "apply-module",
}
SYSTEM_TERMINAL_OPERATIONS = PRIVILEGED_OPERATIONS | {"migrate-stable-channel"}
SESSIONS: dict[str, "OperationSession"] = {}
SESSIONS_LOCK = threading.Lock()
DIAGNOSTIC_CACHE: dict[str, dict[str, object]] = {}
DIAGNOSTIC_LOCK = threading.Lock()
STABLE_CHANNEL_CACHE: tuple[dict[str, object], float] | None = None
STABLE_CHANNEL_LOCK = threading.Lock()
NIX_SEARCH_CACHE: dict[str, tuple[list[dict[str, object]], float]] = {}
NIX_SEARCH_CACHE_LOCK = threading.Lock()
NIX_SEARCH_CACHE_TTL_SECONDS = 300
LINGERING_PROCESS_PIDS: set[int] = set()
LINGERING_PROCESS_LOCK = threading.Lock()


DESKTOP_CAPABILITIES = {
    "kde": ("KDE Plasma", ("KDE Plasma integration", "KDE application menu refresh", "Plasma session controls")),
    "gnome": ("GNOME", ("GNOME Shell integration", "GNOME application menu refresh", "GNOME session controls")),
    "xfce": ("XFCE", ("XFCE desktop integration", "XFCE application menu refresh")),
    "mate": ("MATE", ("MATE desktop integration", "MATE application menu refresh")),
    "lxqt": ("LXQt", ("LXQt desktop integration", "LXQt application menu refresh")),
    "cinnamon": ("Cinnamon", ("Cinnamon desktop integration", "Cinnamon application menu refresh")),
    "budgie": ("Budgie", ("Budgie desktop integration", "Budgie application menu refresh")),
    "unknown": ("Generic Linux desktop", ("Generic desktop integration",)),
}

def detect_desktop_environment() -> dict[str, object]:
    env = os.environ
    candidates = [
        (env.get("XDG_CURRENT_DESKTOP", ""), "XDG_CURRENT_DESKTOP"),
        (env.get("XDG_SESSION_DESKTOP", ""), "XDG_SESSION_DESKTOP"),
        (env.get("DESKTOP_SESSION", ""), "DESKTOP_SESSION"),
    ]
    aliases = (
        ("kde", "kde"), ("plasma", "kde"), ("gnome", "gnome"),
        ("xfce", "xfce"), ("xfce4", "xfce"), ("mate", "mate"),
        ("lxqt", "lxqt"), ("cinnamon", "cinnamon"), ("budgie", "budgie"),
    )
    detected = ""
    source = "fallback"
    for raw, candidate_source in candidates:
        normalized = raw.lower().replace(";", ":").replace("_", "-")
        for token, desktop_id in aliases:
            if token in normalized:
                detected = desktop_id
                source = candidate_source
                break
        if detected:
            break
    if not detected:
        if env.get("KDE_FULL_SESSION") or env.get("KDE_SESSION_VERSION"):
            detected, source = "kde", "KDE session markers"
        elif env.get("GNOME_DESKTOP_SESSION_ID") or env.get("GNOME_SHELL_SESSION_MODE"):
            detected, source = "gnome", "GNOME session markers"
        else:
            detected = "unknown"
    name, capabilities = DESKTOP_CAPABILITIES[detected]
    return {"id": detected, "name": name, "session_type": env.get("XDG_SESSION_TYPE", "unknown"), "detection_source": source, "capabilities": list(capabilities)}


def module_desktop_targets(module: str, catalog_entry: dict[str, object] | None = None) -> tuple[str, ...]:
    declared = catalog_entry.get("desktop_targets") if catalog_entry else None
    if isinstance(declared, list) and declared and all(isinstance(target, str) for target in declared):
        return tuple(declared)
    return MODULE_DESKTOP_TARGETS.get(module, ("shared",))


def module_desktop_blocker(module: str, catalog_entry: dict[str, object] | None = None) -> str | None:
    desktop_id = str(detect_desktop_environment().get("id", "unknown"))
    targets = module_desktop_targets(module, catalog_entry)
    if "shared" in targets or desktop_id in targets:
        return None
    return f"The {module} module is not available for the detected {desktop_id} desktop."


def detect_nix_support() -> dict[str, object]:
    nix_env = shutil.which("nix-env")
    nix_channel = shutil.which("nix-channel")
    if not nix_env or not nix_channel:
        return {"supported": False, "nix_env": bool(nix_env), "stable_channel": False, "version": None, "reason": "Classic Nix support is not installed."}
    try:
        version_result = subprocess.run([nix_env, "--version"], capture_output=True, text=True, timeout=3, check=False)
        channel_result = subprocess.run([nix_channel, "--list"], capture_output=True, text=True, timeout=3, check=False)
    except (OSError, subprocess.SubprocessError):
        return {"supported": False, "nix_env": True, "stable_channel": False, "version": None, "reason": "Classic Nix could not be queried."}
    version = version_result.stdout.strip() or None
    channels = channel_result.stdout.splitlines() if channel_result.returncode == 0 else []
    stable_channel = any(line.split()[0] in {"nixpkgs", "nixos"} and "unstable" not in line.lower() for line in channels if line.split())
    supported = version_result.returncode == 0 and stable_channel
    reason = None if supported else "A configured Stable Nix channel is required."
    return {"supported": supported, "nix_env": True, "stable_channel": stable_channel, "version": version, "reason": reason}


def detect_base_status() -> dict[str, object]:
    checks = []
    for package in ("doas", "bash", "curl", "git", "shadow"):
        installed = shutil.which("apk") is not None and subprocess.run(["apk", "info", "-e", package], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3, check=False).returncode == 0
        checks.append({"id": package, "label": package, "ready": installed})
    repositories = Path("/etc/apk/repositories")
    community = repositories.is_file() and "community" in repositories.read_text(errors="replace")
    checks.append({"id": "community", "label": "community repository", "ready": community})
    checks.append({"id": "ansible", "label": "ansible-playbook", "ready": shutil.which("ansible-playbook") is not None})
    return {"ready": all(check["ready"] for check in checks), "checks": checks}


def backend_module(module: object) -> str | None:
    if not isinstance(module, str):
        return None
    normalized = PUBLIC_MODULE_ALIASES.get(module, module)
    return normalized if normalized in DIAGNOSTIC_MODULES else None


@dataclasses.dataclass
class OperationSession:
    session_id: str
    root: Path
    operation: str
    payload: dict[str, object]
    status: str = "running"
    message: str = "Operation is running."
    return_code: int | None = None
    output: str = ""
    output_truncated: bool = False
    results: list[dict[str, object]] = dataclasses.field(default_factory=list)
    log_path: str | None = None
    nix_apps: list[dict[str, object]] = dataclasses.field(default_factory=list)
    nix_packages: list[dict[str, object]] = dataclasses.field(default_factory=list)
    thread: threading.Thread | None = None
    lock: threading.Lock = dataclasses.field(default_factory=threading.Lock)

    def append(self, text: str) -> None:
        if not text:
            return
        with self.lock:
            if self.output_truncated:
                return
            remaining = MAX_SESSION_OUTPUT_CHARS - len(self.output)
            if len(text) <= remaining:
                self.output += text
            else:
                marker = "\n[Session output truncated at the safety limit.]\n"
                marker_size = min(remaining, len(marker))
                self.output += text[:remaining - marker_size] + marker[:marker_size]
                self.output_truncated = True

    def snapshot(self, cursor: int = 0) -> dict[str, object]:
        with self.lock:
            safe_cursor = max(0, min(cursor, len(self.output)))
            return {
                "session_id": self.session_id,
                "status": self.status,
                "message": self.message,
                "return_code": self.return_code,
                "output": self.output[safe_cursor:],
                "next_cursor": len(self.output),
                "results": self.results.copy(),
                "nix_apps": self.nix_apps.copy(),
                "nix_packages": self.nix_packages.copy(),
                "log_path": self.log_path,
            }


def validate_backend(root: Path) -> tuple[bool, str]:
    backend = root / "backend"
    manifest = root / "BACKEND-MANIFEST.sha256"
    if not backend.is_dir() or backend.is_symlink() or not manifest.is_file() or manifest.is_symlink():
        return False, "Embedded backend or manifest is missing."
    try:
        expected: dict[str, str] = {}
        for line in manifest.read_text(encoding="utf-8").splitlines():
            match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
            if match is None:
                return False, "Backend manifest contains an invalid line."
            digest, relative = match.groups()
            manifest_path = PurePosixPath(relative)
            if manifest_path.is_absolute() or any(part in {"", ".", ".."} for part in manifest_path.parts):
                return False, "Backend manifest contains an unsafe path."
            normalized = manifest_path.as_posix()
            if normalized in expected:
                return False, "Backend manifest contains a duplicate path."
            expected[normalized] = digest
        if not expected:
            return False, "Backend manifest is empty."
        actual: set[str] = set()
        for path in backend.rglob("*"):
            if path.is_symlink():
                return False, "Embedded backend contains a symbolic link."
            if path.is_file():
                actual.add(path.relative_to(backend).as_posix())
        if actual != set(expected):
            return False, "Embedded backend files differ from the manifest."
        for relative, expected_digest in expected.items():
            digest = hashlib.sha256((backend / relative).read_bytes()).hexdigest()
            if digest != expected_digest:
                return False, f"Backend checksum mismatch: {relative}"
    except (OSError, UnicodeError, ValueError) as exc:
        return False, f"Could not validate backend: {exc}"
    return True, "Embedded backend matches the release manifest."


def release_metadata(root: Path) -> dict[str, str]:
    metadata: dict[str, str] = {}
    try:
        for line in (root / "RELEASE-VERSIONS").read_text(encoding="utf-8").splitlines():
            key, separator, value = line.partition("=")
            if separator and key:
                metadata[key.strip()] = value.strip()
    except OSError:
        return metadata
    return metadata


def release_version(root: Path) -> str:
    return release_metadata(root).get("frontend", "unknown")


def release_state_dir(root: Path, create: bool = True) -> Path:
    version = release_version(root)
    if not re.fullmatch(r"[A-Za-z0-9._+-]{1,128}", version) or version in {".", ".."}:
        raise OSError("Frontend release version is invalid for a state directory.")
    directories = [
        root / ".alpine-state",
        root / ".alpine-state" / "web",
        root / ".alpine-state" / "web" / version,
    ]
    for directory in directories:
        if directory.is_symlink():
            raise OSError("Release-local state path may not be a symbolic link.")
        if create:
            directory.mkdir(mode=0o700, exist_ok=True)
            directory.chmod(0o700)
        elif not directory.exists():
            break
        elif not directory.is_dir():
            raise OSError("Release-local state path contains a non-directory component.")
    resolved = directories[-1].resolve()
    try:
        resolved.relative_to(root.resolve())
    except ValueError as exc:
        raise OSError("Release-local state path escapes the release directory.") from exc
    return directories[-1]


def operation_dir(root: Path, create: bool = True) -> Path:
    base = release_state_dir(root, create=create)
    directory = base / "operations"
    if directory.is_symlink():
        raise OSError("Release-local state path may not be a symbolic link.")
    if create:
        directory.mkdir(mode=0o700, exist_ok=True)
        directory.chmod(0o700)
    elif directory.exists() and not directory.is_dir():
        raise OSError("Release-local state path contains a non-directory component.")
    try:
        directory.resolve().relative_to(base.resolve())
    except ValueError as exc:
        raise OSError("Release-local state path escapes the release directory.") from exc
    return directory


def operation_log_categories(operation: str, payload: dict[str, object]) -> tuple[str, ...]:
    if operation == "validate-backend":
        return ("verify", "backend")
    if operation == "system-check":
        return ("verify", "system")
    if operation == "check-all-modules":
        return ("verify", "all-modules")
    if operation == "diagnose-module":
        module = backend_module(payload.get("module"))
        return ("verify", "modules", module) if module else ("verify", "modules")
    if operation == "simulate-full":
        return ("apply", "preview")
    if operation == "apply-full":
        return ("apply", "all-modules")
    if operation == "apply-diagnostics":
        return ("apply", "diagnostics")
    if operation == "apply-module":
        module = backend_module(payload.get("module"))
        return ("apply", "modules", module) if module else ("apply", "modules")
    if operation == "check-stable-channel":
        return ("nix", "stable-check")
    if operation == "migrate-stable-channel":
        return ("nix", "stable-migration")
    if operation in {"refresh-nix-apps", "update-nix-apps", "list-nix-apps", "uninstall-nix-app", "collect-nix-garbage"}:
        return ("nix", "profile-apps")
    if operation == "refresh-kde-apps":
        return ("nix", "kde-refresh")
    return ("other",)


def operation_log_path(root: Path, operation: str, payload: dict[str, object], session_id: str) -> Path:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", session_id):
        raise OSError("Operation session identifier is invalid for a log path.")
    operation_dir(root)  # Preserve the private legacy directory used for temporary operation files.
    base = release_state_dir(root)
    current = base
    parts = operation_log_categories(operation, payload)
    for part in ("logs", *parts):
        current = current / part
        if current.is_symlink():
            raise OSError("Operation log directories may not be symbolic links.")
        current.mkdir(mode=0o700, exist_ok=True)
        current.chmod(0o700)
        if not current.is_dir():
            raise OSError("Operation log path is not a directory.")
        try:
            current.resolve().relative_to(base.resolve())
        except ValueError as exc:
            raise OSError("Operation log path escapes the release state directory.") from exc
    return current / f"{session_id}.log"


def prune_operation_logs(directory: Path) -> None:
    files: list[tuple[int, Path, int]] = []
    for path in directory.rglob("*.log"):
        if path.is_symlink():
            path.unlink(missing_ok=True)
            continue
        try:
            info = path.lstat()
        except OSError:
            continue
        if stat.S_ISREG(info.st_mode):
            files.append((info.st_mtime_ns, path, info.st_size))
    files.sort(key=lambda item: item[0], reverse=True)
    kept = 0
    total_bytes = 0
    for _, path, size in files:
        if kept >= MAX_PERSISTED_LOGS - 1 or total_bytes + size > MAX_PERSISTED_LOG_BYTES:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                continue
        else:
            kept += 1
            total_bytes += size


def acquire_server_lock(root: Path) -> int:
    state_dirs = [root / ".alpine-state", root / ".alpine-state" / "web"]
    for directory in state_dirs:
        if directory.is_symlink():
            raise OSError("Server state path may not be a symbolic link.")
        directory.mkdir(mode=0o700, exist_ok=True)
        directory.chmod(0o700)
    try:
        state_dirs[-1].resolve().relative_to(root.resolve())
    except ValueError as exc:
        raise OSError("Server state path escapes the release directory.") from exc
    lock_path = state_dirs[-1] / "server.lock"
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0), 0o600)
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_nlink != 1:
        os.close(fd)
        raise OSError("Server lock file has unsafe ownership or permissions.")
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError as exc:
        os.close(fd)
        raise OSError("Another Alpine Desktop Center server is already running for this release.") from exc
    return fd


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


def validate_diagnostic_payload(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ValueError("Diagnostic payload must be an object.")
    if value.get("schema_version") != 1:
        raise ValueError("Unsupported diagnostic schema version.")
    if value.get("module") not in DIAGNOSTIC_MODULES:
        raise ValueError("Diagnostic payload has an unknown module identifier.")
    if not isinstance(value.get("checked_at"), str) or not value["checked_at"]:
        raise ValueError("Diagnostic payload has no check timestamp.")
    try:
        checked_at = datetime.fromisoformat(value["checked_at"])
    except ValueError as exc:
        raise ValueError("Diagnostic timestamp is invalid.") from exc
    if checked_at.tzinfo is None:
        raise ValueError("Diagnostic timestamp must include a timezone.")
    if value.get("status") not in DIAGNOSTIC_STATUSES:
        raise ValueError("Diagnostic payload has an unknown module status.")
    summary = value.get("summary")
    summary_fields = ("passed", "failed", "warnings", "unknown", "total", "required_total")
    if not isinstance(summary, dict) or any(type(summary.get(key)) is not int or summary[key] < 0 for key in summary_fields):
        raise ValueError("Diagnostic summary is missing a non-negative integer field.")
    if summary["required_total"] > summary["total"] or sum(summary[key] for key in summary_fields[:4]) != summary["total"]:
        raise ValueError("Diagnostic summary counts are inconsistent.")
    checks = value.get("checks")
    if not isinstance(checks, list) or len(checks) != summary["total"]:
        raise ValueError("Diagnostic checks do not match the summary total.")
    for check in checks:
        if not isinstance(check, dict):
            raise ValueError("Diagnostic check must be an object.")
        if any(not isinstance(check.get(key), str) for key in ("id", "title", "description", "message")):
            raise ValueError("Diagnostic check is missing a text field.")
        if check.get("status") not in CHECK_STATUSES or type(check.get("required")) is not bool:
            raise ValueError("Diagnostic check has an invalid status or required flag.")
    dependencies = value.get("dependencies")
    if not isinstance(dependencies, list):
        raise ValueError("Diagnostic dependencies must be a list.")
    dependency_modules: set[str] = set()
    for dependency in dependencies:
        if not isinstance(dependency, dict) or dependency.get("module") not in DIAGNOSTIC_MODULES or dependency.get("status") not in DEPENDENCY_STATUSES:
            raise ValueError("Diagnostic dependency has an invalid module or status.")
        dependency_module = str(dependency["module"])
        if dependency_module == value["module"] or dependency_module in dependency_modules:
            raise ValueError("Diagnostic dependencies must be unique and may not reference the module itself.")
        dependency_modules.add(dependency_module)
    return value


def parse_stable_channel_report(output: str) -> dict[str, object] | None:
    start = output.find("{")
    end = output.rfind("}")
    if start < 0 or end < start:
        return None
    try:
        value = json.loads(output[start:end + 1])
    except json.JSONDecodeError:
        return None
    if not isinstance(value, dict):
        return None
    if value.get("status") == "unknown" and isinstance(value.get("message"), str) and value["message"]:
        return {"status": "unknown", "message": value["message"]}
    status = value.get("status")
    latest = value.get("latest_version")
    current = value.get("current_version")
    if status not in ("current", "update_available") or value.get("source") != "https://status.nixos.org/":
        return None
    if not isinstance(latest, str) or not re.fullmatch(r"\d+\.\d+", latest):
        return None
    if value.get("latest_channel") != f"https://nixos.org/channels/nixos-{latest}":
        return None
    if current is not None and (not isinstance(current, str) or not re.fullmatch(r"\d+\.\d+", current)):
        return None
    if status == "current" and current != latest:
        return None
    if status == "update_available" and current == latest:
        return None
    return {"status": status, "current_version": current, "latest_version": latest, "latest_channel": value["latest_channel"], "source": value["source"]}


def stable_channel_migration_blocker() -> str | None:
    with STABLE_CHANNEL_LOCK:
        cached = STABLE_CHANNEL_CACHE
    if not cached:
        return "Run a successful official Stable channel check before migration."
    report, checked_at = cached
    age = time.monotonic() - checked_at
    if age < 0 or age > DIAGNOSTIC_MAX_AGE_SECONDS:
        return "The official Stable channel check expired; run it again before migration."
    if report.get("status") != "update_available":
        return "The latest official Stable check did not confirm an available update."
    return None


def diagnostic_is_fresh(diagnostic: dict[str, object] | None) -> bool:
    if not diagnostic or not isinstance(diagnostic.get("checked_at"), str):
        return False
    try:
        checked_at = datetime.fromisoformat(diagnostic["checked_at"])
    except ValueError:
        return False
    if checked_at.tzinfo is None:
        return False
    age = (datetime.now().astimezone() - checked_at).total_seconds()
    return -60 <= age <= DIAGNOSTIC_MAX_AGE_SECONDS


def module_apply_blocker(root: Path, module: str) -> str | None:
    with DIAGNOSTIC_LOCK:
        module_diagnostic = DIAGNOSTIC_CACHE.get(module)
        cached_diagnostics = DIAGNOSTIC_CACHE.copy()
    if not diagnostic_is_fresh(module_diagnostic):
        return "Run a recent diagnostic for this module before applying it."
    if module_diagnostic.get("status") == "unknown":
        return "The module diagnostic status is unknown; rerun it before applying."
    try:
        catalog = json.loads((root / "backend" / "modulos.json").read_text(encoding="utf-8"))
        entry = next(item for item in catalog if isinstance(item, dict) and item.get("key") == module)
        desktop_blocker = module_desktop_blocker(module, entry)
        if desktop_blocker:
            return desktop_blocker
        dependencies = entry.get("dependencies")
        if not isinstance(dependencies, list) or not all(isinstance(item, str) for item in dependencies):
            raise ValueError("Module dependency catalog is invalid.")
    except (OSError, json.JSONDecodeError, StopIteration, TypeError, ValueError):
        return "The backend dependency catalog could not be validated."
    reported_dependencies = module_diagnostic.get("dependencies")
    if not isinstance(reported_dependencies, list):
        return "The module diagnostic has no valid dependency declaration."
    reported_ids: list[str] = []
    for dependency in reported_dependencies:
        if not isinstance(dependency, dict) or dependency.get("status") != "not_checked":
            return "The module diagnostic dependency states are inconsistent; rerun the diagnostic."
        dependency_id = backend_module(dependency.get("module"))
        if dependency_id is None:
            return "The module diagnostic declares an unsupported dependency."
        reported_ids.append(dependency_id)
    expected_ids: list[str] = []
    for dependency in dependencies:
        dependency_id = backend_module(dependency)
        if dependency_id is None:
            return f"The backend declares an unsupported dependency for {module}."
        expected_ids.append(dependency_id)
    if len(reported_ids) != len(set(reported_ids)) or sorted(reported_ids) != sorted(expected_ids):
        return "The module diagnostic dependency list does not match the backend catalog."
    for dependency in dependencies:
        dependency_id = backend_module(dependency)
        if dependency_id is None:
            return f"The backend declares an unsupported dependency for {module}."
        diagnostic = cached_diagnostics.get(dependency_id)
        if not diagnostic_is_fresh(diagnostic) or diagnostic.get("status") != "complete":
            return f"Run a recent complete diagnostic for dependency {dependency_id} before applying {module}."
    return None


def remember_diagnostic(diagnostic: dict[str, object]) -> None:
    with DIAGNOSTIC_LOCK:
        DIAGNOSTIC_CACHE[str(diagnostic["module"])] = diagnostic
        for module, cached in list(DIAGNOSTIC_CACHE.items()):
            if not diagnostic_is_fresh(cached):
                DIAGNOSTIC_CACHE.pop(module, None)


def terminal_command(script: Path) -> list[str] | None:
    """Return a visible terminal invocation for commands that need a TTY."""
    for name in ("konsole", "xterm", "xfce4-terminal"):
        executable = shutil.which(name)
        if not executable:
            continue
        if name == "konsole":
            return [executable, "--nofork", "-e", "sh", str(script)]
        if name == "xfce4-terminal":
            return [executable, "--disable-server", "--execute", "sh", str(script)]
        if name == "xterm":
            return [executable, "-e", "sh", str(script)]
    return None


def cleanup_terminal_artifacts(paths: tuple[Path, ...]) -> None:
    for path in paths:
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass


def read_private_file(path: Path, limit: int) -> str:
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_nlink != 1:
            raise OSError("Temporary operation file has unsafe ownership or permissions.")
        data = os.read(fd, limit + 1)
    finally:
        os.close(fd)
    if len(data) > limit:
        return data[:limit].decode("utf-8", errors="replace") + "\n[Output truncated at the safety limit.]\n"
    return data.decode("utf-8", errors="replace")


def read_private_file_chunk(path: Path, offset: int, limit: int) -> bytes:
    if offset < 0 or limit <= 0:
        raise ValueError("Temporary operation file offset or read limit is invalid.")
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_nlink != 1:
            raise OSError("Temporary operation file has unsafe ownership or permissions.")
        if offset > info.st_size:
            raise OSError("Temporary operation file changed unexpectedly while streaming.")
        os.lseek(fd, offset, os.SEEK_SET)
        return os.read(fd, limit)
    finally:
        os.close(fd)


def read_log_segments(path: Path) -> tuple[str, str, os.stat_result]:
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_nlink != 1:
            raise OSError("Operation log has unsafe ownership or permissions.")
        head = os.read(fd, min(info.st_size, 8192)).decode("utf-8", errors="replace")
        tail = ""
        if info.st_size > 8192:
            tail_size = min(info.st_size, 4096)
            os.lseek(fd, info.st_size - tail_size, os.SEEK_SET)
            tail = os.read(fd, tail_size).decode("utf-8", errors="replace")
        return head, tail, info
    finally:
        os.close(fd)


def operation_log_summary(root: Path, base: Path, path: Path) -> dict[str, object] | None:
    try:
        if path.is_symlink():
            return None
        resolved = path.resolve()
        resolved.relative_to(base.resolve())
        head, tail, info = read_log_segments(path)
        relative = path.relative_to(base)
    except (OSError, ValueError):
        return None
    content = f"{head}\n{tail}"
    description_match = re.search(r"^Operation: (.+)$", content, re.MULTILINE)
    named_match = re.search(r"^Named operation: ([a-z-]+)$", content, re.MULTILINE)
    module_match = re.search(r"^Module: ([a-z_]+)$", content, re.MULTILINE)
    started_match = re.search(r"^Started: (.+)$", content, re.MULTILINE)
    status_match = re.search(r"^Operation status: (success|error|blocked|running)$", content, re.MULTILINE)
    description = description_match.group(1).strip() if description_match else "Operation log"
    named_operation = named_match.group(1) if named_match else None
    parts = relative.parts
    module = module_match.group(1) if module_match else None
    if module is None:
        for index in range(max(0, len(parts) - 2)):
            if parts[index] == "modules" and backend_module(parts[index + 1]) is not None:
                module = parts[index + 1]
                break
    if named_operation is None:
        normalized = description.lower()
        named_operation = next((operation for phrase, operation in (
            ("check official stable nix channel", "check-stable-channel"),
            ("migrate official stable nix channel", "migrate-stable-channel"),
            ("apply module ", "apply-module"),
            ("check module ", "diagnose-module"),
            ("apply full configuration", "apply-full"),
            ("all module diagnostics", "check-all-modules"),
            ("read-only system checks", "system-check"),
            ("preview full configuration", "simulate-full"),
            ("uninstall nix package ", "uninstall-nix-app"),
            ("install nix package ", "install-nix-package"),
            ("collect unreachable nix store paths", "collect-nix-garbage"),
            ("search nix packages for ", "search-nix-packages"),
            ("list nix applications", "list-nix-apps"),
            ("update nix applications", "update-nix-apps"),
            ("refresh nix applications in kde", "refresh-kde-apps"),
            ("refresh nix applications", "refresh-nix-apps"),
        ) if normalized.startswith(phrase)), None)
    status = status_match.group(1) if status_match else "unknown"
    if module is not None and backend_module(module) is None:
        module = None
    if status == "unknown":
        with SESSIONS_LOCK:
            active_session = SESSIONS.get(path.stem)
        if active_session is not None and active_session.snapshot().get("status") == "running":
            status = "running"
    if status == "unknown":
        if "completed successfully." in tail.lower():
            status = "success"
        elif "blocked" in tail.lower():
            status = "blocked"
        elif "failed." in tail.lower():
            status = "error"
    return {
        "id": path.stem,
        "path": (root / path.relative_to(root)).relative_to(root).as_posix(),
        "modified": info.st_mtime,
        "operation": named_operation or "unknown",
        "module": module,
        "label": description,
        "status": status,
        "started_at": started_match.group(1).strip() if started_match else None,
    }


def list_operation_logs(root: Path, limit: int = 50, create: bool = False) -> list[dict[str, object]]:
    base = release_state_dir(root, create=create)
    candidates: list[tuple[float, Path]] = []
    for path in base.rglob("*.log"):
        if path.is_symlink():
            continue
        try:
            info = path.lstat()
            path.resolve().relative_to(base.resolve())
        except (OSError, ValueError):
            continue
        if stat.S_ISREG(info.st_mode):
            candidates.append((info.st_mtime, path))
    candidates.sort(key=lambda item: item[0], reverse=True)
    summaries = [operation_log_summary(root, base, path) for _, path in candidates[:max(1, min(limit, 50))]]
    return [summary for summary in summaries if summary is not None]


def read_operation_log(root: Path, log_id: str, create: bool = False) -> dict[str, object] | None:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", log_id):
        return None
    base = release_state_dir(root, create=create)
    for path in base.rglob("*.log"):
        if path.stem != log_id or path.is_symlink():
            continue
        summary = operation_log_summary(root, base, path)
        if summary is None:
            continue
        try:
            content = read_private_file(path, 1_000_000)
        except OSError:
            return None
        return {**summary, "content": content}
    return None


def latest_stable_channel_check(root: Path) -> dict[str, object]:
    for summary in list_operation_logs(root, 50):
        description = str(summary.get("label", "")).lower()
        if summary.get("operation") != "check-stable-channel" and not description.startswith("check official stable nix channel"):
            continue
        detail = read_operation_log(root, str(summary["id"]))
        output = str(detail.get("content", "")) if detail else ""
        report = parse_stable_channel_report(output)
        status = str(summary.get("status", "unknown"))
        if status == "success" and report is None:
            status = "unknown"
        return {
            "checked": True,
            "status": status,
            "report": report,
            "checked_at": summary.get("started_at"),
            "log_id": summary.get("id"),
            "log_path": summary.get("path"),
            "message": report.get("message") if report else str(summary.get("label", "Stable channel check")),
        }
    return {"checked": False, "status": "not_checked", "report": None, "checked_at": None, "log_id": None, "log_path": None, "message": "No Stable channel check log exists in this release state."}


def process_descendants(root_pid: int) -> set[int]:
    pending = [root_pid]
    found: set[int] = set()
    while pending:
        parent = pending.pop()
        children_path = Path(f"/proc/{parent}/task/{parent}/children")
        try:
            children = [int(value) for value in children_path.read_text(encoding="ascii").split()]
        except (OSError, ValueError):
            continue
        for child in children:
            if child not in found:
                found.add(child)
                pending.append(child)
    return found


def process_is_running(pid: int) -> bool:
    try:
        fields = Path(f"/proc/{pid}/stat").read_text(encoding="ascii").rsplit(")", 1)[1].split()
        return bool(fields) and fields[0] != "Z"
    except (OSError, IndexError):
        return False


def signal_process_tree(root_pid: int, tracked: set[int], sig: int) -> None:
    for process_id in tracked | process_descendants(root_pid):
        try:
            os.kill(process_id, sig)
        except ProcessLookupError:
            pass
        except PermissionError:
            continue
    try:
        os.killpg(root_pid, sig)
    except ProcessLookupError:
        pass


def execute_in_system_terminal(root: Path, backend: Path, command: list[str], operation_dir_path: Path, operation_id: str, env: dict[str, str], session: OperationSession, log: TextIO) -> tuple[str, int]:
    """Run an allow-listed command in a visible system terminal."""
    output_path = operation_dir_path / f"{operation_id}.terminal-output"
    status_path = operation_dir_path / f"{operation_id}.terminal-status"
    script_path = operation_dir_path / f"{operation_id}.terminal.sh"
    command_line = " ".join(shlex.quote(part) for part in command)
    script_lines = [
        "#!/bin/sh",
        "set +e",
        "umask 077",
        "printf '%s\\n' 'Alpine Desktop Center protected operation' 'If authentication is requested, enter credentials only in this system terminal.' 'The browser does not receive terminal input.' ''",
        f"printf '$ %s\\n\\n' {shlex.quote(command_line)}",
        f"cd {shlex.quote(str(backend))} || exit 125",
        f"{command_line} > {shlex.quote(str(output_path))} 2>&1",
        "status=$?",
        f"cat {shlex.quote(str(output_path))}",
        f'''printf '%s' "$status" > {shlex.quote(str(status_path))}''',
        "if [ \"$status\" -ne 0 ]; then printf '\\n\\nOperation failed with exit code %s. Press Enter to close this terminal...' \"$status\"; read -r _; fi",
        "exit \"$status\"",
        "",
    ]
    script_fd = os.open(script_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o700)
    with os.fdopen(script_fd, "w", encoding="utf-8") as script_file:
        script_file.write("\n".join(script_lines))
    invocation = terminal_command(script_path)
    if invocation is None:
        cleanup_terminal_artifacts((script_path, output_path, status_path))
        return "No supported terminal emulator was found for the operation requiring an external terminal.", 127
    try:
        terminal = subprocess.Popen(invocation, cwd=backend, env=env, start_new_session=True)
    except OSError as exc:
        cleanup_terminal_artifacts((script_path, output_path, status_path))
        return f"Could not open a system terminal for the operation: {exc}", 1
    deadline = time.monotonic() + COMMAND_TIMEOUT_SECONDS
    terminal_exited_at: float | None = None
    output_offset = 0
    decoder = codecs.getincrementaldecoder("utf-8")("replace")
    output_limit_reached = False

    def emit_output(text: str) -> None:
        nonlocal output_limit_reached
        if not text or output_limit_reached:
            return
        with session.lock:
            remaining = max(0, MAX_SESSION_OUTPUT_CHARS - len(session.output))
            already_truncated = session.output_truncated
        if already_truncated:
            output_limit_reached = True
            return
        log_text = text
        if len(text) > remaining:
            marker = "\n[Session output truncated at the safety limit.]\n"
            marker_size = min(remaining, len(marker))
            log_text = text[:remaining - marker_size] + marker[:marker_size]
            output_limit_reached = True
        session.append(text)
        if log_text:
            log.write(log_text)
            log.flush()
        with session.lock:
            output_limit_reached = output_limit_reached or session.output_truncated

    def stream_output(final: bool = False) -> None:
        nonlocal output_offset
        while True:
            try:
                chunk = read_private_file_chunk(output_path, output_offset, 65_536)
            except FileNotFoundError:
                break
            if not chunk:
                break
            output_offset += len(chunk)
            text = english_output(decoder.decode(chunk, final=False))
            emit_output(text)
        if final:
            text = english_output(decoder.decode(b"", final=True))
            emit_output(text)

    while time.monotonic() < deadline:
        try:
            stream_output()
        except OSError as exc:
            message = f"Could not safely stream system-terminal output: {exc}"
            session.append(f"\n{message}\n")
            log.write(f"\n{message}\n")
            log.flush()
            if terminal.poll() is None:
                try:
                    os.killpg(terminal.pid, signal.SIGTERM)
                    terminal.wait(timeout=PTY_TERMINATION_GRACE_SECONDS)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(terminal.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                except ProcessLookupError:
                    pass
            cleanup_terminal_artifacts((script_path, output_path, status_path))
            return "", 1
        if status_path.is_file():
            try:
                stream_output(final=True)
                return_code = int(read_private_file(status_path, 64))
                if terminal.poll() is None:
                    threading.Thread(target=terminal.wait, daemon=True).start()
                else:
                    terminal.wait()
                cleanup_terminal_artifacts((script_path, output_path, status_path))
                return "", return_code
            except (OSError, ValueError):
                pass
        if terminal.poll() is not None:
            terminal_exited_at = terminal_exited_at or time.monotonic()
            if time.monotonic() - terminal_exited_at >= 2 and not status_path.exists():
                try:
                    os.killpg(terminal.pid, signal.SIGTERM)
                    time.sleep(0.2)
                    os.killpg(terminal.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                try:
                    stream_output(final=True)
                except OSError:
                    pass
                terminal.wait()
                cleanup_terminal_artifacts((script_path, output_path, status_path))
                return "The terminal closed before the privileged operation reported a result.", 1
        time.sleep(0.2)
    if terminal.poll() is None:
        try:
            os.killpg(terminal.pid, signal.SIGTERM)
            terminal.wait(timeout=PTY_TERMINATION_GRACE_SECONDS)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(terminal.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        except ProcessLookupError:
            pass
    try:
        stream_output(final=True)
    except OSError:
        pass
    cleanup_terminal_artifacts((script_path, output_path, status_path))
    return "The privileged operation exceeded the 15-minute safety timeout.", 124


def parse_nix_profile_apps(output: str) -> list[dict[str, object]]:
    """Parse JSON emitted by the classic `nix-env --query --json` command."""
    start = output.find("{")
    end = output.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Nix profile listing did not return JSON.")
    value = json.loads(output[start:end + 1])
    elements = value.get("elements") if isinstance(value, dict) else None
    if isinstance(elements, list):
        entries = [(None, item) for item in elements]
    elif isinstance(value, dict):
        entries = list(value.items())
    else:
        raise ValueError("Nix profile listing has an unsupported JSON shape.")
    apps: list[dict[str, object]] = []
    for position, (attribute, item) in enumerate(entries, start=1):
        if not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("pname") or attribute
        if not isinstance(name, str) or not name.strip():
            name = f"profile entry {position}"
        attr_path = item.get("attrPath") or attribute
        if not isinstance(attr_path, str):
            attr_path = None
        store_path = item.get("storePath") or item.get("outPath")
        store_paths = item.get("storePaths") if isinstance(item.get("storePaths"), list) else ([store_path] if isinstance(store_path, str) else [])
        apps.append({"index": position, "name": name, "attrPath": attr_path, "active": item.get("active") is not False, "storePaths": [path for path in store_paths if isinstance(path, str)]})
    return apps


def parse_nix_search_results(output: str) -> list[dict[str, object]]:
    """Parse the JSON catalog emitted by classic `nix-env --query --available`."""
    start = output.find("{")
    end = output.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Nix package search did not return JSON.")
    value = json.loads(output[start:end + 1])
    if not isinstance(value, dict):
        raise ValueError("Nix package search returned an unsupported JSON shape.")
    packages: list[dict[str, object]] = []
    for attribute, item in value.items():
        if not isinstance(attribute, str) or not re.fullmatch(r"[A-Za-z0-9_+.-]+(?:\.[A-Za-z0-9_+.-]+)*", attribute) or not isinstance(item, dict):
            continue
        name = item.get("name") or item.get("pname") or attribute.rsplit(".", 1)[-1]
        version = item.get("version")
        description = item.get("description") or item.get("meta", {}).get("description") if isinstance(item.get("meta"), dict) else item.get("description")
        packages.append({"attribute": attribute, "name": name if isinstance(name, str) else attribute, "version": version if isinstance(version, str) else None, "description": description if isinstance(description, str) else ""})
    return packages[:100]


def nix_search_cache_key(payload: dict[str, object]) -> str:
    query = payload.get("query")
    return query.strip().casefold() if isinstance(query, str) else ""


def get_cached_nix_search(payload: dict[str, object]) -> list[dict[str, object]] | None:
    key = nix_search_cache_key(payload)
    if not key:
        return None
    with NIX_SEARCH_CACHE_LOCK:
        cached = NIX_SEARCH_CACHE.get(key)
        if cached is None:
            return None
        results, cached_at = cached
        if time.monotonic() - cached_at > NIX_SEARCH_CACHE_TTL_SECONDS:
            NIX_SEARCH_CACHE.pop(key, None)
            return None
        return [item.copy() for item in results]


def remember_nix_search(payload: dict[str, object], results: list[dict[str, object]]) -> None:
    key = nix_search_cache_key(payload)
    if not key:
        return
    with NIX_SEARCH_CACHE_LOCK:
        NIX_SEARCH_CACHE[key] = ([item.copy() for item in results], time.monotonic())


def clear_nix_search_cache() -> None:
    with NIX_SEARCH_CACHE_LOCK:
        NIX_SEARCH_CACHE.clear()


def nix_exact_profile_selector(package_name: str) -> str:
    """Build a POSIX ERE accepted by nix-env for one exact profile name."""
    escaped = re.escape(package_name)
    return escaped.replace(r"\-", "-").replace(r"\.", "[.]").replace(r"\+", "[+]")


def nix_search_has_no_results(output: str) -> bool:
    """nix-env exits non-zero when a valid catalog query matches nothing."""
    return re.search(r"selector .* matches no derivations", output, re.IGNORECASE) is not None


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
    if operation == "uninstall-nix-app":
        package_name = payload.get("name")
        if not isinstance(package_name, str) or not re.fullmatch(r"[A-Za-z0-9+._-]+", package_name):
            raise ValueError("A valid Nix package name is required for uninstall-nix-app.")
        selector = f"^{nix_exact_profile_selector(package_name)}$"
        return ([["nix-env", "--uninstall", selector]], f"uninstall Nix package {package_name}")
    if operation == "search-nix-packages":
        query = payload.get("query")
        if not isinstance(query, str) or not 1 <= len(query.strip()) <= 64:
            raise ValueError("A search query between 1 and 64 characters is required.")
        expression = f".*{re.escape(query.strip())}.*"
        return ([["nix-env", "--query", "--available", "--json", "--attr-path", "--description", expression]], f"search Nix packages for {query.strip()}")
    if operation == "install-nix-package":
        attribute = payload.get("attribute")
        if not isinstance(attribute, str) or not re.fullmatch(r"[A-Za-z0-9_+.-]+(?:\.[A-Za-z0-9_+.-]+)*", attribute):
            raise ValueError("A valid Nix attribute path is required for install-nix-package.")
        return ([["nix-env", "--install", "--attr", attribute]], f"install Nix package {attribute}")
    simple = {
        "check-stable-channel": (["python3", "scripts/canal-stable-nix.py", "verificar"], "check official Stable Nix channel"),
        "migrate-stable-channel": (["python3", "scripts/canal-stable-nix.py", "migrar"], "migrate official Stable Nix channel"),
        "refresh-nix-apps": (["sh", "scripts/atualizar-nix.sh", "aplicativos"], "update Nix applications (legacy operation id)"),
        "update-nix-apps": (["sh", "scripts/atualizar-nix.sh", "aplicativos"], "update Nix applications in the user profile"),
        "list-nix-apps": (["nix-env", "--query", "--installed", "--json"], "list Nix applications in the user profile"),
        "collect-nix-garbage": (["nix-collect-garbage"], "collect unreachable Nix store paths"),
        "refresh-kde-apps": (["sh", "roles/nix/files/atualizar-aplicativos-nix.sh"], "refresh KDE Nix app menu and restart Plasma"),
        "simulate-full": (["make", "simular"], "preview full configuration in Ansible check mode"),
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


def run_pty_command(session: OperationSession, command: list[str], log: object, env: dict[str, str], backend: Path) -> tuple[int, str]:
    """Run a named command in a real PTY and stream output into the session."""
    pid, master_fd = pty.fork()
    if pid == 0:
        try:
            os.chdir(backend)
            os.execvpe(command[0], command, env)
        except BaseException:
            os._exit(127)
    chunks: list[bytes] = []
    captured_chars = 0
    capture_truncated = False
    child_status: int | None = None
    saw_eof = False
    started_at = time.monotonic()
    terminate_at: float | None = None
    kill_sent_at: float | None = None
    last_tree_scan = 0.0
    tracked_descendants: set[int] = set()
    timed_out = False
    try:
        while True:
            now = time.monotonic()
            if now - last_tree_scan >= 0.05 and child_status is None:
                tracked_descendants.update(process_descendants(pid))
                last_tree_scan = now
            if not timed_out and now - started_at >= COMMAND_TIMEOUT_SECONDS:
                timed_out = True
                terminate_at = now
                timeout_message = "\nThe backend command exceeded the 15-minute safety timeout; terminating its process group.\n"
                session.append(timeout_message)
                log.write(timeout_message)
                log.flush()
                signal_process_tree(pid, tracked_descendants, signal.SIGTERM)
            elif terminate_at is not None and now - terminate_at >= PTY_TERMINATION_GRACE_SECONDS:
                signal_process_tree(pid, tracked_descendants, signal.SIGKILL)
                terminate_at = None
                kill_sent_at = now
            try:
                readable, _, _ = select.select([master_fd], [], [], 0.05)
            except (OSError, ValueError):
                readable = []
            if master_fd in readable:
                try:
                    chunk = os.read(master_fd, 4096)
                except OSError as exc:
                    if exc.errno == errno.EIO:
                        chunk = b""
                    else:
                        raise
                if chunk:
                    text = chunk.decode("utf-8", errors="replace")
                    remaining = max(0, MAX_SESSION_OUTPUT_CHARS - captured_chars)
                    visible = text[:remaining]
                    if visible:
                        chunks.append(visible.encode("utf-8"))
                        captured_chars += len(visible)
                        session.append(visible)
                        log.write(visible)
                        log.flush()
                    if len(text) > remaining and not capture_truncated:
                        marker = "\n[Command output truncated at the safety limit.]\n"
                        session.append(marker)
                        log.write(marker)
                        log.flush()
                        capture_truncated = True
                else:
                    saw_eof = True
            try:
                waited, status = os.waitpid(pid, os.WNOHANG)
                if waited == pid:
                    child_status = status
            except ChildProcessError:
                if child_status is None:
                    child_status = 0
            if kill_sent_at is not None and now - kill_sent_at >= PTY_HARD_STOP_GRACE_SECONDS:
                tracked_descendants.update(process_descendants(pid))
                signal_process_tree(pid, tracked_descendants, signal.SIGKILL)
                survivors = {process_id for process_id in tracked_descendants | {pid} if process_is_running(process_id)}
                if survivors:
                    with LINGERING_PROCESS_LOCK:
                        LINGERING_PROCESS_PIDS.update(survivors)
                    warning = f"\nCould not confirm termination of detached process(es) {', '.join(map(str, sorted(survivors)))}; new operations are blocked until they exit.\n"
                    session.append(warning)
                    log.write(warning)
                    log.flush()
                saw_eof = True
                break
            if child_status is not None and saw_eof:
                break
        if child_status is None:
            waited, status = os.waitpid(pid, os.WNOHANG)
            if waited == pid:
                child_status = status
            else:
                with LINGERING_PROCESS_LOCK:
                    LINGERING_PROCESS_PIDS.add(pid)
    finally:
        try:
            os.close(master_fd)
        except OSError:
            pass
    output = b"".join(chunks).decode("utf-8", errors="replace")
    return (124 if timed_out else os.waitstatus_to_exitcode(child_status or 0)), output


def run_session(session: OperationSession, operation_lock: threading.Lock) -> None:
    global STABLE_CHANNEL_CACHE
    backend = session.root / "backend"
    env = command_environment(session.root)
    try:
        operation_path = operation_dir(session.root)
        prune_operation_logs(release_state_dir(session.root))
        log_path = operation_log_path(session.root, session.operation, session.payload, session.session_id)
        session.log_path = log_path.relative_to(session.root).as_posix()
        valid, message = validate_backend(session.root)
        if not valid:
            log_path.write_text(f"Named operation: {session.operation}\nOperation: {session.operation}\nStarted: {datetime.now().astimezone().isoformat(timespec='seconds')}\nPersistent log: {session.log_path}\nBackend validation failed: {message}\nOperation status: blocked\n", encoding="utf-8")
            log_path.chmod(0o600)
            session.status = "blocked"
            session.message = message
            session.return_code = 2
            return
        if session.operation == "validate-backend":
            session.append(message + "\n")
            log_path.write_text(f"Named operation: {session.operation}\nOperation: Validate embedded backend\nStarted: {datetime.now().astimezone().isoformat(timespec='seconds')}\nPersistent log: {session.log_path}\n{message}\nOperation status: success\n", encoding="utf-8")
            log_path.chmod(0o600)
            session.status = "success"
            session.message = message
            session.return_code = 0
            return
        commands, description = resolve_command(session.operation, session.payload)
        with log_path.open("w", encoding="utf-8") as log:
            log_path.chmod(0o600)
            header = "\n".join([
                f"Operation: {description}",
                f"Named operation: {session.operation}",
                *([f"Module: {backend_module(session.payload.get('module'))}"] if backend_module(session.payload.get("module")) else []),
                f"Started: {datetime.now().astimezone().isoformat(timespec='seconds')}",
                f"Backend: {backend}",
                "Backend integrity: PASS immediately before execution",
                f"Persistent log: {session.log_path}",
                "",
            ])
            session.append(header)
            log.write(header)
            log.flush()
            return_code = 0
            pending_commands = list(commands)
            if session.operation == "search-nix-packages":
                cached_packages = get_cached_nix_search(session.payload)
                if cached_packages is not None:
                    with session.lock:
                        session.nix_packages = cached_packages
                    session.append("\nSearch results restored from the recent Nix catalog cache.\n")
                    pending_commands = []
            state_dir = session.root / ".alpine-state"
            ansible_collection = state_dir / "collections" / "ansible_collections" / "community" / "general"
            prerequisites_missing = (
                shutil.which("make", path=env["PATH"]) is None
                or shutil.which("ansible-playbook", path=env["PATH"]) is None
                or shutil.which("ansible-galaxy", path=env["PATH"]) is None
                or not (state_dir / "vars.yml").is_file()
                or not ansible_collection.is_dir()
            )
            if session.operation == "simulate-full" and prerequisites_missing:
                session.status = "blocked"
                session.return_code = 2
                session.message = "Preview is blocked because backend prerequisites or prepared release-local Ansible state are missing. Prepare them explicitly, then run the preview again."
                session.append(f"\n{session.message}\n")
                log.write(f"\n{session.message}\nOperation status: blocked\n")
                log.flush()
                return
            if session.operation in PRIVILEGED_OPERATIONS and prerequisites_missing:
                pending_commands.insert(0, ["sh", "scripts/preparar-ansible.sh"])
                session.append("\nBackend prerequisites are missing; preparing them in a separate system terminal.\n")
            for command in pending_commands:
                valid, validation_message = validate_backend(session.root)
                if not valid:
                    return_code = 2
                    session.status = "blocked"
                    session.message = f"Backend integrity check failed before command: {validation_message}"
                    session.append(f"\n{session.message}\n")
                    log.write(f"\n{session.message}\n")
                    log.flush()
                    break
                command_line = " ".join(shlex.quote(part) for part in command)
                session.append(f"\n$ {command_line}\n")
                log.write(f"\n$ {command_line}\n")
                log.flush()
                if session.operation in SYSTEM_TERMINAL_OPERATIONS:
                    command_output, return_code = execute_in_system_terminal(
                        session.root, backend, command, operation_path, session.session_id, env, session, log
                    )
                    command_output = english_output(command_output)
                    session.append(command_output)
                    log.write(command_output)
                    log.flush()
                else:
                    return_code, command_output = run_pty_command(session, command, log, env, backend)
                if session.operation == "check-stable-channel":
                    report = parse_stable_channel_report(command_output) if return_code == 0 else None
                    with STABLE_CHANNEL_LOCK:
                        STABLE_CHANNEL_CACHE = (report, time.monotonic()) if report is not None else None
                    if return_code == 0 and report is None:
                        session.append("\nStable status output was not recognized; migration remains blocked.\n")
                if session.operation == "list-nix-apps" and return_code == 0:
                    try:
                        with session.lock:
                            session.nix_apps = parse_nix_profile_apps(command_output)
                    except (json.JSONDecodeError, ValueError) as exc:
                        return_code = 1
                        session.append(f"\nNix profile output was invalid: {exc}\n")
                if session.operation == "search-nix-packages" and return_code == 0:
                    try:
                        with session.lock:
                            session.nix_packages = parse_nix_search_results(command_output)
                            remember_nix_search(session.payload, session.nix_packages)
                    except (json.JSONDecodeError, ValueError) as exc:
                        return_code = 1
                        session.append(f"\nNix package search output was invalid: {exc}\n")
                elif session.operation == "search-nix-packages" and return_code != 0 and nix_search_has_no_results(command_output):
                    with session.lock:
                        session.nix_packages = []
                    remember_nix_search(session.payload, [])
                    return_code = 0
                    session.append("\nNo Nix packages matched this search.\n")
                if session.operation in {"system-check", "check-all-modules", "diagnose-module"} and return_code == 0:
                    try:
                        diagnostic = validate_diagnostic_payload(json.loads(command_output))
                        with session.lock:
                            session.results.append(diagnostic)
                        remember_diagnostic(diagnostic)
                    except (json.JSONDecodeError, ValueError) as exc:
                        return_code = 1
                        session.append(f"\nDiagnostic output was invalid JSON: {exc}\n")
                if return_code != 0:
                    break
            session.return_code = return_code
            if session.status != "blocked":
                session.status = "success" if return_code == 0 else "error"
                session.message = f"{description.capitalize()} {'completed successfully.' if return_code == 0 else 'failed.'}"
            session.append(f"\n{session.message}\n")
            session.append(f"Operation status: {session.status}\n")
            log.write(f"\n{session.message}\nOperation status: {session.status}\n")
    except (OSError, ValueError) as exc:
        session.return_code = 1
        session.status = "error"
        session.message = str(exc)
        session.append(f"\n{exc}\nOperation status: error\n")
        if session.log_path:
            try:
                failed_log = session.root / session.log_path
                failed_log.resolve().relative_to(session.root.resolve())
                if not failed_log.is_symlink():
                    with failed_log.open("a", encoding="utf-8") as log:
                        failed_log.chmod(0o600)
                        log.write(f"\nOperation error: {exc}\nOperation status: error\n")
            except (OSError, ValueError):
                pass
    finally:
        operation_lock.release()


def start_operation(root: Path, operation: str, payload: dict[str, object], operation_lock: threading.Lock) -> dict[str, object]:
    global STABLE_CHANNEL_CACHE
    with LINGERING_PROCESS_LOCK:
        active_pids = {pid for pid in LINGERING_PROCESS_PIDS if process_is_running(pid)}
        LINGERING_PROCESS_PIDS.intersection_update(active_pids)
        lingering = sorted(LINGERING_PROCESS_PIDS)
    if lingering:
        return {"status": "blocked", "operation": operation, "message": f"A timed-out backend process is still running (PID {', '.join(map(str, lingering))}). Inspect it before retrying."}
    if not operation_lock.acquire(blocking=False):
        return {"status": "blocked", "operation": operation, "message": "Another backend operation is already running. Wait for it to finish."}
    valid, message = validate_backend(root)
    if not valid:
        operation_lock.release()
        return {"status": "blocked", "operation": operation, "message": message}
    if operation != "validate-backend" and release_metadata(root).get("diagnostic_schema") != "1":
        operation_lock.release()
        return {"status": "blocked", "operation": operation, "message": "Unsupported or missing diagnostic schema; this release only executes schema version 1."}
    if operation != "validate-backend":
        try:
            resolve_command(operation, payload)
        except ValueError as exc:
            operation_lock.release()
            return {"status": "error", "operation": operation, "message": str(exc)}
    if operation == "apply-module":
        module = backend_module(payload.get("module"))
        blocker = module_apply_blocker(root, module) if module else "A valid module identifier is required for apply-module."
        if blocker:
            operation_lock.release()
            return {"status": "blocked", "operation": operation, "message": blocker}
    if operation == "migrate-stable-channel":
        blocker = stable_channel_migration_blocker()
        if blocker:
            operation_lock.release()
            return {"status": "blocked", "operation": operation, "message": blocker}
    if operation.startswith("apply-") or operation in {"refresh-nix-apps", "update-nix-apps", "install-nix-package", "uninstall-nix-app", "collect-nix-garbage", "migrate-stable-channel"}:
        with DIAGNOSTIC_LOCK:
            DIAGNOSTIC_CACHE.clear()
    if operation in {"refresh-nix-apps", "update-nix-apps", "install-nix-package", "uninstall-nix-app", "migrate-stable-channel"}:
        clear_nix_search_cache()
    if operation in {"check-stable-channel", "simulate-full", "refresh-nix-apps", "update-nix-apps", "install-nix-package", "uninstall-nix-app", "collect-nix-garbage", "migrate-stable-channel"} or operation.startswith("apply-"):
        with STABLE_CHANNEL_LOCK:
            STABLE_CHANNEL_CACHE = None
    session_id = f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    session = OperationSession(session_id, root, operation, payload)
    with SESSIONS_LOCK:
        completed = sorted((item for item in SESSIONS.values() if item.status != "running"), key=lambda item: item.session_id)
        while len(SESSIONS) >= MAX_CACHED_SESSIONS and completed:
            expired = completed.pop(0)
            SESSIONS.pop(expired.session_id, None)
        SESSIONS[session_id] = session
    session.thread = threading.Thread(target=run_session, args=(session, operation_lock), daemon=True)
    try:
        session.thread.start()
    except RuntimeError as exc:
        with SESSIONS_LOCK:
            SESSIONS.pop(session_id, None)
        operation_lock.release()
        return {"status": "error", "operation": operation, "message": f"Could not start operation worker: {exc}"}
    return {"status": "running", "operation": operation, "operation_id": session_id, "message": "Operation started."}


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
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def reject(self, message: str, status: int = HTTPStatus.FORBIDDEN) -> None:
        self.send_json({"status": "blocked", "message": message}, status)

    def authorized(self) -> bool:
        parsed = urlparse(self.path)
        try:
            client_is_loopback = ipaddress.ip_address(self.client_address[0]).is_loopback
        except ValueError:
            client_is_loopback = False
        if not client_is_loopback:
            self.reject("The local bridge accepts connections only from a loopback address.")
            return False
        try:
            host_header = urlparse(f"//{self.headers.get('Host', '')}")
            host = (host_header.hostname or "").lower()
            host_port = host_header.port
        except ValueError:
            host_header = urlparse("")
            host = ""
            host_port = None
        allowed_hosts = {"127.0.0.1", "localhost"}
        server_port = self.app_server.server_address[1]
        if host not in allowed_hosts or host_port != server_port or host_header.path or host_header.params or host_header.query or host_header.fragment or host_header.username is not None or host_header.password is not None:
            self.reject("The local bridge accepts requests only through loopback.")
            return False
        origin = self.headers.get("Origin")
        if origin:
            try:
                origin_url = urlparse(origin)
                origin_port = origin_url.port
            except ValueError:
                origin_url = urlparse("")
                origin_port = -1
            if origin_url.scheme != "http" or origin_url.hostname not in allowed_hosts or origin_port != server_port or origin_url.path or origin_url.params or origin_url.query or origin_url.fragment or origin_url.username is not None or origin_url.password is not None:
                self.reject("The request origin is not allowed.")
                return False
        token = self.headers.get("X-ADC-Token", "")
        if not token:
            cookies = SimpleCookie()
            try:
                cookies.load(self.headers.get("Cookie", ""))
            except CookieError:
                cookies = SimpleCookie()
            session_cookie = cookies.get("ADC-Session")
            token = session_cookie.value if session_cookie else ""
        if not token or not secrets.compare_digest(token, self.app_server.session_token):
            self.reject("A valid local session token is required.")
            return False
        if parsed.path.startswith("/api/") and self.command == "POST" and self.headers.get_content_type() != "application/json":
            self.reject("Operation requests must use application/json.", HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
            return False
        return True

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/") and not self.authorized():
            return
        if path.startswith("/api/operations/"):
            session_id = path.removeprefix("/api/operations/")
            with SESSIONS_LOCK:
                session = SESSIONS.get(session_id)
            if session is not None:
                try:
                    cursor = int(parse_qs(parsed.query).get("cursor", ["0"])[0])
                except ValueError:
                    cursor = 0
                self.send_json(session.snapshot(cursor))
                return
        if path.startswith("/api/logs/"):
            log_id = path.removeprefix("/api/logs/")
            entry = read_operation_log(self.root, log_id)
            if entry is None:
                self.send_json({"error": "Operation log was not found or is not readable."}, HTTPStatus.NOT_FOUND)
            else:
                self.send_json(entry)
            return
        if path == "/api/stable-channel/status":
            self.send_json(latest_stable_channel_check(self.root))
            return
        if path == "/api/environment":
            self.send_json(detect_desktop_environment())
            return
        if path == "/api/nix/status":
            self.send_json(detect_nix_support())
            return
        if path == "/api/base/status":
            self.send_json(detect_base_status())
            return
        if path == "/api/health":
            valid, message = validate_backend(self.root)
            metadata = release_metadata(self.root)
            self.send_json({"bridge": "local", "backend": "validated" if valid else "failed", "message": message, "release_root": str(self.root), "frontend_version": metadata.get("frontend", "unknown"), "backend_version": metadata.get("backend", "unknown"), "backend_commit": metadata.get("backend_commit", "unknown"), "diagnostic_schema": metadata.get("diagnostic_schema", "unknown")}, HTTPStatus.OK if valid else HTTPStatus.SERVICE_UNAVAILABLE)
            return
        if path == "/api/backend/status":
            valid, message = validate_backend(self.root)
            self.send_json({"valid": valid, "message": message, "frontend_version": release_version(self.root)})
            return
        if path == "/api/modules":
            catalog: dict[str, dict[str, object]] = {}
            try:
                raw_catalog = json.loads((self.root / "backend" / "modulos.json").read_text(encoding="utf-8"))
                if isinstance(raw_catalog, list):
                    catalog = {str(item["key"]): item for item in raw_catalog if isinstance(item, dict) and "key" in item}
            except (OSError, json.JSONDecodeError, TypeError):
                catalog = {}
            desktop_id = str(detect_desktop_environment().get("id", "unknown"))
            nix_supported = bool(detect_nix_support().get("supported"))
            modules = []
            for module in DIAGNOSTIC_MODULES:
                entry = catalog.get(module, {})
                if module in {"nix", "nix_opengl", "steam"} and not nix_supported:
                    continue
                if module_desktop_blocker(module, entry):
                    continue
                targets = module_desktop_targets(module, entry)
                modules.append({"id": module, "name": MODULE_LABELS[module], "description": str(entry.get("description", "")), "state": "Unknown", "detail": "Run a live diagnostic.", "accent": MODULE_ACCENTS[module], "dependencies": entry.get("dependencies", []), "desktop_targets": list(targets), "desktop": desktop_id})
            self.send_json({"desktop": desktop_id, "modules": modules})
            return
        if path == "/api/logs":
            self.send_json({"logs": list_operation_logs(self.root, 50)})
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
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 0:
                raise ValueError("Content-Length must not be negative.")
            if length > MAX_REQUEST_BODY_BYTES:
                self.send_json({"status": "error", "message": "Operation request is too large."}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
                return
            raw = self.rfile.read(length) if length else b"{}"
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("Request body must be a JSON object.")
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json({"status": "error", "message": f"Invalid operation request: {exc}"}, HTTPStatus.BAD_REQUEST)
            return
        route = path.removeprefix(prefix)
        operation = route
        if operation not in OPERATIONS:
            self.send_json({"error": "Operation is not in the named allowlist."}, HTTPStatus.NOT_FOUND)
            return
        result = start_operation(self.root, operation, payload, self.app_server.operation_lock)
        status = {"running": HTTPStatus.ACCEPTED, "error": HTTPStatus.BAD_GATEWAY, "blocked": HTTPStatus.CONFLICT}.get(str(result.get("status")), HTTPStatus.BAD_REQUEST)
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
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        if candidate.name == "index.html":
            self.send_header("Cache-Control", "no-store")
            self.send_header("Set-Cookie", f"ADC-Session={self.app_server.session_token}; HttpOnly; SameSite=Strict; Path=/")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(data)


def read_session_token(token_file: Path) -> str:
    fd = os.open(token_file, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_nlink != 1:
            raise OSError("Session token file has unsafe ownership or permissions.")
        token = os.read(fd, 1024).decode("utf-8").strip()
    finally:
        os.close(fd)
    if not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", token):
        raise ValueError("Session token file is empty or malformed.")
    return token


def main() -> int:
    parser = argparse.ArgumentParser(description="Alpine Desktop Center local browser server")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--host", choices=("127.0.0.1",), default="127.0.0.1", help="The bridge is always loopback-only.")
    parser.add_argument("--port", type=int, default=43127)
    parser.add_argument("--token-file", type=Path, help="Read the session token from a private file")
    args = parser.parse_args()
    root = args.root.resolve()
    try:
        server_lock_fd = acquire_server_lock(root)
        token = read_session_token(args.token_file) if args.token_file else secrets.token_urlsafe(32)
    except (OSError, UnicodeError, ValueError) as exc:
        parser.error(f"Could not acquire local server state: {exc}")
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
        os.close(server_lock_fd)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
