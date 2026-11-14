"""A character's forms: Noto's regional designs, its variation sequences and its compatibility ideographs."""

from __future__ import annotations

import hashlib
import io
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
import typer

from han_compose import compose, variants
from han_compose.variants import Form, Table


def _table(tmp_path: Path, name: str, data: bytes) -> Table:
    (tmp_path / name).write_bytes(data)
    return Table(name, "https://example.invalid/" + name, hashlib.sha256(data).hexdigest(), variants.UNICODE_LICENCE, "test")


def test_a_cubic_and_a_quadratic_outline_are_written_y_down_in_a_thousand_units() -> None:
    cubic = [("moveTo", ((0, 880),)), ("curveTo", ((100, 880), (200, 780), (200, 680))), ("lineTo", ((0, 680),)), ("closePath", ())]
    assert variants.outline(cubic, 1.0, 880) == "M0 0C100 0 200 100 200 200L0 200Z"
    # Jigmo draws on 1,024 units with its em's top at 880.
    assert variants.outline([("moveTo", ((512, 880),)), ("lineTo", ((1024, -144),)), ("closePath", ())], 1000 / 1024, 880) == "M500 0L1000 1000Z"
    # TrueType's implied points are written out, and a contour of off-curve points starts between its last and first.
    quadratic = [("moveTo", ((0, 0),)), ("qCurveTo", ((100, 0), (100, 100), (0, 100))), ("closePath", ())]
    assert variants.outline(quadratic, 1.0, 100) == "M0 100Q100 100 100 50Q100 0 0 0Z"
    assert variants.outline([("qCurveTo", ((0, 0), (100, 0), (100, 100), (0, 100), None)), ("closePath", ())], 1.0, 100).startswith("M0 50Q0 100 50 100")


def test_outlines_are_the_same_whatever_order_their_contours_come_in() -> None:
    a, b = "M0 0L10 0L10 10Z", "M20 20L30 20L30 30Z"
    assert variants.same(a + b) == variants.same(b + a)
    assert variants.same(a + b) != variants.same(a)


def test_a_data_file_that_does_not_match_its_pin_is_refused(tmp_path: Path) -> None:
    table = _table(tmp_path, "pinned.txt", b"845B E0100; Adobe-Japan1; CID+1481\n")
    assert table.read(tmp_path) == b"845B E0100; Adobe-Japan1; CID+1481\n"
    (tmp_path / "pinned.txt").write_bytes(b"845B E0100; Adobe-Japan1; CID+1482\n")
    with pytest.raises(ValueError, match="pinned SHA-256"):
        table.read(tmp_path)


def test_a_sequence_two_collections_register_is_one_sequence_with_both(tmp_path: Path, monkeypatch) -> None:
    text = "# IVD_Sequences\n845B E0100; Adobe-Japan1; CID+1481\n845B E0102; Hanyo-Denshi; JA1975\n845B E0102; Moji_Joho; MJ022335\n845C E0100; Adobe-Japan1; CID+1\n"
    monkeypatch.setattr(variants, "IVD", _table(tmp_path, "ivd.txt", text.encode()))
    assert variants.registered(0x845B, tmp_path) == {0xE0100: [("Adobe-Japan1", "CID+1481")],
                                                      0xE0102: [("Hanyo-Denshi", "JA1975"), ("Moji_Joho", "MJ022335")]}


def test_standardized_sequences_and_compatibility_ideographs_are_read_for_one_character(tmp_path: Path, monkeypatch) -> None:
    text = "# StandardizedVariants\n4FAE FE00; CJK COMPATIBILITY IDEOGRAPH-FA30;\n4FAE FE01; CJK COMPATIBILITY IDEOGRAPH-2F805;\n8005 FE00; CJK COMPATIBILITY IDEOGRAPH-FA5B;\n"
    monkeypatch.setattr(variants, "STANDARDIZED", _table(tmp_path, "sv.txt", text.encode()))
    assert variants.standardized(0x4FAE, tmp_path) == {0xFE00: "CJK COMPATIBILITY IDEOGRAPH-FA30", 0xFE01: "CJK COMPATIBILITY IDEOGRAPH-2F805"}
    rows = "# Unihan_IRGSources.txt\nU+4FAE\tkIRG_GSource\tG0-4E6A\nU+4FAE\tkRSUnicode\t9.7\nU+FA30\tkCompatibilityVariant\tU+4FAE\nU+FA30\tkIRG_JSource\tJ3-2E38\nU+2F805\tkCompatibilityVariant\tU+4FAE\nU+FA5B\tkCompatibilityVariant\tU+8005\n"
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as bundle:
        bundle.writestr("Unihan_IRGSources.txt", rows)
    monkeypatch.setattr(variants, "UNIHAN", _table(tmp_path, "unihan.zip", archive.getvalue()))
    assert variants.unihan(0x4FAE, tmp_path) == ([0xFA30, 0x2F805], {"kIRG_GSource": "G0-4E6A"})


