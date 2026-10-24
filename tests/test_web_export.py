from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest

from han_compose import compose, compose_layout, web_export
from han_compose.compose import Contour, Part


def test_a_record_and_a_host_list_live_where_their_sha256_names() -> None:
    for key in ("亻", "葛\U000e0100", "⿰亻可"):
        h = hashlib.sha256(key.encode()).hexdigest()
        assert web_export.record_path(key) == f"g/{h[:2]}/{h}.json"
    h = hashlib.sha256("L\t亻".encode()).hexdigest()
    assert web_export.hosts_path("L", "亻") == f"p/{h[:2]}/{h}.json"


def test_outlines_survive_the_round_trip_within_a_quarter_unit() -> None:
    light = np.array([[0.3, -80.6], [500.25, -80.6], [500.25, 820.1], [0.3, 820.1]])
    heavy = light + np.array([[-12.4, -9.1], [12.4, -9.1], [12.4, 9.1], [-12.4, 9.1]])
    curve = np.array([[100.0, 100.0], [200.0, 300.0], [300.0, 100.0]])
    part = Part([Contour([("moveTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False)], light, heavy),
                 Contour([("qCurveTo", 3, True)], curve, curve.copy())])
    record = web_export.part_record(part)
    assert [ops for ops, _, _ in record["p"]] == ["MLLL", "Q3*"]
    assert record["b"] == [0.3, -80.6, 500.25, 820.1] and "w" not in record
    alone = web_export.part_record(Part([Contour([("qCurveTo", 3, True)], curve, curve.copy(), width=(80.0, 75.0))]))
    assert alone["w"] == [80.0, 75.0]
    back = web_export.decode_part(json.loads(json.dumps(record)))
    for (_, lo, hi), contour in zip(back, part.contours):
        assert np.abs(lo - contour.light).max() <= 0.5 / web_export.QUANT
        assert np.abs(hi - contour.heavy).max() <= 1 / web_export.QUANT


def test_quantized_networks_predict_what_the_model_does() -> None:
    rng = np.random.default_rng(0)
    runs = [[rng.normal(0, 0.1, (12, 16)), rng.normal(0, 0.1, 16), rng.normal(0, 0.1, (16, 8)), rng.normal(0, 0.1, 8)]
            for _ in range(3)]
    x = rng.normal(0, 1, (5, 12))
    exact = web_export.predict(runs, x)
    for dtype, tolerance in (("float16", 0.5), ("int8", 5.0)):
        record = {"seeds": [[web_export._quantize(a, dtype) if a.ndim == 2 else web_export._b64(a.astype(np.float32)) for a in run]
                            for run in runs]}
        assert np.abs(web_export.predict(web_export.layout_runs(json.loads(json.dumps(record))), x) - exact).max() < tolerance


def test_an_outline_outside_int16_is_refused() -> None:
    far = np.array([[0.0, 0.0], [9000.0, 0.0], [9000.0, 10.0]])
    with pytest.raises(ValueError):
        web_export.part_record(Part([Contour([("moveTo", 1, False), ("lineTo", 1, False), ("lineTo", 1, False)], far, far)]))


def test_without_checks_the_layout_is_never_int8() -> None:
    from types import SimpleNamespace

    rng = np.random.default_rng(1)
    runs = [[rng.normal(0, 0.1, (4, 8)), rng.normal(0, 0.1, 8)]]
    table = compose_layout.Table({}, {}, {}, {"L": np.zeros(4)})
    fake = SimpleNamespace(layout=SimpleNamespace(weights={"all": runs}, tables={"all": table}))
    assert web_export.layout_record(fake, [])["dtype"] == "float16"


@pytest.fixture(scope="module")
def composer() -> compose.Composer:
    from han_compose import kanjivg_cuts
    from han_compose.vocab import cache_root

    font = cache_root() / "fonts" / compose.FONT_FILE
    layout = cache_root() / "compose" / compose_layout.LAYOUT_FILE
    if not font.exists() or not layout.exists():
        pytest.skip("The font or the layout model is not cached.")
    c = compose.Composer(compose.Font(font, compose.fallback_files()), compose.japanese_sequences())
    c.layout = compose_layout.LayoutModel.load(layout)
    c.kvg = kanjivg_cuts.Cutter(c)
    return c


ONLY = {"亻", "可", "何", "⿰亻可", "王", "𤣩"}


def _wang(composer: compose.Composer) -> str:
    return next(seq for seq, char in sorted(composer.by_sequence.items()) if char == "王")


@pytest.fixture(scope="module")
def exported(composer: compose.Composer, tmp_path_factory) -> tuple[Path, Path, dict]:
    a, b = tmp_path_factory.mktemp("a"), tmp_path_factory.mktemp("b")
    only = ONLY | {_wang(composer)}
    options = dict(joyo=["何", "語", "休", "明"], parity=1, held_out=1, only=only, log=lambda _: None)
    manifest = web_export.export(composer, a, **options)
    web_export.export(composer, b, **options)
    return a, b, manifest


def _read(out: Path, path: str) -> dict:
    return json.loads(gzip.decompress((out / path).read_bytes()))


def _record(out: Path, key: str) -> dict:
    record = _read(out, web_export.record_path(key))
    assert record["k"] == key
    return record


def _files(root: Path) -> dict[str, bytes]:
    return {str(p.relative_to(root)): p.read_bytes() for p in sorted(root.rglob("*")) if p.is_file()}


def test_the_export_is_the_same_byte_for_byte_each_time(exported) -> None:
    a, b, _ = exported
    assert _files(a) == _files(b)


def test_the_export_has_a_manifest_a_layout_records_and_host_lists(exported, composer: compose.Composer) -> None:
    out, _, manifest = exported
    assert json.loads((out / "manifest.json").read_text()) == manifest
    assert manifest["format"] == web_export.FORMAT
    assert manifest["version"].endswith(f"-{Path(compose_layout.LAYOUT_FILE).stem}-f{web_export.FORMAT}")
    assert manifest["composer"]["layout_file"] == compose_layout.LAYOUT_FILE
    assert manifest["constants"]["STRETCH"] == compose.STRETCH and manifest["constants"]["HOST_SNAP"] == compose.HOST_SNAP
    assert manifest["constants"]["SHARES"]["⿳,3"] == list(compose.SHARES[("⿳", 3)])
    assert manifest["files"]["records"]["files"] == len(list((out / "g").rglob("*.json")))
    assert manifest["files"]["hosts"]["files"] == len(list((out / "p").rglob("*.json")))
    layout = json.loads((out / "layout.json").read_text())
    assert layout["dtype"] in web_export.LAYOUT_DTYPES and len(layout["seeds"]) == compose_layout.SEEDS
    assert layout["features"]["per_input"] == layout["seeds"][0][0]["shape"][0]

    record = lambda key: _record(out, key)
    assert record("⿰亻可")["e"] == "何"
    ren = record("亻")
    glyph = composer.font.glyph("亻")
    (_, light, heavy), = web_export.decode_part(ren["G"])[:1]
    assert np.abs(light - glyph.contours[0].light).max() <= 0.5 / web_export.QUANT
    assert np.abs(heavy - glyph.contours[0].heavy).max() <= 1 / web_export.QUANT
    # P names exactly the places with a host list for the key.
    for key in ("亻", "可", "⿰亻可"):
        places = record(key).get("P", [])
        assert places == sorted(places)
        listed_places = {json.loads(gzip.decompress(f.read_bytes()))["place"] for f in (out / "p").rglob("*.json")
                         if json.loads(gzip.decompress(f.read_bytes()))["operand"] == key}
        assert set(places) == listed_places
    assert "L" in record("亻")["P"]
    listed = _read(out, web_export.hosts_path("L", "亻"))
    assert listed["place"] == "L" and listed["operand"] == "亻"
    hosts = listed["hosts"]
    assert all(h["op"] in compose.AXIS or h["op"] in compose.ENCLOSE for h in hosts)
    # Every entry _ranked may weigh, in _prior's order; the first KIN_HOSTS in the index's order among them.
    order = [(not h["v"], not h["j"], h["d"], h["r"]) for h in hosts]
    assert order == sorted(order) and len({h["r"] for h in hosts}) == len(hosts)
    ranks = {h["r"] for h in hosts}
    wanted = [r for r, _ in web_export.candidates(composer, "L", "亻")]
    assert ranks <= set(wanted) and len(hosts) > 2 * web_export.CANDIDATES // 2
    index, _ = composer._index
    for h in hosts:
        assert index[("L", "亻")][h["r"]][0] == h["h"]
    # The layout read back from its record lays out 何 as the model does.
    table = composer.layout.tables["all"]
    x = [1.0 if op == "⿰" else 0.0 for op in compose_layout.OPS]
    for i, kid in enumerate(("亻", "可")):
        r = record(kid)
        mean, spread, n = r["u"]["L" if i == 0 else "R"]
        x += [*(np.array(mean) / 1000), *(np.array(spread) / 100), np.log1p(n) / 5, np.log1p(r["o"]) / 3, *r["f"]]
    got = web_export.predict(web_export.layout_runs(layout), np.array(x))
    want = np.array([v for box in composer.layout.predict(composer, "⿰", ["亻", "可"]) for v in box])
    assert np.abs(got - want).max() < 2.0
    assert table.counts[("L", "亻")] == record("亻")["u"]["L"][2]


def test_the_manifest_carries_every_licence_notice(exported) -> None:
    _, _, manifest = exported
    licences = manifest["licences"]
    assert licences["code"]["licence"] == "MIT"
    fonts = licences["outlines"]["fonts"]
    assert licences["outlines"]["licence"] == "SIL OFL 1.1" and all(f["licence"] == "SIL OFL 1.1" for f in fonts)
    assert fonts[0]["name"] == "Noto Sans CJK JP" and "Adobe" in fonts[0]["copyright"]
    assert {f["name"] for f in fonts[1:]} == {"Plangothic P1", "Plangothic P2"} and all(f["copyright"] for f in fonts[1:])
    assert licences["cuts"]["licence"] == "CC BY-SA 3.0" and "Ulrich Apel" in licences["cuts"]["attribution"]


def test_a_sequence_a_character_draws_carries_what_the_layout_reads_and_its_character_its_glyph(
        exported, composer: compose.Composer) -> None:
    out, _, _ = exported
    seq, char = _record(out, "⿰亻可"), _record(out, "何")
    assert seq["e"] == "何" and "G" in char and char["s"] == "⿰亻可"
    # The layout reads a sequence through the character it describes; its ink sums its operands.
    assert seq["o"] == compose_layout.outlines(composer, "⿰亻可") == char["o"]
    assert seq["f"] == char["f"] and any(seq["f"])
    assert seq["ink"] == round(composer.ink(compose.parse("⿰亻可")), 1)
    wang = _wang(composer)
    assert _record(out, wang)["e"] == "王" and "𤣩" in _record(out, "王")["a"]["L"] and "G" in _record(out, "王")


def test_the_licence_texts_and_every_source_ship_with_the_export(exported) -> None:
    out, _, manifest = exported
    ofl = (out / "OFL.txt").read_text()
    assert "SIL OPEN FONT LICENSE Version 1.1" in ofl and "PERMISSION & CONDITIONS" in ofl
    for font in manifest["licences"]["outlines"]["fonts"]:
        assert font["copyright"] in ofl
    assert manifest["licences"]["outlines"]["text"] == "OFL.txt"
    assert "'Source'" in manifest["licences"]["outlines"]["note"] and "Plangothic declares no Reserved Font Name" in manifest["licences"]["outlines"]["note"]
    assert "Henry Chan" in (out / "MIT-hfhchan-ids.txt").read_text()
    covered = {field for source in manifest["licences"]["sources"] for field in source["fields"]}
    assert {"s", "e", "a", "at", "hand", "x.kv"} <= covered
    assert set(manifest["files"]["licences"]) == {"OFL.txt", "MIT-hfhchan-ids.txt"}


def test_parity_sets_are_written_apart_and_only_the_injected_one_joins_the_export(exported) -> None:
    out, _, manifest = exported
    injected = json.loads((out / "parity.json").read_text())
    held = json.loads((out / "parity-held-out.json").read_text())
    assert injected["set"] == "injected" and held["set"] == "held_out"
    assert {r["c"] for r in injected["rows"]}.isdisjoint(r["c"] for r in held["rows"])
    for row in injected["rows"] + held["rows"]:
        assert len(row["face"]) == 4 and row["c"] in row["x"]
    assert manifest["files"]["parity"]["held_out"]["hosts_injected"] is False
    assert set(manifest["not_exported"]) >= {"_template", "_transplant", "_kin_outer", "_upper", "_overlays(None)"}
    assert "hosts_in_export" in manifest["files"]["parity"]["held_out"]["stats"]


def test_an_export_without_parity_removes_stale_parity_files(composer: compose.Composer, tmp_path: Path) -> None:
    (tmp_path / "parity.json").write_text("{}")
    (tmp_path / "parity-held-out.json").write_text("{}")
    web_export.export(composer, tmp_path, only={"亻"}, log=lambda _: None)
    assert not (tmp_path / "parity.json").exists() and not (tmp_path / "parity-held-out.json").exists()


def test_a_rerun_of_the_same_version_keeps_the_files_a_stopped_run_wrote(composer: compose.Composer, tmp_path: Path) -> None:
    out, root = tmp_path / "out", tmp_path / "not-a-checkout"
    root.mkdir()
    web_export.export(composer, out, only={"亻"}, root=root, log=lambda _: None)
    before = _files(out)
    kept, lost = out / web_export.hosts_path("L", "亻"), out / web_export.record_path("亻")
    kept.write_bytes(gzip.compress(b'{"place":"L","operand":"\\u4ebb","hosts":[]}', mtime=0))
    lost.unlink()
    web_export.export(composer, out, only={"亻"}, root=root, log=lambda _: None)
    after = _files(out)
    assert after[str(lost.relative_to(out))] == before[str(lost.relative_to(out))]
    assert json.loads(gzip.decompress(kept.read_bytes()))["hosts"] == []
    # Another version, or another key set, starts afresh.
    web_export.export(composer, out, only={"亻", "可"}, root=root, log=lambda _: None)
    assert json.loads(gzip.decompress(kept.read_bytes()))["hosts"]
