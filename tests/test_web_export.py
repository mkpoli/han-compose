from __future__ import annotations

import gzip
import hashlib
import subprocess
import json
from pathlib import Path

import numpy as np
import pytest

from han_compose import compose, compose_layout, web_export
from han_compose.compose import Contour, Part


def test_a_record_and_a_host_list_live_in_the_shard_their_sha256_names() -> None:
    for key in ("亻", "葛\U000e0100", "⿰亻可"):
        h = hashlib.sha256(key.encode()).hexdigest()
        assert web_export.record_shard(key) == f"g/{h[:3]}.json"
        assert web_export.record_work(key) == f".work/g/{h[:2]}/{h}.json"
    h = hashlib.sha256("L\t亻".encode()).hexdigest()
    assert web_export.hosts_shard("L", "亻") == f"p/{h[:3]}.json"
    assert web_export.hosts_work("L", "亻") == f".work/p/{h[:2]}/{h}.json"
    assert web_export.SHARDS == 4096


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

    font = cache_root() / "fonts" / compose.STYLES["sans"].font.file
    layout = cache_root() / "compose" / compose_layout.LAYOUT_FILE
    if not font.exists() or not layout.exists():
        pytest.skip("The font or the layout model is not cached.")
    c = compose.Composer(compose.Font(font, compose.fallback_files()), compose.japanese_sequences())
    c.layout = compose_layout.LayoutModel.load(layout)
    c.kvg = kanjivg_cuts.Cutter(c)
    return c


ONLY = {"亻", "可", "何", "⿰亻可", "王", "𤣩"}
#: Host lists cut in the tests: whole lists are cut, so heavy operands (亻 on the left: 1,860) are left out.
PAIRS = {("L", "可"), ("R", "何"), ("⿵1", "可"), ("L", "王")}


def _wang(composer: compose.Composer) -> str:
    return next(seq for seq, char in sorted(composer.by_sequence.items()) if char == "王")


@pytest.fixture(scope="module")
def exported(composer: compose.Composer, tmp_path_factory) -> tuple[Path, Path, dict]:
    a, b = tmp_path_factory.mktemp("a"), tmp_path_factory.mktemp("b")
    only = ONLY | {_wang(composer)}
    options = dict(joyo=["何", "語", "休", "明"], parity=1, held_out=1, only=only, pairs=PAIRS, log=lambda _: None)
    manifest = web_export.export(composer, a, **options)
    web_export.export(composer, b, **options)
    return a, b, manifest


def _read(out: Path, path: str) -> dict:
    return json.loads(gzip.decompress((out / path).read_bytes()))


def _record(out: Path, key: str) -> dict:
    record = _read(out, web_export.record_shard(key))[web_export.key_hash(key)]
    assert record["k"] == key
    return record


def _hosts(out: Path, place: str, operand: str) -> dict:
    return _read(out, web_export.hosts_shard(place, operand))[web_export.hosts_hash(place, operand)]


def _files(root: Path) -> dict[str, bytes]:
    return {str(p.relative_to(root)): p.read_bytes() for p in sorted(root.rglob("*")) if p.is_file()}


def test_the_export_is_the_same_byte_for_byte_each_time(exported) -> None:
    a, b, _ = exported
    assert _files(a) == _files(b)


