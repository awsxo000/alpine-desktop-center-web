import hashlib
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server import local_server


class BridgeTestCase(unittest.TestCase):
    def setUp(self) -> None:
        with local_server.DIAGNOSTIC_LOCK:
            local_server.DIAGNOSTIC_CACHE.clear()
        with local_server.STABLE_CHANNEL_LOCK:
            local_server.STABLE_CHANNEL_CACHE = None
        with local_server.LINGERING_PROCESS_LOCK:
            local_server.LINGERING_PROCESS_PIDS.clear()
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.backend = self.root / "backend"
        (self.backend / "scripts").mkdir(parents=True)
        self.sample = self.backend / "scripts" / "sample.txt"
        self.sample.write_text("known backend contents\n", encoding="utf-8")
        self.write_manifest()

    def tearDown(self) -> None:
        self.temp.cleanup()

    def write_manifest(self, lines: list[str] | None = None) -> None:
        if lines is None:
            files = sorted(path for path in self.backend.rglob("*") if path.is_file() and not path.is_symlink())
            lines = [f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.relative_to(self.backend).as_posix()}" for path in files]
        (self.root / "BACKEND-MANIFEST.sha256").write_text("\n".join(lines) + "\n", encoding="utf-8")

    def test_accepts_exact_nonempty_manifest(self) -> None:
        valid, message = local_server.validate_backend(self.root)
        self.assertTrue(valid, message)

    def test_rejects_empty_manifest(self) -> None:
        (self.root / "BACKEND-MANIFEST.sha256").write_text("", encoding="utf-8")
        valid, message = local_server.validate_backend(self.root)
        self.assertFalse(valid)
        self.assertIn("empty", message.lower())

    def test_rejects_malformed_manifest_line(self) -> None:
        self.write_manifest(["not-a-checksum  scripts/sample.txt"])
        valid, message = local_server.validate_backend(self.root)
        self.assertFalse(valid)
        self.assertIn("invalid line", message.lower())

    def test_rejects_duplicate_manifest_path(self) -> None:
        digest = hashlib.sha256(self.sample.read_bytes()).hexdigest()
        self.write_manifest([f"{digest}  scripts/sample.txt", f"{digest}  scripts/sample.txt"])
        valid, message = local_server.validate_backend(self.root)
        self.assertFalse(valid)
        self.assertIn("duplicate", message.lower())

    def test_rejects_path_traversal(self) -> None:
        digest = "0" * 64
        self.write_manifest([f"{digest}  ../outside.txt"])
        valid, message = local_server.validate_backend(self.root)
        self.assertFalse(valid)
        self.assertIn("unsafe path", message.lower())

    def test_rejects_backend_symlink(self) -> None:
        outside = self.root / "outside.txt"
        outside.write_text("outside\n", encoding="utf-8")
        link = self.backend / "linked.txt"
        link.symlink_to(outside)
        digest = hashlib.sha256(self.sample.read_bytes()).hexdigest()
        outside_digest = hashlib.sha256(outside.read_bytes()).hexdigest()
        self.write_manifest([f"{digest}  scripts/sample.txt", f"{outside_digest}  linked.txt"])
        valid, message = local_server.validate_backend(self.root)
        self.assertFalse(valid)
        self.assertIn("symbolic link", message.lower())

    def test_rejects_modified_backend_file(self) -> None:
        self.sample.write_text("changed after packaging\n", encoding="utf-8")
        valid, message = local_server.validate_backend(self.root)
        self.assertFalse(valid)
        self.assertIn("checksum mismatch", message.lower())

    def test_rejects_traversal_in_frontend_version_for_logs(self) -> None:
        (self.root / "RELEASE-VERSIONS").write_text("frontend=../../outside\n", encoding="utf-8")
        with self.assertRaises(OSError):
            local_server.operation_dir(self.root)

    def test_rejects_symlinked_state_directory(self) -> None:
        outside = self.root / "outside"
        outside.mkdir()
        (self.root / ".alpine-state").symlink_to(outside, target_is_directory=True)
        with self.assertRaises(OSError):
            local_server.operation_dir(self.root)

    def test_server_lock_rejects_second_instance(self) -> None:
        lock_fd = local_server.acquire_server_lock(self.root)
        try:
            with self.assertRaisesRegex(OSError, "already running"):
                local_server.acquire_server_lock(self.root)
        finally:
            os.close(lock_fd)

    def test_token_file_requires_private_regular_file(self) -> None:
        token_path = self.root / "session.token"
        token_path.write_text("a" * 43 + "\n", encoding="utf-8")
        token_path.chmod(0o600)
        self.assertEqual(local_server.read_session_token(token_path), "a" * 43)
        token_path.chmod(0o644)
        with self.assertRaisesRegex(OSError, "unsafe ownership"):
            local_server.read_session_token(token_path)
        token_path.unlink()
        target = self.root / "target.token"
        target.write_text("a" * 43, encoding="utf-8")
        token_path.symlink_to(target)
        with self.assertRaises(OSError):
            local_server.read_session_token(token_path)

    def test_terminal_private_file_reader_rejects_symlinks_and_limits_output(self) -> None:
        private_path = self.root / "terminal-output"
        private_path.write_text("abcdefgh", encoding="utf-8")
        private_path.chmod(0o600)
        output = local_server.read_private_file(private_path, 5)
        self.assertTrue(output.startswith("abcde"))
        self.assertIn("truncated", output.lower())
        self.assertEqual(local_server.read_private_file_chunk(private_path, 1, 3), b"bcd")
        symlink_path = self.root / "terminal-output-link"
        symlink_path.symlink_to(private_path)
        with self.assertRaises(OSError):
            local_server.read_private_file(symlink_path, 100)
        with self.assertRaises(OSError):
            local_server.read_private_file_chunk(symlink_path, 0, 100)

    def test_server_cli_rejects_non_loopback_bind(self) -> None:
        result = subprocess.run([sys.executable, str(ROOT / "server" / "local_server.py"), "--host", "0.0.0.0"], capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertIn("invalid choice", result.stderr)

    def test_rejects_injected_module_operation(self) -> None:
        with self.assertRaises(ValueError):
            local_server.resolve_command("apply-module", {"module": "audio; touch /tmp/unsafe"})

    def test_full_preview_is_allowlisted_and_uses_check_mode_target(self) -> None:
        commands, description = local_server.resolve_command("simulate-full", {})
        self.assertEqual(commands, [["make", "simular"]])
        self.assertIn("check mode", description)
        self.assertIn("simulate-full", local_server.OPERATIONS)
        self.assertIn("simulate-full", local_server.PRIVILEGED_OPERATIONS)
        self.assertIn("simulate-full", local_server.SYSTEM_TERMINAL_OPERATIONS)
        self.assertNotIn("refresh-nix-apps", local_server.SYSTEM_TERMINAL_OPERATIONS)
        self.assertIn("update-nix-apps", local_server.OPERATIONS)
        self.assertNotIn("update-nix-apps", local_server.SYSTEM_TERMINAL_OPERATIONS)
        self.assertIn("refresh-kde-apps", local_server.OPERATIONS)
        self.assertNotIn("refresh-kde-apps", local_server.PRIVILEGED_OPERATIONS)
        self.assertNotIn("refresh-kde-apps", local_server.SYSTEM_TERMINAL_OPERATIONS)
        self.assertIn("migrate-stable-channel", local_server.SYSTEM_TERMINAL_OPERATIONS)
        self.assertNotIn("refresh-nix-apps", local_server.PRIVILEGED_OPERATIONS)
        self.assertNotIn("update-nix-apps", local_server.PRIVILEGED_OPERATIONS)
        self.assertNotIn("migrate-stable-channel", local_server.PRIVILEGED_OPERATIONS)

    def test_operations_block_without_supported_diagnostic_schema_metadata(self) -> None:
        lock = threading.Lock()
        result = local_server.start_operation(self.root, "system-check", {}, lock)
        self.assertEqual(result["status"], "blocked")
        self.assertIn("diagnostic schema", result["message"].lower())
        self.assertTrue(lock.acquire(blocking=False))
        lock.release()

    def test_module_apply_requires_recent_module_and_dependency_diagnostics(self) -> None:
        (self.backend / "modulos.json").write_text(json.dumps([
            {"key": "base", "dependencies": []},
            {"key": "audio", "dependencies": ["base"]},
        ]), encoding="utf-8")
        (self.root / "RELEASE-VERSIONS").write_text("diagnostic_schema=1\n", encoding="utf-8")
        self.write_manifest()
        lock = threading.Lock()
        result = local_server.start_operation(self.root, "apply-module", {"module": "audio"}, lock)
        self.assertEqual(result["status"], "blocked")
        self.assertIn("recent diagnostic", result["message"].lower())

        checked_at = datetime.now(timezone.utc).isoformat()
        with local_server.DIAGNOSTIC_LOCK:
            local_server.DIAGNOSTIC_CACHE["audio"] = {"checked_at": checked_at, "status": "incomplete", "dependencies": [{"module": "base", "status": "not_checked"}]}
            local_server.DIAGNOSTIC_CACHE["base"] = {"checked_at": checked_at, "status": "complete"}
        self.assertIsNone(local_server.module_apply_blocker(self.root, "audio"))
        with local_server.DIAGNOSTIC_LOCK:
            local_server.DIAGNOSTIC_CACHE["audio"]["dependencies"] = []
        self.assertIn("does not match", local_server.module_apply_blocker(self.root, "audio") or "")
        with local_server.DIAGNOSTIC_LOCK:
            local_server.DIAGNOSTIC_CACHE["audio"]["dependencies"] = [{"module": "base", "status": "not_checked"}]
        with local_server.DIAGNOSTIC_LOCK:
            local_server.DIAGNOSTIC_CACHE["base"]["status"] = "partial"
        self.assertIn("dependency base", local_server.module_apply_blocker(self.root, "audio") or "")

    def test_stable_migration_requires_recent_official_update_check(self) -> None:
        report = {
            "status": "update_available",
            "current_version": "25.05",
            "latest_version": "25.11",
            "latest_channel": "https://nixos.org/channels/nixos-25.11",
            "source": "https://status.nixos.org/",
        }
        self.assertEqual(local_server.parse_stable_channel_report("prefix\n" + json.dumps(report) + "\nsuffix"), report)
        malformed = {**report, "source": "https://status.nixos.org.evil/"}
        self.assertIsNone(local_server.parse_stable_channel_report(json.dumps(malformed)))
        with local_server.STABLE_CHANNEL_LOCK:
            local_server.STABLE_CHANNEL_CACHE = (report, time.monotonic() - 601)
        self.assertIn("expired", local_server.stable_channel_migration_blocker() or "")
        with local_server.STABLE_CHANNEL_LOCK:
            local_server.STABLE_CHANNEL_CACHE = (report, time.monotonic())
        self.assertIsNone(local_server.stable_channel_migration_blocker())
        with local_server.STABLE_CHANNEL_LOCK:
            local_server.STABLE_CHANNEL_CACHE = ({"status": "current"}, time.monotonic())
        self.assertIn("did not confirm", local_server.stable_channel_migration_blocker() or "")

    def test_stable_migration_api_blocks_without_check(self) -> None:
        (self.root / "RELEASE-VERSIONS").write_text("diagnostic_schema=1\n", encoding="utf-8")
        self.write_manifest()
        lock = threading.Lock()
        result = local_server.start_operation(self.root, "migrate-stable-channel", {}, lock)
        self.assertEqual(result["status"], "blocked")
        self.assertIn("check", result["message"].lower())
        self.assertTrue(lock.acquire(blocking=False))
        lock.release()

    def test_full_preview_blocks_without_prepared_prerequisites(self) -> None:
        session = local_server.OperationSession("test-preview", self.root, "simulate-full", {})
        lock = threading.Lock()
        self.assertTrue(lock.acquire(blocking=False))
        local_server.run_session(session, lock)
        self.assertEqual(session.status, "blocked")
        self.assertIn("prerequisites", session.message)
        self.assertFalse((self.root / ".alpine-state" / "vars.yml").exists())

    def test_nix_profile_update_runs_in_bridge_without_preparing_ansible(self) -> None:
        session = local_server.OperationSession("test-nix-update", self.root, "update-nix-apps", {})
        lock = threading.Lock()
        self.assertTrue(lock.acquire(blocking=False))
        with patch.object(local_server, "run_pty_command", return_value=(0, "updated")) as command:
            local_server.run_session(session, lock)
        self.assertEqual(session.status, "success")
        self.assertEqual(command.call_args.args[1], ["sh", "scripts/atualizar-nix.sh", "aplicativos"])
        self.assertEqual(local_server.resolve_command("refresh-nix-apps", {})[0], [["sh", "scripts/atualizar-nix.sh", "aplicativos"]])

    def test_nix_profile_list_parser_returns_safe_app_entries(self) -> None:
        output = json.dumps({"elements": [
            {"name": "hello-2.12", "attrPath": "nixpkgs#hello", "active": True, "storePaths": ["/nix/store/demo-hello"]},
            {"name": "vim", "active": False},
        ]})
        self.assertEqual(local_server.parse_nix_profile_apps(output), [
            {"index": 1, "name": "hello-2.12", "attrPath": "nixpkgs#hello", "active": True, "storePaths": ["/nix/store/demo-hello"]},
            {"index": 2, "name": "vim", "attrPath": None, "active": False, "storePaths": []},
        ])

    def test_nix_profile_mutations_are_allowlisted_and_index_is_numeric(self) -> None:
        self.assertEqual(local_server.resolve_command("uninstall-nix-app", {"name": "firefox"})[0], [["nix-env", "--uninstall", "^firefox$"]])
        self.assertEqual(
            local_server.resolve_command("uninstall-nix-app", {"name": "timeshift-25.12.4"})[0],
            [["nix-env", "--uninstall", "^timeshift-25[.]12[.]4$"]],
        )
        self.assertEqual(local_server.resolve_command("collect-nix-garbage", {})[0], [["nix-collect-garbage"]])
        with self.assertRaises(ValueError):
            local_server.resolve_command("uninstall-nix-app", {"name": "firefox; rm -rf /"})

    def test_nix_package_search_parses_catalog_and_escapes_query(self) -> None:
        output = json.dumps({"nixpkgs.firefox": {"name": "firefox-130.0", "version": "130.0", "description": "Web browser"}})
        self.assertEqual(local_server.parse_nix_search_results(output), [{"attribute": "nixpkgs.firefox", "name": "firefox-130.0", "version": "130.0", "description": "Web browser"}])
        command = local_server.resolve_command("search-nix-packages", {"query": "firefox.*"})[0][0]
        self.assertEqual(command[:6], ["nix-env", "--query", "--available", "--json", "--attr-path", "--description"])
        self.assertEqual(command[6], ".*firefox\\.\\*.*")
        self.assertTrue(local_server.nix_search_has_no_results("error: selector '.*obsdian.*' matches no derivations"))

    def test_nix_search_no_results_are_reported_as_an_empty_success(self) -> None:
        session = local_server.OperationSession("test-nix-empty-search", self.root, "search-nix-packages", {"query": "obsdian"})
        lock = threading.Lock()
        self.assertTrue(lock.acquire(blocking=False))
        with patch.object(local_server, "run_pty_command", return_value=(1, "error: selector '.*obsdian.*' matches no derivations\n")):
            local_server.run_session(session, lock)
        self.assertEqual(session.status, "success")
        self.assertEqual(session.nix_packages, [])
        self.assertIn("No Nix packages matched", session.output)

    def test_nix_package_install_requires_safe_attribute_and_uses_system_terminal(self) -> None:
        self.assertEqual(local_server.resolve_command("install-nix-package", {"attribute": "nixpkgs.firefox"})[0], [["nix-env", "--install", "--attr", "nixpkgs.firefox"]])
        self.assertNotIn("install-nix-package", local_server.SYSTEM_TERMINAL_OPERATIONS)
        with self.assertRaises(ValueError):
            local_server.resolve_command("install-nix-package", {"attribute": "nixpkgs.firefox; touch /tmp/unsafe"})

    def test_desktop_environment_detection_uses_session_variables(self) -> None:
        with patch.dict(os.environ, {"XDG_CURRENT_DESKTOP": "KDE", "XDG_SESSION_TYPE": "wayland"}, clear=True):
            detected = local_server.detect_desktop_environment()
        self.assertEqual(detected["id"], "kde")
        self.assertEqual(detected["session_type"], "wayland")
        self.assertIn("KDE application menu refresh", detected["capabilities"])
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(local_server.detect_desktop_environment()["id"], "unknown")

    def test_desktop_target_blocks_kde_module_outside_kde(self) -> None:
        with patch.dict(os.environ, {"XDG_CURRENT_DESKTOP": "GNOME"}, clear=True):
            self.assertIn("not available", local_server.module_desktop_blocker("kde"))
        with patch.dict(os.environ, {"XDG_CURRENT_DESKTOP": "KDE"}, clear=True):
            self.assertIsNone(local_server.module_desktop_blocker("kde"))
        self.assertEqual(local_server.module_desktop_targets("audio", {"desktop_targets": ["gnome"]}), ("gnome",))

    def test_kde_nix_refresh_uses_allowlisted_script_without_system_actions_in_test(self) -> None:
        commands, description = local_server.resolve_command("refresh-kde-apps", {})
        self.assertEqual(commands, [["sh", "roles/nix/files/atualizar-aplicativos-nix.sh"]])
        self.assertIn("restart Plasma", description)
        self.assertIn("refresh-kde-apps", local_server.OPERATIONS)
        self.assertNotIn("refresh-kde-apps", local_server.PRIVILEGED_OPERATIONS)
        self.assertNotIn("refresh-kde-apps", local_server.SYSTEM_TERMINAL_OPERATIONS)

        session = local_server.OperationSession("test-kde-refresh", self.root, "refresh-kde-apps", {})
        lock = threading.Lock()
        self.assertTrue(lock.acquire(blocking=False))
        with patch.object(local_server, "run_pty_command", return_value=(0, "mocked KDE refresh")) as pty, patch.object(local_server, "execute_in_system_terminal") as terminal:
            local_server.run_session(session, lock)
        self.assertEqual(session.status, "success")
        self.assertEqual(pty.call_args.args[1], ["sh", "roles/nix/files/atualizar-aplicativos-nix.sh"])
        terminal.assert_not_called()

    def test_pty_timeout_terminates_command(self) -> None:
        env = os.environ.copy()
        session = local_server.OperationSession("test-timeout", self.root, "system-check", {})
        started = time.monotonic()
        with (self.root / "timeout.log").open("w", encoding="utf-8") as log:
            with patch.object(local_server, "COMMAND_TIMEOUT_SECONDS", 0.2), patch.object(local_server, "PTY_TERMINATION_GRACE_SECONDS", 0.2):
                return_code, output = local_server.run_pty_command(session, [sys.executable, "-c", "import time; time.sleep(30)"], log, env, self.backend)
        elapsed = time.monotonic() - started
        self.assertEqual(return_code, 124)
        self.assertLess(elapsed, 4)
        self.assertIn("safety timeout", session.snapshot()["output"])
        self.assertEqual(output, "")

    def test_system_terminal_streams_private_output_before_command_finishes(self) -> None:
        operation_path = local_server.operation_dir(self.root)
        operation_path.mkdir(mode=0o700, parents=True, exist_ok=True)
        session = local_server.OperationSession("test-streaming-terminal", self.root, "apply-full", {})
        result: list[tuple[str, int]] = []
        command = ["sh", "-c", "printf 'phase-one\\n'; sleep 0.8; printf 'phase-two\\n'"]
        log_path = self.root / "streaming.log"
        with log_path.open("w", encoding="utf-8") as log:
            with patch.object(local_server, "terminal_command", side_effect=lambda script: ["/bin/sh", str(script)]):
                worker = threading.Thread(target=lambda: result.append(local_server.execute_in_system_terminal(self.root, self.backend, command, operation_path, session.session_id, os.environ.copy(), session, log)))
                worker.start()
                deadline = time.monotonic() + 2
                while time.monotonic() < deadline and "phase-one" not in session.snapshot()["output"]:
                    time.sleep(0.02)
                self.assertIn("phase-one", session.snapshot()["output"])
                self.assertTrue(worker.is_alive(), "output must stream before the command exits")
                worker.join(timeout=4)
                self.assertFalse(worker.is_alive())
        self.assertEqual(result, [("", 0)])
        streamed = session.snapshot()["output"]
        self.assertIn("phase-one", streamed)
        self.assertIn("phase-two", streamed)
        saved_log = log_path.read_text(encoding="utf-8")
        self.assertIn("phase-one", saved_log)
        self.assertIn("phase-two", saved_log)

    def test_pty_timeout_kills_detached_setsid_descendant(self) -> None:
        pid_file = self.root / "detached.pid"
        code = (
            "import os, signal, time\n"
            f"pid_file = {str(pid_file)!r}\n"
            "child = os.fork()\n"
            "if child == 0:\n"
            "    signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
            "    os.setsid()\n"
            "    with open(pid_file, 'w') as stream: stream.write(str(os.getpid()))\n"
            "    time.sleep(30)\n"
            "    os._exit(0)\n"
            "time.sleep(1)\n"
        )
        session = local_server.OperationSession("test-detached-timeout", self.root, "system-check", {})
        started = time.monotonic()
        try:
            with (self.root / "detached.log").open("w", encoding="utf-8") as log:
                with patch.object(local_server, "COMMAND_TIMEOUT_SECONDS", 0.15), patch.object(local_server, "PTY_TERMINATION_GRACE_SECONDS", 0.1), patch.object(local_server, "PTY_HARD_STOP_GRACE_SECONDS", 0.2):
                    return_code, _ = local_server.run_pty_command(session, [sys.executable, "-c", code], log, os.environ.copy(), self.backend)
            self.assertEqual(return_code, 124)
            self.assertLess(time.monotonic() - started, 4)
            self.assertTrue(pid_file.exists())
            self.assertFalse(local_server.process_is_running(int(pid_file.read_text(encoding="ascii"))))
        finally:
            if pid_file.exists():
                try:
                    os.kill(int(pid_file.read_text(encoding="ascii")), 9)
                except (OSError, ValueError):
                    pass

    def test_operation_gate_blocks_when_timed_out_process_is_still_alive(self) -> None:
        with local_server.LINGERING_PROCESS_LOCK:
            local_server.LINGERING_PROCESS_PIDS.add(os.getpid())
        lock = threading.Lock()
        result = local_server.start_operation(self.root, "validate-backend", {}, lock)
        self.assertEqual(result["status"], "blocked")
        self.assertIn("still running", result["message"])
        self.assertTrue(lock.acquire(blocking=False))
        lock.release()

    def test_operation_lock_is_released_when_state_directory_fails(self) -> None:
        (self.root / ".alpine-state").write_text("not a directory", encoding="utf-8")
        session = local_server.OperationSession("test-lock", self.root, "validate-backend", {})
        lock = threading.Lock()
        self.assertTrue(lock.acquire(blocking=False))
        local_server.run_session(session, lock)
        self.assertEqual(session.status, "error")
        self.assertTrue(lock.acquire(blocking=False))
        lock.release()

    def test_backend_validation_writes_private_operation_log(self) -> None:
        session = local_server.OperationSession("test-validate", self.root, "validate-backend", {})
        lock = threading.Lock()
        self.assertTrue(lock.acquire(blocking=False))
        local_server.run_session(session, lock)
        log_path = local_server.operation_log_path(self.root, "validate-backend", {}, "test-validate")
        self.assertEqual(session.status, "success")
        self.assertEqual(session.snapshot()["log_path"], log_path.relative_to(self.root).as_posix())
        self.assertIn("matches the release manifest", log_path.read_text(encoding="utf-8"))
        self.assertEqual(log_path.stat().st_mode & 0o777, 0o600)

    def test_module_and_apply_logs_are_partitioned_safely(self) -> None:
        module_log = local_server.operation_log_path(self.root, "apply-module", {"module": "audio"}, "audio-session")
        apply_log = local_server.operation_log_path(self.root, "apply-full", {}, "apply-session")
        self.assertTrue(module_log.as_posix().endswith("/logs/apply/modules/audio/audio-session.log"))
        self.assertTrue(apply_log.as_posix().endswith("/logs/apply/all-modules/apply-session.log"))
        self.assertEqual(module_log.parent.stat().st_mode & 0o777, 0o700)
        with self.assertRaises(OSError):
            local_server.operation_log_path(self.root, "apply-module", {"module": "audio"}, "../outside")

    def test_early_operation_error_is_written_to_its_persistent_log(self) -> None:
        session = local_server.OperationSession("test-invalid", self.root, "invalid-operation", {})
        lock = threading.Lock()
        self.assertTrue(lock.acquire(blocking=False))
        local_server.run_session(session, lock)
        log_path = self.root / str(session.snapshot()["log_path"])
        self.assertEqual(session.status, "error")
        self.assertIn("Unsupported operation", log_path.read_text(encoding="utf-8"))

    def test_diagnostic_json_is_exposed_in_operation_snapshot(self) -> None:
        diagnostic_script = self.backend / "scripts" / "diagnostico-modulo.py"
        diagnostic_script.write_text(
            "import json\n"
            "from datetime import datetime, timezone\n"
            "print(json.dumps({'schema_version': 1, 'module': 'audio', 'checked_at': datetime.now(timezone.utc).isoformat(), 'status': 'partial', 'summary': {'passed': 1, 'failed': 0, 'warnings': 1, 'unknown': 0, 'total': 2, 'required_total': 1}, 'dependencies': [], 'checks': [{'id': 'server', 'title': 'Audio server', 'description': 'Required', 'status': 'ok', 'required': True, 'message': 'Ready'}, {'id': 'device', 'title': 'Audio device', 'description': 'Optional', 'status': 'warning', 'required': False, 'message': 'Not found'}]}))\n",
            encoding="utf-8",
        )
        self.write_manifest()
        session = local_server.OperationSession("test-diagnostic", self.root, "diagnose-module", {"module": "audio"})
        lock = threading.Lock()
        self.assertTrue(lock.acquire(blocking=False))
        local_server.run_session(session, lock)
        snapshot = session.snapshot()
        self.assertEqual(snapshot["status"], "success")
        self.assertEqual(snapshot["results"][0]["module"], "audio")
        self.assertEqual(snapshot["results"][0]["status"], "partial")

    def test_rejects_unsupported_diagnostic_schema(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unsupported diagnostic schema"):
            local_server.validate_diagnostic_payload({"schema_version": 2})

    def start_http_server(self) -> tuple[local_server.ThreadingHTTPServer, str, str]:
        catalog = [{"key": "audio", "description": "PipeWire services", "dependencies": ["base"]}]
        (self.backend / "modulos.json").write_text(json.dumps(catalog), encoding="utf-8")
        frontend = self.root / "frontend" / "dist"
        frontend.mkdir(parents=True)
        (frontend / "index.html").write_text("<!doctype html><html><head></head><body>test</body></html>", encoding="utf-8")
        self.write_manifest()
        server = local_server.ThreadingHTTPServer(("127.0.0.1", 0), local_server.Handler)
        server.root = self.root
        server.session_token = "test-session-token"
        server.operation_lock = threading.Lock()
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.shutdown)
        self.addCleanup(server.server_close)
        port = server.server_address[1]
        return server, f"http://127.0.0.1:{port}", f"127.0.0.1:{port}"

    def test_module_catalog_returns_source_data_and_accepts_local_origin(self) -> None:
        _, base_url, host = self.start_http_server()
        request = Request(f"{base_url}/api/modules", headers={"Host": host, "Origin": base_url, "X-ADC-Token": "test-session-token"})
        with urlopen(request, timeout=3) as response:
            payload = json.loads(response.read().decode("utf-8"))
        audio = next(module for module in payload["modules"] if module["id"] == "audio")
        self.assertEqual(audio["description"], "PipeWire services")
        self.assertEqual(audio["dependencies"], ["base"])
        self.assertEqual(audio["state"], "Unknown")

    def test_module_catalog_hides_desktop_specific_modules(self) -> None:
        _, base_url, host = self.start_http_server()
        (self.backend / "modulos.json").write_text(json.dumps([
            {"key": "audio", "description": "Shared audio", "dependencies": []},
            {"key": "kde", "description": "KDE only", "dependencies": [], "desktop_targets": ["kde"]},
        ]), encoding="utf-8")
        with patch.dict(os.environ, {"XDG_CURRENT_DESKTOP": "GNOME"}, clear=True):
            request = Request(f"{base_url}/api/modules", headers={"Host": host, "Origin": base_url, "X-ADC-Token": "test-session-token"})
            with urlopen(request, timeout=3) as response:
                payload = json.loads(response.read().decode("utf-8"))
        self.assertEqual(payload["desktop"], "gnome")
        self.assertEqual([module["id"] for module in payload["modules"] if module["id"] == "kde"], [])

    def test_logs_endpoint_lists_nested_module_logs_without_following_symlinks(self) -> None:
        _, base_url, host = self.start_http_server()
        log_path = local_server.operation_log_path(self.root, "apply-module", {"module": "audio"}, "api-audio")
        log_path.write_text("private output\n", encoding="utf-8")
        log_path.chmod(0o600)
        outside_log = self.root / "outside.log"
        outside_log.write_text("outside private output\n", encoding="utf-8")
        symlink_log = log_path.parent / "linked.log"
        symlink_log.symlink_to(outside_log)
        request = Request(f"{base_url}/api/logs", headers={"Host": host, "Origin": base_url, "X-ADC-Token": "test-session-token"})
        with urlopen(request, timeout=3) as response:
            payload = json.loads(response.read().decode("utf-8"))
        paths = {item["path"] for item in payload["logs"]}
        self.assertIn(".alpine-state/web/unknown/logs/apply/modules/audio/api-audio.log", paths)
        self.assertNotIn(".alpine-state/web/unknown/logs/apply/modules/audio/linked.log", paths)
        with self.assertRaises(HTTPError) as caught:
            urlopen(Request(f"{base_url}/api/logs/linked", headers={"Host": host, "Origin": base_url, "X-ADC-Token": "test-session-token"}), timeout=3)
        self.assertEqual(caught.exception.code, 404)
        with self.assertRaises(HTTPError) as caught:
            urlopen(Request(f"{base_url}/api/logs/%2e%2e%2foutside", headers={"Host": host, "Origin": base_url, "X-ADC-Token": "test-session-token"}), timeout=3)
        self.assertEqual(caught.exception.code, 404)

    def test_operation_history_lists_metadata_and_reads_only_the_named_log(self) -> None:
        _, base_url, host = self.start_http_server()
        log_path = local_server.operation_log_path(self.root, "apply-module", {"module": "audio"}, "api-audio-history")
        log_path.write_text("Operation: apply module audio\nNamed operation: apply-module\nModule: audio\nStarted: 2026-11-05T12:00:00-03:00\nOperation status: success\nApplied PipeWire.\n", encoding="utf-8")
        log_path.chmod(0o600)
        state_dirs = [self.root / ".alpine-state", self.root / ".alpine-state" / "web", self.root / ".alpine-state" / "web" / "unknown", self.root / ".alpine-state" / "web" / "unknown" / "operations"]
        for directory in state_dirs:
            directory.chmod(0o750)
        headers = {"Host": host, "Origin": base_url, "X-ADC-Token": "test-session-token"}
        with urlopen(Request(f"{base_url}/api/logs", headers=headers), timeout=3) as response:
            history = json.loads(response.read().decode("utf-8"))["logs"]
        entry = next(item for item in history if item["id"] == "api-audio-history")
        self.assertEqual(entry["operation"], "apply-module")
        self.assertEqual(entry["module"], "audio")
        self.assertEqual(entry["status"], "success")
        self.assertEqual(entry["label"], "apply module audio")
        with urlopen(Request(f"{base_url}/api/logs/api-audio-history", headers=headers), timeout=3) as response:
            detail = json.loads(response.read().decode("utf-8"))
        self.assertIn("Applied PipeWire.", detail["content"])
        self.assertEqual(detail["path"], entry["path"])
        self.assertEqual([directory.stat().st_mode & 0o777 for directory in state_dirs], [0o750] * len(state_dirs))

    def test_operation_logs_are_grouped_by_action_and_destination(self) -> None:
        cases = {
            "validate-backend": ({}, ("logs", "verify", "backend")),
            "system-check": ({}, ("logs", "verify", "system")),
            "check-all-modules": ({}, ("logs", "verify", "all-modules")),
            "diagnose-module": ({"module": "audio"}, ("logs", "verify", "modules", "audio")),
            "simulate-full": ({}, ("logs", "apply", "preview")),
            "apply-full": ({}, ("logs", "apply", "all-modules")),
            "apply-diagnostics": ({}, ("logs", "apply", "diagnostics")),
            "apply-module": ({"module": "audio"}, ("logs", "apply", "modules", "audio")),
            "check-stable-channel": ({}, ("logs", "nix", "stable-check")),
            "migrate-stable-channel": ({}, ("logs", "nix", "stable-migration")),
            "refresh-nix-apps": ({}, ("logs", "nix", "profile-apps")),
            "update-nix-apps": ({}, ("logs", "nix", "profile-apps")),
            "refresh-kde-apps": ({}, ("logs", "nix", "kde-refresh")),
        }
        release_state = self.root / ".alpine-state" / "web" / "unknown"
        for index, (operation, (payload, categories)) in enumerate(cases.items()):
            session_id = f"bucket-{index}"
            path = local_server.operation_log_path(self.root, operation, payload, session_id)
            self.assertEqual(path.relative_to(release_state).parts, (*categories, f"{session_id}.log"))
            self.assertEqual(path.parent.stat().st_mode & 0o777, 0o700)

    def test_legacy_operation_logs_remain_listed_and_readable(self) -> None:
        legacy_path = self.root / ".alpine-state" / "web" / "unknown" / "operations" / "general" / "legacy-stable.log"
        legacy_path.parent.mkdir(parents=True, mode=0o700)
        legacy_path.write_text("Operation: check official Stable Nix channel\nNamed operation: check-stable-channel\nOperation status: success\nLegacy output.\n", encoding="utf-8")
        legacy_path.chmod(0o600)
        new_path = local_server.operation_log_path(self.root, "refresh-kde-apps", {}, "new-kde-refresh")
        new_path.write_text("Operation: refresh KDE Nix app menu and restart Plasma\nNamed operation: refresh-kde-apps\nOperation status: success\nNew output.\n", encoding="utf-8")
        new_path.chmod(0o600)

        history = local_server.list_operation_logs(self.root)
        paths = {entry["path"] for entry in history}
        self.assertIn(".alpine-state/web/unknown/operations/general/legacy-stable.log", paths)
        self.assertIn(".alpine-state/web/unknown/logs/nix/kde-refresh/new-kde-refresh.log", paths)
        self.assertIn("Legacy output.", local_server.read_operation_log(self.root, "legacy-stable")["content"])

    def test_stable_channel_status_starts_not_checked_without_saved_logs(self) -> None:
        _, base_url, host = self.start_http_server()
        headers = {"Host": host, "Origin": base_url, "X-ADC-Token": "test-session-token"}
        with urlopen(Request(f"{base_url}/api/logs", headers=headers), timeout=3) as response:
            self.assertEqual(json.loads(response.read().decode("utf-8"))["logs"], [])
        request = Request(f"{base_url}/api/stable-channel/status", headers={"Host": host, "Origin": base_url, "X-ADC-Token": "test-session-token"})
        with urlopen(request, timeout=3) as response:
            payload = json.loads(response.read().decode("utf-8"))
        self.assertFalse(payload["checked"])
        self.assertEqual(payload["status"], "not_checked")
        self.assertIsNone(payload["log_path"])
        self.assertFalse((self.root / ".alpine-state").exists())

    def test_stable_channel_status_recovers_latest_report_from_private_log(self) -> None:
        log_path = local_server.operation_log_path(self.root, "check-stable-channel", {}, "stable-check-1")
        log_path.write_text("Operation: check official Stable Nix channel\nNamed operation: check-stable-channel\nStarted: 2026-11-05T12:00:00-03:00\n{\n  \"status\": \"current\",\n  \"current_version\": \"25.05\",\n  \"latest_version\": \"25.05\",\n  \"latest_channel\": \"https://nixos.org/channels/nixos-25.05\",\n  \"source\": \"https://status.nixos.org/\"\n}\nOperation status: success\n", encoding="utf-8")
        log_path.chmod(0o600)
        _, base_url, host = self.start_http_server()
        request = Request(f"{base_url}/api/stable-channel/status", headers={"Host": host, "Origin": base_url, "X-ADC-Token": "test-session-token"})
        with urlopen(request, timeout=3) as response:
            payload = json.loads(response.read().decode("utf-8"))
        self.assertTrue(payload["checked"])
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["report"]["status"], "current")
        self.assertEqual(payload["log_id"], "stable-check-1")
        self.assertTrue(payload["log_path"].endswith("/logs/nix/stable-check/stable-check-1.log"))

    def test_browser_session_cookie_is_httponly_and_authenticates_without_header(self) -> None:
        _, base_url, host = self.start_http_server()
        page_request = Request(f"{base_url}/", headers={"Host": host})
        with urlopen(page_request, timeout=3) as response:
            cookie_header = response.headers.get("Set-Cookie", "")
            self.assertIn("HttpOnly", cookie_header)
            self.assertIn("SameSite=Strict", cookie_header)
            self.assertIn("ADC-Session=test-session-token", cookie_header)
            self.assertIn("Content-Security-Policy", response.headers)
        cookie = cookie_header.split(";", 1)[0]
        api_request = Request(f"{base_url}/api/modules", headers={"Host": host, "Origin": base_url, "Cookie": cookie})
        with urlopen(api_request, timeout=3) as response:
            payload = json.loads(response.read().decode("utf-8"))
        self.assertTrue(any(module["id"] == "audio" for module in payload["modules"]))

    def test_rejects_lookalike_origin(self) -> None:
        _, base_url, host = self.start_http_server()
        port = host.rsplit(":", 1)[1]
        request = Request(f"{base_url}/api/modules", headers={"Host": host, "Origin": f"http://localhost.evil:{port}", "X-ADC-Token": "test-session-token"})
        with self.assertRaises(HTTPError) as caught:
            urlopen(request, timeout=3)
        self.assertEqual(caught.exception.code, 403)

    def test_rejects_origin_with_path(self) -> None:
        _, base_url, host = self.start_http_server()
        request = Request(f"{base_url}/api/modules", headers={"Host": host, "Origin": f"{base_url}/path", "X-ADC-Token": "test-session-token"})
        with self.assertRaises(HTTPError) as caught:
            urlopen(request, timeout=3)
        self.assertEqual(caught.exception.code, 403)

    def test_no_browser_to_pty_input_route(self) -> None:
        _, base_url, host = self.start_http_server()
        request = Request(
            f"{base_url}/api/operations/fake-session/input",
            data=b'{"input":"password"}',
            headers={"Host": host, "Origin": base_url, "X-ADC-Token": "test-session-token", "Content-Type": "application/json"},
            method="POST",
        )
        with self.assertRaises(HTTPError) as caught:
            urlopen(request, timeout=3)
        self.assertEqual(caught.exception.code, 404)


if __name__ == "__main__":
    unittest.main()
