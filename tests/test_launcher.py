import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LAUNCHER = (ROOT / 'Alpine Desktop Center').read_text(encoding='utf-8')


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


if __name__ == '__main__':
    unittest.main()