def test_the_export_has_a_manifest_a_layout_records_and_host_lists(exported, composer: compose.Composer) -> None:
    out, _, manifest = exported
    assert json.loads((out / "manifest.json").read_text()) == manifest
    assert manifest["format"] == web_export.FORMAT
    assert manifest["version"].endswith(f"-sans-{Path(compose_layout.LAYOUT_FILE).stem}-f{web_export.FORMAT}")
    assert manifest["style"] == "sans" and manifest["constants"]["HEAVY"] == compose.STYLES["sans"].heavy
    assert [f["licence"] for f in manifest["licences"]["outlines"]["fonts"]] == ["SIL OFL 1.1"] * 3
    assert manifest["files"]["licences"] == ["OFL.txt", "MIT-hfhchan-ids.txt"] and not (out / "CC0.txt").exists()
    assert manifest["composer"]["layout_file"] == compose_layout.LAYOUT_FILE
    assert manifest["constants"]["STRETCH"] == compose.STRETCH and manifest["constants"]["HOST_SNAP"] == compose.HOST_SNAP
    assert manifest["constants"]["SHARES"]["⿳,3"] == list(compose.SHARES[("⿳", 3)])
    assert manifest["files"]["records"]["files"] == len(list((out / "g").glob("*.json")))
    assert manifest["files"]["hosts"]["files"] == len(list((out / "p").glob("*.json")))
    assert manifest["pack"]["shards"] == web_export.SHARDS and manifest["pack"]["commit"]
    # Each shard holds exactly the per-key files whose hash starts with its name, keys sorted.
    for folder, kind in (("g", "records"), ("p", "hosts")):
        work = sorted(p.stem for p in (out / ".work" / folder).glob("*/*.json"))
        shards = {}
        for f in sorted((out / folder).glob("*.json")):
            raw = gzip.decompress(f.read_bytes())
            entries = json.loads(raw)
            assert list(entries) == sorted(entries) and all(h.startswith(f.stem) for h in entries)
            assert len(f.stem) == 3 and raw == web_export._dump(entries)
            shards.update(entries)
        assert sorted(shards) == work and manifest["files"][kind]["entries"] == len(work)
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
    listed_places: dict[str, set] = {}
    for f in (out / "p").glob("*.json"):
        for listed in json.loads(gzip.decompress(f.read_bytes())).values():
            listed_places.setdefault(listed["operand"], set()).add(listed["place"])
    for key in ("亻", "可", "何", "王"):
        places = record(key).get("P", [])
        assert places == sorted(places) and set(places) == listed_places.get(key, set())
    assert record("可")["P"] == ["L", "⿵1"]
    # A list holds every index entry, in the index's order, each with its cut or null.
    index, _ = composer._index
    listed = _hosts(out, "L", "可")
    assert listed["place"] == "L" and listed["operand"] == "可"
    hosts = listed["hosts"]
    assert [h["r"] for h in hosts] == list(range(len(index[("L", "可")])))
    for h in hosts:
        char, tree, path, i = index[("L", "可")][h["r"]]
        assert (h["h"], h["i"], h["d"]) == (char, i, len(path)) and {"op", "ok", "si", "v", "j", "c"} <= set(h)
        cut = composer._host_node(char, tree, path)
        assert (h["c"] is None) == (cut is None)
        if cut is not None:
            contours = composer.font.glyph(char).contours
            assert [contours[k] for k in h["c"]["k"]] == cut.pieces[i].contours
            assert h["c"]["b"] == [round(float(v), 2) for v in cut.pieces[i].box]
            assert "p" not in h["c"]
            # The host's glyph is exported, for the port to draw a chosen piece from.
            assert "G" in record(char)
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
    assert manifest["licences"]["outlines"]["texts"] == ["OFL.txt"]
    assert "'Source'" in manifest["licences"]["outlines"]["note"] and "Plangothic declares no Reserved Font Name" in manifest["licences"]["outlines"]["note"]
    assert "Henry Chan" in (out / "MIT-hfhchan-ids.txt").read_text()
    covered = {field for source in manifest["licences"]["sources"] for field in source["fields"]}
    assert {"s", "e", "a", "at", "hand", "p/ hosts[].c.kv", "p/ hosts[].hd"} <= covered
    assert set(manifest["files"]["licences"]) == {"OFL.txt", "MIT-hfhchan-ids.txt"}