def _drawn(kind: str, label: str, path: str | None, same_as: str | None = None) -> Form:
    face = SimpleNamespace(file="Test.ttf", name="Test Face", family="Test Face", version="1.0", licence="none", sha256="0")
    return Form(kind, label, "葛", face if path else None, "glyph" if path else None, path, same_as)


def test_the_sheet_draws_each_outline_once_and_names_the_forms_that_share_it() -> None:
    square = "M0 0L10 0L10 10Z"
    found = [_drawn("regional", "Test JP", square), _drawn("regional", "Test KR", square, "Test JP"),
             _drawn("ivs", "Adobe-Japan1 CID+1, Moji_Joho MJ1", "M0 0L20 0L20 20Z"), _drawn("ivs", "Moji_Joho MJ2", None)]
    above = variants.headings(SimpleNamespace(regional=[found[0].face]))
    root = ET.fromstring(variants.sheet("葛 U+845B", found, above))
    space = "{http://www.w3.org/2000/svg}"
    assert root.get("fill") == "currentColor"
    assert len(root.findall(f"{space}path")) == 2
    texts = [text.text for text in root.findall(f"{space}text")]
    assert "= Test KR" in texts and "Moji_Joho MJ2" in texts and any(text.endswith("no font on disk") for text in texts)
    # A sequence two collections register has a line for each.
    assert "Adobe-Japan1 CID+1" in texts and "Moji_Joho MJ1" in texts
    every = ET.fromstring(variants.sheet("葛 U+845B", found, above, every=True))
    assert len(every.findall(f"{space}path")) == 3
    assert "= Test JP" in [text.text for text in every.findall(f"{space}text")]


def _font() -> SimpleNamespace:
    """A font that draws 者 U+E0101 and U+FE00 with one glyph of its own, and 葛 U+E0100 with another."""
    names = SimpleNamespace(getDebugName={4: "Test Sans", 5: "Version 1.0;built"}.get)
    return SimpleNamespace(cmap={0x8005: "uni8005", 0x845B: "uni845B"}, font={"name": names},
                           variants={(0x8005, 0xFE00): "uniFA5B", (0x8005, 0xE0101): "uniFA5B", (0x8005, 0xE0100): None,
                                     (0x845B, 0xE0100): "glyph1", (0x845B, 0xE0101): None},
                           style=SimpleNamespace(font=compose.Source("Test.ttf", "https://example.invalid/Test.ttf", "0", "none")))


def test_a_sequence_is_written_once_for_each_glyph_its_components_sequences_draw() -> None:
    font = _font()
    # 者 U+FE00 draws the glyph 者 U+E0101 does, and 者 U+E0100 the bare character's: neither is a way of its own.
    assert variants.spellings("⿰氵者", font) == (["⿰氵者", "⿰氵者\U000e0101"], 2)
    assert variants.spellings("⿱葛⿰氵者", font) == (
        ["⿱葛⿰氵者", "⿱葛⿰氵者\U000e0101", "⿱葛\U000e0100⿰氵者", "⿱葛\U000e0100⿰氵者\U000e0101"], 4)
    # A component written with a selector keeps it.
    assert variants.spellings("⿰葛\U000e0101者", font) == (["⿰葛\U000e0101者", "⿰葛\U000e0101者\U000e0101"], 2)


def test_the_ways_to_write_a_sequence_stop_at_the_cap_and_are_counted_in_full() -> None:
    written, total = variants.spellings("⿲者者⿱者⿰者者", _font())
    assert total == 32 and len(written) == variants.COMBINATIONS == 24
    assert written[0] == "⿲者者⿱者⿰者者" and len(set(written)) == 24


