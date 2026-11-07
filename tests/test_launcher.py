import re
import unittest
from textwrap import dedent
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LAUNCHER = (ROOT / 'Alpine Desktop Center').read_text(encoding='utf-8')
DESKTOP_ENTRY = (ROOT / 'Alpine Desktop Center.desktop').read_text(encoding='utf-8')


class FullscreenLauncherTests(unittest.TestCase):
    def test_chromium_variants_start_in_fullscreen_app_mode(self):
        for browser in ('chromium', 'chromium-browser', 'google-chrome'):
            with self.subTest(browser=browser):
                pattern = rf'(?s){re.escape(browser)} --app=.*?--start-fullscreen'
                self.assertRegex(LAUNCHER, pattern)

    def test_firefox_remains_in_kiosk_mode(self):
        self.assertRegex(LAUNCHER, r'(?s)firefox .*?--kiosk')

    def test_launcher_rejects_source_checkout_without_embedded_backend(self):
        self.assertIn('not a complete Alpine Desktop Center release', LAUNCHER)
        self.assertIn('BACKEND-MANIFEST.sha256', LAUNCHER)

    def test_portable_desktop_entry_has_a_parseable_exec_with_double_click_path(self):
        self.assertIn('Exec=/bin/sh -c "exec \\\\"$(dirname \\\\"$1\\\\")/launch-from-desktop.sh\\\\" \\\\"$1\\\\"" dummy %k', DESKTOP_ENTRY)
        self.assertIn('Terminal=false', DESKTOP_ENTRY)

    def test_launcher_health_check_embedded_python_compiles(self):
        block = LAUNCHER.split("<<'PY'\n", 1)[1].split("\nPY\n", 1)[0]
        compile(dedent(block), 'launcher-health-check.py', 'exec')


if __name__ == '__main__':
    unittest.main()