def test_a_serif_export_names_its_style_and_ships_each_fonts_licence(tmp_path) -> None:
    from han_compose import kanjivg_cuts
    from han_compose.vocab import cache_root

    style = compose.STYLES["serif"]
    layout = cache_root() / "compose" / compose_layout.layout_file("serif")
    if not layout.exists() or not all((cache_root() / "fonts" / s.file).exists() for s in (style.font, *style.fallbacks)):
        pytest.skip("The serif fonts or the serif layout model are not cached.")
    c = compose.Composer(compose.Font.of("serif"), compose.japanese_sequences())
    c.layout = compose_layout.LayoutModel.load(layout)
    c.kvg = kanjivg_cuts.Cutter(c)
    manifest = web_export.export(c, tmp_path, only={"亻", "可", "何", "⿰亻可"}, pairs={("L", "可")}, log=lambda _: None)
    assert manifest["style"] == "serif" and manifest["composer"]["layout_file"] == "compose-layout-v4-serif.npz"
    assert "-serif-compose-layout-v4-serif-f" in manifest["version"]
    assert set(manifest["composer"]["font_sha256"]) == {s.file for s in (style.font, *style.fallbacks)}
    assert manifest["files"]["licences"] == ["OFL.txt", "CC0.txt", "MIT-hfhchan-ids.txt"]
    assert "Noto Serif CJK JP" in (tmp_path / "OFL.txt").read_text() and "Jigmo" not in (tmp_path / "OFL.txt").read_text()
    assert "CC0 1.0 Universal" in (tmp_path / "CC0.txt").read_text() and "Jigmo" in (tmp_path / "CC0.txt").read_text()
    assert manifest["constants"]["GROW_Y"] > 0 and manifest["constants"]["STEM_CURVE"] == [list(v) for v in style.stem_curve]


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
    stats = manifest["files"]["parity"]["held_out"]["stats"]
    assert "hosts_in_export" in stats and "hosts_same_piece" in stats and stats["hosts_same_piece"] <= stats["hosts_in_export"]


def test_an_export_without_parity_removes_stale_parity_files(composer: compose.Composer, tmp_path: Path) -> None:
    (tmp_path / "parity.json").write_text("{}")
    (tmp_path / "parity-held-out.json").write_text("{}")
    web_export.export(composer, tmp_path, only={"王"}, pairs={("L", "王")}, log=lambda _: None)
    assert not (tmp_path / "parity.json").exists() and not (tmp_path / "parity-held-out.json").exists()


def test_a_rerun_of_the_same_version_keeps_the_files_a_stopped_run_wrote(composer: compose.Composer, tmp_path: Path) -> None:
    out, root = tmp_path / "out", tmp_path / "checkout"
    root.mkdir()
    # A commit to resume from: an unknown one never resumes.
    for args in (["init", "-q"], ["-c", "user.email=a@b", "-c", "user.name=a", "commit", "-q", "--allow-empty", "-m", "x"]):
        subprocess.run(["git", "-C", str(root), *args], check=True)
    options = dict(only={"王"}, pairs={("L", "王")}, root=root, log=lambda _: None)
    web_export.export(composer, out, **options)
    assert (out / ".complete").exists()
    before = _files(out)
    kept, lost = out / web_export.hosts_work("L", "王"), out / web_export.record_work("王")
    kept.write_bytes(gzip.compress(b'{"place":"L","operand":"\\u738b","hosts":[]}', mtime=0))
    lost.write_bytes(lost.read_bytes()[:20])  # truncated: read as missing
    web_export.export(composer, out, **options)
    after = _files(out)
    assert after[str(lost.relative_to(out))] == before[str(lost.relative_to(out))]
    assert after[web_export.record_shard("王")] == before[web_export.record_shard("王")]
    # The kept work file is what the rebuilt shard holds.
    assert _hosts(out, "L", "王")["hosts"] == []
    # Another key set starts afresh, and so does an unknown commit.
    web_export.export(composer, out, **{**options, "only": {"王", "可"}})
    assert _hosts(out, "L", "王")["hosts"]
    kept.write_bytes(gzip.compress(b'{"place":"L","operand":"\\u738b","hosts":[]}', mtime=0))
    web_export.export(composer, out, **{**options, "root": tmp_path / "not-a-checkout"})
    assert _hosts(out, "L", "王")["hosts"]