def _square(side: float) -> compose.Placed:
    points = np.array([[0, 0], [side, 0], [side, side], [0, side]], float)
    lines = [("moveTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False)]
    part = compose.Part([compose.Contour(lines, points, points)])
    return compose.Placed(part, part.box, part.box, origin=f"glyph {side:g}")


def test_each_way_is_composed_and_labelled_by_the_sequences_it_writes(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(variants, "IVD", _table(tmp_path, "ivd.txt", b"8005 E0101; Adobe-Japan1; CID+13349\n"))
    monkeypatch.setattr(variants, "STANDARDIZED", _table(tmp_path, "sv.txt", b"8005 FE00; CJK COMPATIBILITY IDEOGRAPH-FA5B;\n"))

    def compose_(text: str) -> list[compose.Placed]:
        if "葛\U000e0100" in text and "者\U000e0101" in text:
            raise LookupError("no host")
        # 葛's selector changes nothing here, so the two ways draw one outline.
        return [_square(200 if "者\U000e0101" in text else 100)]

    composer = SimpleNamespace(font=_font(), compose=compose_)
    found, total = variants.composed("⿱葛⿰氵者", composer, tmp_path)
    assert total == 4 and [form.label for form in found] == [
        "⿱葛⿰氵者", "者 Adobe-Japan1 CID+13349", "葛 U+845B U+E0100", "葛 U+845B U+E0100; 者 Adobe-Japan1 CID+13349"]
    assert [form.same_as for form in found] == [None, None, "⿱葛⿰氵者", None]
    assert found[1].parts == ["glyph 200"] and found[1].outline != found[0].outline
    record = found[3].record()
    assert record["outline"] is None and record["note"] == "Not drawn: no host"
    assert record["components"][1] == {"component": "者", "sequence": "者\U000e0101", "codepoints": ["U+8005", "U+E0101"],
                                       "registered": [{"collection": "Adobe-Japan1", "identifier": "CID+13349"}]}
    document = variants.sequence_document("⿱葛⿰氵者", "sans", found, total)
    assert (document["combinations"], document["cap"]) == (4, 24) and document["fonts"][0]["face"] == "Test Sans 1.0"
    root = ET.fromstring(variants.sheet("⿱葛⿰氵者", found, variants.sequence_headings(found[:2], total)))
    texts = [text.text for text in root.findall("{http://www.w3.org/2000/svg}text")]
    assert "Composed in Test Sans 1.0, 2 of 4 combinations" in texts and "= 葛 U+845B U+E0100" in texts and "not drawn" in texts
    assert len(root.findall("{http://www.w3.org/2000/svg}path")) == 2


def _fonts(style: str) -> variants.Fonts:
    absent = variants.missing(style)
    if absent:
        pytest.skip(f"Not on disk: {', '.join(absent)}. `scripts/compose_ids.py variants` fetches all but the Noto CJK collection.")
    try:
        return variants.Fonts.of(style)
    except ValueError as error:
        pytest.skip(str(error))


@pytest.fixture(scope="module")
def sans() -> variants.Fonts:
    return _fonts("sans")


@pytest.fixture(scope="module")
def serif() -> variants.Fonts:
    return _fonts("serif")


def _by_label(found: list[Form]) -> dict[str, Form]:
    assert len({form.label for form in found}) == len(found)
    return {form.label: form for form in found}


def test_the_regional_faces_are_found_by_name_in_the_collections_own_order(sans: variants.Fonts) -> None:
    assert [face.family for face in sans.regional] == [f"Noto Sans CJK {region}" for region in ("JP", "KR", "SC", "TC", "HK")]
    assert {face.version for face in sans.regional} == {"2.004"}


def test_both_adobe_japan1_forms_of_葛_are_drawn_from_noto(sans: variants.Fonts) -> None:
    found, _ = variants.forms("葛", sans)
    forms = _by_label(found)
    old, new = forms["Adobe-Japan1 CID+1481"], forms["Adobe-Japan1 CID+7652"]
    assert (old.sequence, new.sequence) == ("葛\U000e0100", "葛\U000e0101")
    assert old.face.family == new.face.family == "Noto Sans CJK JP"
    assert old.outline and new.outline and variants.same(old.outline) != variants.same(new.outline)
    # The Japanese face draws CID+7652 for the bare character.
    assert old.same_as is None and new.same_as == "Noto Sans CJK JP"


def test_a_moji_joho_sequence_is_drawn_by_the_ipamj_glyph_of_its_number(sans: variants.Fonts) -> None:
    found, _ = variants.forms("葛", sans)
    form = next(form for form in found if form.sequence == "葛\U000e0104")
    assert form.label == "Hanyo-Denshi JTB9D7, Moji_Joho MJ022340"
    assert (form.face.name, form.glyph) == ("IPAmjMincho", "mj022340")
    assert form.record()["registered"] == [{"collection": "Hanyo-Denshi", "identifier": "JTB9D7"},
                                            {"collection": "Moji_Joho", "identifier": "MJ022340"}]


def test_the_compatibility_ideograph_and_the_sequences_of_侮_share_one_noto_glyph(sans: variants.Fonts) -> None:
    found, sources = variants.forms("侮", sans)
    forms = _by_label(found)
    dotted = [forms["Adobe-Japan1 CID+13382"], forms["U+4FAE U+FE00"], forms["U+FA30"]]
    assert [form.kind for form in dotted] == ["ivs", "svs", "compatibility"]
    assert len({form.glyph for form in dotted}) == 1 and len({form.outline for form in dotted}) == 1
    # The Korean face draws that glyph for the bare character, so it comes first.
    assert {form.same_as for form in dotted} == {"Noto Sans CJK KR"}
    assert forms["U+FA30"].sequence == "侮" and forms["U+4FAE U+FE00"].description == "CJK COMPATIBILITY IDEOGRAPH-FA30"
    assert sources["kIRG_JSource"] == "J0-496E"


def test_骨_has_three_regional_designs_in_sans_and_in_serif(sans: variants.Fonts, serif: variants.Fonts) -> None:
    for fonts, family in ((sans, "Noto Sans CJK"), (serif, "Noto Serif CJK")):
        found, _ = variants.forms("骨", fonts)
        regional = {form.label.removeprefix(family + " "): form for form in found if form.kind == "regional"}
        assert list(regional) == ["JP", "KR", "SC", "TC", "HK"]
        assert {region: form.same_as for region, form in regional.items()} == {
            "JP": None, "KR": f"{family} JP", "SC": None, "TC": None, "HK": f"{family} JP"}
        assert len({variants.same(form.outline) for form in regional.values()}) == 3


def test_a_registered_sequence_no_font_maps_is_listed_without_an_outline(sans: variants.Fonts) -> None:
    found, _ = variants.forms("粤", sans)
    record = _by_label(found)["Moji_Joho MJ058288"].record()
    assert record["outline"] is None and record["font"] is None and record["glyph"] is None
    assert record["codepoints"] == ["U+7CA4", "U+E0103"]
    assert record["note"] == "No font on disk maps this sequence."


def test_the_command_writes_the_forms_and_one_sheet(sans: variants.Fonts, tmp_path: Path, capsys) -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import compose_ids

    compose_ids.variants("釁", out=tmp_path, style="sans", every=False)
    summary = json.loads(capsys.readouterr().out)
    document = json.loads((tmp_path / "variants.json").read_text(encoding="utf-8"))
    assert summary["forms"] == len(document["forms"]) == 12 and summary["regional"] == 5 and summary["ivs"] == 7
    assert set(document["forms"][0]) >= {"kind", "label", "sequence", "font", "face", "glyph", "codepoints", "outline"}
    assert {font["sha256"] for font in document["fonts"] if font["file"] == "NotoSansCJK-Regular.ttc"} == {variants.COLLECTIONS["sans"].sha256}
    assert [table["edition"] for table in document["data"]] == ["2026-08-03", "16.0.0", "16.0.0"]
    sheet = ET.fromstring((tmp_path / "variants.svg").read_text(encoding="utf-8"))
    assert len(sheet.findall("{http://www.w3.org/2000/svg}path")) == summary["distinct"] == 10
    with pytest.raises(typer.BadParameter):
        compose_ids.variants("釁", out=tmp_path, style="kaisho", every=False)
    with pytest.raises(typer.BadParameter):
        compose_ids.variants("釁釁", out=tmp_path, style="sans", every=False)


def test_the_command_composes_a_sequence_once_for_each_form_of_者(tmp_path: Path, capsys) -> None:
    from han_compose.vocab import cache_root

    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import compose_ids

    needed = [cache_root() / "fonts" / compose.STYLES["sans"].font.file, compose_ids._layout_path("sans"),
              variants.IVD.path(), variants.STANDARDIZED.path()]
    absent = [path.name for path in needed if not path.exists()]
    if absent:
        pytest.skip(f"Not on disk: {', '.join(absent)}.")
    compose_ids.variants("⿰氵者", out=tmp_path, style="sans", every=False)
    summary = json.loads(capsys.readouterr().out)
    assert (summary["forms"], summary["combinations"], summary["distinct"]) == (2, 2, 2)
    document = json.loads((tmp_path / "variants.json").read_text(encoding="utf-8"))
    plain, dotted = document["forms"]
    assert plain["label"] == "⿰氵者" and dotted["label"] == "者 Adobe-Japan1 CID+13349"
    assert dotted["codepoints"] == ["U+2FF0", "U+6C35", "U+8005", "U+E0101"] and "glyph 者\U000e0101" in dotted["parts"]
    assert plain["outline"] != dotted["outline"]
