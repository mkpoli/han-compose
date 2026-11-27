"""The Extension J table names a positional form the way BabelStone's table does."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from han_compose import compose

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("build_extension_j_ids", ROOT / "scripts/build_extension_j_ids.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


def test_each_operand_is_read_with_its_place() -> None:
    assert build.placed("⿱⿰牛君牛") == [(2, "L"), (3, "R"), (4, "B")]
    # A middle operand and the operands of an enclosure stand in no such place.
    assert build.placed("⿲金木⿴囗牛") == [(1, "L"), (2, None), (4, None), (5, None)]


def test_a_radical_babelstone_never_writes_in_full_is_written_as_its_form() -> None:
    forms = build.conventions()
    assert forms == {("L", "金"): "釒", ("L", "言"): "訁", ("L", "牛"): "牜"}
    assert build.respelled("⿱⿰牛君牛", forms) == "⿱⿰牜君牛"
    # 金 on the right or under another part is written in full by BabelStone too.
    assert build.respelled("⿰口金", forms) == "⿰口金" and build.respelled("⿱雨⿰言邑", forms) == "⿱雨⿰訁邑"


def test_the_table_writes_no_radical_in_full_where_the_main_table_never_does() -> None:
    forms = build.conventions()
    for char, sequence in compose.read_rows("han-ids-extension-j.tsv"):
        assert build.respelled(sequence, forms) == sequence, char
