"""Draw characters from their Ideographic Description Sequences, and measure how well that works.

    uv run scripts/compose_ids.py draw ⿰亻哥 > 亻哥.svg
    uv run scripts/compose_ids.py bench                 # every compound jōyō kanji
    uv run scripts/compose_ids.py bench --chars all --sample 400
    uv run scripts/compose_ids.py calibrate
    uv run --extra detector scripts/compose_ids.py learn

`draw` writes one SVG. `bench` redraws encoded characters from their own sequences with nothing
taken from the character itself, and scores each against the font's real glyph: the overlap of
their ink (intersection over union, at 96 px; mean and tenth percentile), how many come out with
their outline length within 15% of the real glyph's, and the ratio of their stroke widths (at
400 px). Characters that cannot be drawn are counted and listed. It reports the composer beside the
plainest way to compose, each operand's own glyph squeezed into its share, each scored on its own.
`calibrate` fits the style's `stem_curve`, stroke width against density, on the font's own ideographs.
Every command takes `--style sans` (the default), `--style serif`, `--style kaisho` or `--style fangsong`; models are cached per style.
`learn` trains the layout `compose_layout` describes and caches it, for `draw` and `bench` to use.
`export-web` writes the layout and the drawing data a browser port of the composer reads, and
`export-web-pack` builds a finished export's shards from its per-key files.
"""

from __future__ import annotations

import gc
import json
import multiprocessing as mp
import os
import random
import sys
import time
from pathlib import Path

import numpy as np
import typer

from han_compose import compose, compose_layout, compose_standalone, kanjivg_cuts, web_export
from han_compose.vocab import ROOT, cache_root

app = typer.Typer(add_completion=False)


#: The design drawn in: `sans` (Noto Sans CJK JP), `serif` (Noto Serif CJK JP), `kaisho` (Kureedo) or `fangsong` (Zhuque Fangsong), `compose.STYLES`.
STYLE = typer.Option(compose.DEFAULT_STYLE, "--style", help="sans, serif, kaisho or fangsong")


def _style(style: str) -> str:
    if style not in compose.STYLES:
        raise typer.BadParameter(f"{style!r} is not one of {', '.join(compose.STYLES)}.")
    return style


def _layout_path(style: str = compose.DEFAULT_STYLE):
    # COMPOSE_LAYOUT names another model file, to train or test one beside the cached model.
    if os.environ.get("COMPOSE_LAYOUT"):
        return Path(os.environ["COMPOSE_LAYOUT"])
    return cache_root() / "compose" / compose_layout.layout_file(style)


def _standalone_path(style: str = compose.DEFAULT_STYLE):
    return cache_root() / "compose" / compose.styled(compose_standalone.STANDALONE_FILE, style)


def _composer(style: str = compose.DEFAULT_STYLE, **options) -> compose.Composer:
    """The composer in `style`, cutting hosts along KanjiVG's groups, with the learned layout and
    standalone model when `learn` and `learn-alone` have made them."""
    composer = compose.Composer(compose.Font.of(_style(style)), compose.japanese_sequences(),
                                weighted=compose.STYLES[style].weighted, **options)
    if _layout_path(style).exists():
        composer.layout = compose_layout.LayoutModel.load(_layout_path(style))
    composer.kvg = kanjivg_cuts.Cutter(composer)
    if os.environ.get("COMPOSE_GUIDE"):
        # A folder of guide networks (`compose_guide`): the last pass nudges strokes toward their ink.
        from han_compose import compose_guide

        composer.guide = compose_guide.Guide.load(Path(os.environ["COMPOSE_GUIDE"]))
    alone = _standalone_path(style)
    if alone.exists():
        composer.standalone = compose_standalone.StandaloneModel.load(alone)
    return composer


