"""Run with python3 -m unittest discover -s scripts -p test_pyramid_catalog.py."""
import unittest
from build_pyramid_glyphs import catalog


class PyramidCatalogTest(unittest.TestCase):
    def test_explicit_encoded_and_positional_pairs(self):
        rows = catalog('鹿\t鹿\n麤\t⿱鹿𱋁(G)\n𱋁\t⿰鹿鹿(G)\n'
                       '磊\t⿱石⿰石石(G)\n鑫\t⿱金鍂(G)\n鍂\t⿰釒金(G)\n'
                       '犇\t⿱牛牪(G)\n牪\t⿰牜牛(G)\n')
        self.assertEqual({r['char'] for r in rows}, set('麤磊鑫犇'))
        self.assertEqual(next(r for r in rows if r['char'] == '麤')['pair'], '⿰鹿鹿')

    def test_rejects_approximate_mixed_and_other_arrangements(self):
        rows = catalog('甲\t〾⿱石⿰石石(G)\n乙\t⿱石⿰石口(G)\n'
                       '丙\t⿲石石石(G)\n丁\t⿱⿰石石石(G)\n'
                       '戊\t⿱鹿𱋁(G)\n𱋁\t〾⿰鹿鹿(G)\n')
        self.assertEqual(rows, [])

    def test_keeps_attested_alternatives(self):
        rows = catalog('森\t⿱木林(G) ⿱木⿰木木(J)\n林\t⿰木木(GJ)\n')
        self.assertEqual([r['sequence'] for r in rows], ['⿱木⿰木木', '⿱木林'])
