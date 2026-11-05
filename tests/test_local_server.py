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
        symlink_path = self.root / "terminal-output-link"
        symlink_path.symlink_to(private_path)
        with self.assertRaises(OSError):
            local_server.read_private_file(symlink_path, 100)

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
        self.assertIn("refresh-nix-apps", local_server.SYSTEM_TERMINAL_OPERATIONS)
        self.assertIn("migrate-stable-channel", local_server.SYSTEM_TERMINAL_OPERATIONS)
        self.assertNotIn("refresh-nix-apps", local_server.PRIVILEGED_OPERATIONS)
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

    def test_nix_refresh_uses_terminal_without_preparing_ansible(self) -> None:
        session = local_server.OperationSession("test-nix-refresh", self.root, "refresh-nix-apps", {})
        lock = threading.Lock()
        self.assertTrue(lock.acquire(blocking=False))
        with patch.object(local_server, "execute_in_system_terminal", return_value=("updated", 0)) as terminal:
            local_server.run_session(session, lock)
        self.assertEqual(session.status, "success")
        self.assertEqual(terminal.call_args.args[2], ["sh", "scripts/atualizar-nix.sh", "aplicativos"])

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
        log_path = local_server.operation_dir(self.root) / "general" / "test-validate.log"
        self.assertEqual(session.status, "success")
        self.assertEqual(session.snapshot()["log_path"], log_path.relative_to(self.root).as_posix())
        self.assertIn("matches the release manifest", log_path.read_text(encoding="utf-8"))
        self.assertEqual(log_path.stat().st_mode & 0o777, 0o600)

    def test_module_and_general_logs_are_partitioned_safely(self) -> None:
        module_log = local_server.operation_log_path(self.root, "apply-module", {"module": "audio"}, "audio-session")
        general_log = local_server.operation_log_path(self.root, "apply-full", {}, "general-session")
        self.assertTrue(module_log.as_posix().endswith("/modules/audio/audio-session.log"))
        self.assertTrue(general_log.as_posix().endswith("/general/general-session.log"))
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
        self.assertIn(".alpine-state/web/unknown/operations/modules/audio/api-audio.log", paths)
        self.assertNotIn(".alpine-state/web/unknown/operations/modules/audio/linked.log", paths)

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
