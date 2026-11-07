import re
import unittest
from pathlib import Path


I18N = Path(__file__).parents[1] / 'src' / 'i18n.ts'


class TranslationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        text = I18N.read_text(encoding='utf-8')
        cls.blocks = {}
        for name, start, end in (
            ('en', 'const en: UiCopy = {', 'const pt: UiCopy = {'),
            ('pt', 'const pt: UiCopy = {', 'export const copy'),
        ):
            start_index = text.index(start) + len(start)
            cls.blocks[name] = text[start_index:text.index(end, start_index)]

    def test_locale_blocks_have_the_same_top_level_contract(self):
        keys = {
            name: set(re.findall(r'^  ([A-Za-z][A-Za-z0-9_]*):', block, re.MULTILINE))
            for name, block in self.blocks.items()
        }
        self.assertSetEqual(keys['en'], keys['pt'])

    def test_locale_blocks_preserve_interpolation_tokens(self):
        tokens = {
            name: sorted(set(re.findall(r'\{[A-Za-z0-9_]+\}', block)))
            for name, block in self.blocks.items()
        }
        self.assertEqual(tokens['en'], tokens['pt'])

    def test_pt_br_has_no_known_untranslated_ui_phrases(self):
        string_values = ' '.join(re.findall(r"'([^']*)'", self.blocks['pt'])).lower()
        for phrase in ('workspace', 'best-effort', 'check mode', 'apps nix'):
            self.assertNotIn(phrase, string_values)


if __name__ == '__main__':
    unittest.main()