@app.command()
def draw(sequence: str, style: str = STYLE) -> None:
    """Print the SVG of one sequence."""
    path = compose.svg_path(_composer(style).compose(sequence))
    print(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {compose.EM} {compose.EM}"><path d="{path}"/></svg>')


@app.command("draw-many")
def draw_many(sequences: Path, out: Path, style: str = STYLE) -> None:
    """Draw every sequence in a file (one a line) into `out` as `<sha256 of its NFC form>.svg`, the
    name a site stores a drawing under. A sequence that cannot be drawn is listed and skipped."""
    import hashlib
    import unicodedata

    composer = _composer(style)
    out.mkdir(parents=True, exist_ok=True)
    for line in sequences.read_text(encoding="utf-8").splitlines():
        sequence = unicodedata.normalize("NFC", line.strip())
        if not sequence:
            continue
        try:
            path = compose.svg_path(composer.compose(sequence))
        except (LookupError, ValueError) as error:
            print(f"{sequence}\tnot drawn: {error}")
            continue
        name = hashlib.sha256(sequence.encode()).hexdigest() + ".svg"
        (out / name).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {compose.EM} {compose.EM}"><path d="{path}"/></svg>', encoding="utf-8")
        print(f"{sequence}\t{name}")


UNIHAN_URL = "https://www.unicode.org/Public/16.0.0/ucd/Unihan.zip"
UNIHAN_SHA256 = "b8f000df69de7828d21326a2ffea462b04bc7560022989f7cc704f10521ef3e0"


def joyo() -> list[str]:
    """The jōyō kanji, by Unihan 16.0's kJoyoKanji, fetched once into `<cache>/ucd/unihan/`."""
    import hashlib
    import io
    import zipfile

    import httpx

    from han_compose.vocab import cache_root

    path = cache_root() / "ucd" / "unihan" / "Unihan-16.0.0.zip"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(httpx.get(UNIHAN_URL, follow_redirects=True, timeout=300).content)
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != UNIHAN_SHA256:
        raise ValueError(f"{path} does not match its pinned SHA-256.")
    text = zipfile.ZipFile(io.BytesIO(data)).read("Unihan_OtherMappings.txt").decode()
    return [chr(int(line.split("\t")[0].removeprefix("U+"), 16)) for line in text.splitlines() if "\tkJoyoKanji\t" in line]


#: Set before the bench's workers fork: the composers and the raster sizes they measure at.
_BENCH: dict = {}


def _bench_sets() -> dict[str, str]:
    """The benchmark's characters by set (`data/bench/sets.json`; `data/README.md` says how they were chosen)."""
    data = json.loads((ROOT / "data" / "bench" / "sets.json").read_text(encoding="utf-8"))
    return {name: data[name] for name in ("tracking", "hard")}


def _aligned_overlap(placed: list[compose.Placed], real: list[compose.Placed], size: int) -> float:
    """Overlap with each drawing's ink stretched to fill the raster: the shape, wherever it stands."""
    def mask(items: list[compose.Placed]) -> np.ndarray:
        parts = [compose._rings(item.part.contours, item.contours()) for item in items]
        points = np.concatenate([ring for rings in parts for ring in rings])
        box = (*map(float, points.min(axis=0)), *map(float, points.max(axis=0)))
        # Each part filled apart and joined, as `compose.raster` does: parts overlap.
        return np.logical_or.reduce([compose.fill(rings, size, box) for rings in parts])
    a, b = mask(placed), mask(real)
    return float((a & b).sum()) / max(float((a | b).sum()), 1.0)


def _bench_one(item: tuple[str, str]) -> dict:
    """One character redrawn by the composer and the plain way, with its scores."""
    char, seq = item
    composer, plain, size = _BENCH["composer"], _BENCH["plain"], _BENCH["size"]
    unit = compose.EM / 400
    glyph = composer.font.glyph(char)
    real = [compose.Placed(glyph, glyph.box, glyph.box)]
    truth = compose.raster(real, size)
    row: dict = {"char": char}
    for name, drawer in (("composer", composer), ("plain", plain)):
        drawer.exclude = {char}
        try:
            placed = drawer.compose(seq)
        except LookupError:
            continue
        mask = compose.raster(placed, size)
        row[name] = float((mask & truth).sum()) / max(float((mask | truth).sum()), 1.0)
        if name == "composer":
            row["aligned"] = _aligned_overlap(placed, real, size)
            made = sum(drawer.ink("", p.part) * (p.scale[0] + p.scale[1]) / 2 for p in placed)
            row["outline"] = made / drawer.ink("", glyph)
            drawn = compose.stems(compose.raster(placed, 400), unit)
            true = compose.stems(compose.raster(real, 400), unit)
            row["widths"] = (drawn[0] / true[0], drawn[1] / true[1])
    composer.exclude = plain.exclude = set()
    return row


def _bench_summary(rows: list[dict]) -> dict:
    """What a set of `_bench_one` rows scored."""
    composed = [r for r in rows if "composer" in r]
    failed = "".join(r["char"] for r in rows if "composer" not in r)
    if not composed:
        return {"characters": len(rows), "drawn": 0, "failed_characters": failed}
    overlap, aligned = (np.array([r[k] for r in composed]) for k in ("composer", "aligned"))
    ratio = np.array([r["outline"] for r in composed])
    widths = np.array([r["widths"] for r in composed])
    plain = np.array([r["plain"] for r in rows if "plain" in r])
    return {"characters": len(rows), "drawn": len(composed), "failed_characters": failed,
            "overlap_mean": round(float(overlap.mean()), 3), "overlap_p10": round(float(np.quantile(overlap, 0.1)), 3),
            "aligned_mean": round(float(aligned.mean()), 3), "aligned_p10": round(float(np.quantile(aligned, 0.1)), 3),
            "outline_within_15pct": round(float(((ratio > 0.85) & (ratio < 1.15)).mean()), 3),
            "stroke_width_ratio": [round(float(np.nanmedian(widths[:, axis])), 3) for axis in (0, 1)],
            "plain_overlap_mean": round(float(plain.mean()), 3)}


@app.command()
def bench(chars: str = "benchmark", sample: int = 0, seed: int = 3, size: int = 96, reuse: bool = True,
          workers: int = 4, style: str = STYLE) -> None:
    """Redraw encoded kanji from their own sequences with nothing taken from them, against their glyphs.

    `chars` is "benchmark" (the tracking and hard sets, each scored apart), "joyo" (every jōyō kanji
    with a compound sequence) or "all" (every kanji the main font draws with one); `sample` draws that
    many at random from it, 0 takes them all. Overlap compares the drawings where they stand; aligned
    overlap stretches each to fill the raster first, so it scores the shape alone.
    `--no-reuse` composes every character from its parts, as a sequence no character draws whole
    would be, instead of first taking it whole from where others draw it.
    """
    composer = _composer(style, reuse=reuse)
    sets = _bench_sets() if chars == "benchmark" else {}
    names = "".join(sets.values()) if sets else joyo() if chars == "joyo" else sorted(composer.sequences)
    pool = []
    for char in names:
        seq = composer.sequences.get(char)
        if seq is None or not composer.font.own(char):
            continue
        try:
            tree = compose.parse(seq)
        except ValueError:
            continue
        if isinstance(tree, tuple) and (tree[0] in compose.AXIS or tree[0] in compose.ENCLOSE):
            pool.append((char, seq))
    chosen = random.Random(seed).sample(pool, sample) if sample else pool
    plain = compose.Composer(composer.font, composer.sequences, hosted=False, weighted=False)
    _BENCH.update(composer=composer, plain=plain, size=size)
    web_export._load_font_caches(composer)
    gc.collect()
    gc.freeze()
    pool_ = mp.get_context("fork").Pool(workers, maxtasksperchild=64) if workers > 1 else None
    rows = []
    started = time.monotonic()
    for done, row in enumerate(pool_.imap_unordered(_bench_one, chosen) if pool_ else map(_bench_one, chosen), 1):
        rows.append(row)
        if done % 25 == 0 or done == len(chosen):
            elapsed = time.monotonic() - started
            print(f"{done}/{len(chosen)}, {elapsed / 60:.1f} min, about {elapsed / done * (len(chosen) - done) / 60:.1f} min left",
                  file=sys.stderr, flush=True)
    if pool_:
        pool_.close()
        pool_.join()
    gc.unfreeze()
    report: dict = {"style": style, "set": chars, "composer": _bench_summary(rows)}
    for name, members in sets.items():
        held = [r for r in rows if r["char"] in members]
        if held:
            report[name] = _bench_summary(held)
    print(json.dumps(report, ensure_ascii=False))


@app.command()
def learn(rows: str = "", workers: int = 3, style: str = STYLE) -> None:
    """Learn where a whole character's two operands go, from every character that cuts cleanly
    (needs PyTorch). `rows` reuses examples saved by an earlier run, one JSON object per line."""
    composer = _composer(style)
    composer.layout = None
    if rows:
        with open(rows) as lines:
            examples = [json.loads(line) for line in lines]
        examples = [r for r in examples if r["op"] in compose_layout.OPS and len(r["kids"]) == 2]
    else:
        examples = compose_layout.examples(composer, workers)
    model = compose_layout.train(composer, examples)
    path = _layout_path(style)
    path.parent.mkdir(parents=True, exist_ok=True)
    model.save(path)
    print(json.dumps({"examples": len(examples), "model": str(path)}))


@app.command()
def learn_alone(records: str = "", workers: int = 3, style: str = STYLE) -> None:
    """Fit where a character stands alone from where others draw it (`compose_standalone`).
    `records` reuses instances saved by an earlier run, one JSON list."""
    composer = _composer(style)
    rows = json.loads(Path(records).read_text()) if records else compose_standalone.records(composer, workers)
    model = compose_standalone.StandaloneModel.fit([r for r in rows if r["inst"]])
    path = _standalone_path(style)
    path.parent.mkdir(parents=True, exist_ok=True)
    model.save(path)
    print(json.dumps({"characters": len(model.rows), "places": len(model.sums), "model": str(path)}))


@app.command("export-web")
def export_web(out: Path, parity: int = 0, held_out: int = 0, workers: int = 1, style: str = STYLE,
               add: str = "", dry_run: bool = False) -> None:
    """Write what a browser port of the composer needs into `out` (`han_compose.web_export`):
    manifest, layout, and the records and host lists packed into shards by hash. `--parity N` also draws N compound jōyō
    kanji sequences with this composer into `out/parity.json`, whose hosts join the export, and
    `--held-out M` M more into `out/parity-held-out.json`, whose hosts do not.

    `--add letters` instead writes records for every letter and digit the fonts draw
    (`web_export.letters`) into the finished export in `out`, for `export-web-pack` to rebuild only
    the shards they fall in; `--dry-run` reports how many keys and shards that is and writes nothing."""
    from han_compose import web_export

    composer = _composer(style)
    if composer.layout is None:
        raise typer.BadParameter(f"{_layout_path(style)} is missing: `learn --style {style}` builds it.")
    if add:
        if add != "letters":
            raise typer.BadParameter(f"--add takes letters, not {add}.")
        try:
            result = web_export.add(composer, out, web_export.letters(composer.font), add, dry_run=dry_run,
                                    log=lambda line: print(line, flush=True))
        except web_export.AddError as error:
            typer.echo(str(error), err=True)
            raise typer.Exit(1) from error
        print(json.dumps({"keys": result["keys"], "new": result["new"], "shards": len(result["shards"])}))
        return
    manifest = web_export.export(composer, out, joyo=joyo() if parity or held_out else None, parity=parity,
                                 held_out=held_out, workers=workers, log=lambda line: print(line, flush=True))
    print(json.dumps({"version": manifest["version"], **manifest["files"]}, ensure_ascii=False))


@app.command("redraw-parity")
def redraw_parity(out: Path, style: str = STYLE) -> None:
    """Draw the parity rows of the finished export in `out` again with this composer, in place, after
    a change to the composer that changes no record. `js/tests/parity` then measures against them."""
    from han_compose import web_export

    composer = _composer(style)
    if composer.layout is None:
        raise typer.BadParameter(f"{_layout_path(style)} is missing: `learn --style {style}` builds it.")
    print(json.dumps(web_export.redraw_parity(composer, out, log=lambda line: print(line, flush=True))))


@app.command("export-web-pack")
def export_web_pack(out: Path) -> None:
    """Build the `g/` and `p/` shards of a finished export in `out` from its per-key files under
    `out/.work/`, and rewrite its manifest (`han_compose.web_export.pack`). After `export-web --add`,
    only the shards the added records fall in are rebuilt, and the folder's version gains `+<set>`."""
    from han_compose import web_export

    if not (out / "manifest.json").exists() or not (out / web_export.WORK).is_dir():
        raise typer.BadParameter(f"{out} has no manifest.json or no {web_export.WORK}/.")
    complete = out / ".complete"
    complete.unlink(missing_ok=True)
    try:
        changed: list[str] = []
        manifest = web_export.pack(out, log=lambda line: print(line, flush=True), changed=changed)
    except web_export.WorkFileError as error:
        typer.echo(str(error), err=True)
        raise typer.Exit(1) from error
    complete.write_text(manifest["version"], encoding="utf-8")
    print(json.dumps({"version": manifest["version"], "pack": manifest["pack"], "changed": len(changed), **manifest["files"]},
                     ensure_ascii=False))


@app.command()
def calibrate(sample: int = 1500, seed: int = 7, style: str = STYLE) -> None:
    """Fit stroke width against density on the font's own ideographs, for the style's `stem_curve`."""
    composer = _composer(style)
    pool = sorted(char for char in composer.sequences if composer.font.has(char))
    rows = []
    for char in random.Random(seed).sample(pool, min(sample, len(pool))):
        glyph = composer.font.glyph(char)
        widths = compose.stems(compose.raster([compose.Placed(glyph, glyph.box, glyph.box)], 400), compose.EM / 400)
        if all(np.isfinite(widths)):
            rows.append((composer.ink(char), *widths))
    data = np.array(rows)
    fits = [np.polyfit(data[:, 0] / 1000, data[:, axis], 1) for axis in (1, 2)]
    print(json.dumps({"style": style, "characters": len(data), "stem_curve": [[round(b, 2), round(a, 3)] for a, b in fits]}))


if __name__ == "__main__":
    app()