def _as_format_4(out: Path) -> None:
    """Turn a fresh export into what a format-4 one left once its per-key files are under `.work/`:
    no shards, a format-4 manifest with that format's file scheme and per-file sizes, and the
    version below pack's in the manifest, parity files and stamp."""
    import shutil

    old = lambda version: version[: -len(f"-f{web_export.FORMAT}")] + "-f4"
    shutil.rmtree(out / "g")
    shutil.rmtree(out / "p")
    (out / "p").mkdir()
    (out / "p" / "fff.json").write_bytes(b"stale")  # pack replaces each folder whole
    manifest = json.loads((out / "manifest.json").read_text())
    manifest["version"], manifest["format"] = old(manifest["version"]), 4
    manifest["paths"] = {
        "records": "g/{hh}/{sha256 hex of the key's UTF-8}.json: a character (with any variation selector) or a whole sequence",
        "hosts": "p/{hh}/{sha256 hex of UTF-8 place + TAB + operand}.json: the host list of an operand (a character or a whole sequence) in a place",
        "hh": "the hash's first two hex digits",
        "encoding": "every file under g/ and p/ is gzip-compressed JSON (mtime 0); serve it with Content-Encoding: gzip or decompress it",
        "missing": "a key or (place, operand) with no file has no record or no host the composer cuts cleanly",
        "rerun": ".export names the version, the layout, font and KanjiVG hashes, the key set and the parity sizes that wrote the folder; a rerun with the same, from a known clean commit, keeps g/ and p/ files and writes only the missing ones; anything else starts afresh. .complete is written last, after manifest.json",
    }
    manifest["record"] = {**manifest["record"], "hosts": "a p/ file: {place, operand, hosts}"}
    del manifest["pack"]
    for kind, folder in (("records", "g"), ("hosts", "p")):
        pairs = [(len(gzip.decompress(path.read_bytes())), path.stat().st_size)
                 for path in (out / ".work" / folder).glob("*/*.json")]
        kept = {k: v for k, v in manifest["files"][kind].items() if k in ("entries_cut", "pieces_with_own_outlines")}
        manifest["files"][kind] = {**web_export._summary(pairs), **kept}
    (out / "manifest.json").write_text(json.dumps(manifest))
    for name in ("parity.json", "parity-held-out.json", ".export"):
        value = json.loads((out / name).read_text())
        value["version"] = old(value["version"])
        (out / name).write_text(json.dumps(value))


def test_pack_brings_a_format_4_folder_whose_files_are_under_work_to_a_fresh_export(exported, tmp_path: Path) -> None:
    import shutil

    a, _, manifest = exported
    out = tmp_path / "out"
    shutil.copytree(a, out)
    _as_format_4(out)
    packed = web_export.pack(out, log=lambda _: None)
    assert packed == manifest and "--exclude '.work/**'" in packed["paths"]["work"]
    fresh, migrated = _files(a), _files(out)
    assert migrated == fresh
    for name in ("manifest.json", "parity.json", "parity-held-out.json", ".export"):
        assert migrated[name] == fresh[name]
    assert json.loads(migrated["parity.json"])["version"] == manifest["version"] == json.loads(migrated[".export"])["version"]


@pytest.mark.parametrize("damage", [b"\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\x03\xff\xff\xff\xff", None],
                         ids=["corrupt", "truncated"])
def test_pack_names_an_unreadable_work_file_and_keeps_the_shards(exported, tmp_path: Path, damage) -> None:
    import shutil

    a, _, _ = exported
    out = tmp_path / "out"
    shutil.copytree(a, out)
    bad = sorted((out / ".work" / "p").glob("*/*.json"))[0]
    bad.write_bytes(damage if damage is not None else bad.read_bytes()[:20])
    with pytest.raises(web_export.WorkFileError, match=bad.name):
        web_export.pack(out, log=lambda _: None)
    assert {k: v for k, v in _files(out).items() if k[0] in "gp"} == {k: v for k, v in _files(a).items() if k[0] in "gp"}
