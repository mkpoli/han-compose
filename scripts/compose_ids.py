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
Every command takes `--style`, one of `compose.STYLES`, and models are cached per style.
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

from han_compose import (
    compose,
    compose_layout,
    compose_standalone,
    kanjivg_cuts,
    web_export,
)
from han_compose.vocab import ROOT, cache_root

app = typer.Typer(add_completion=False)


#: The design drawn in, from `compose.STYLES`.
STYLE = typer.Option(compose.DEFAULT_STYLE, "--style", help=", ".join(compose.STYLES))


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


def _require_layout(composer: compose.Composer, style: str) -> None:
    """Stop where a style's learned layout did not load: without it every drawing falls back to whole
    glyphs and geometry, which scores and exports nothing like the style."""
    if composer.layout is None:
        raise typer.BadParameter(f"{_layout_path(style)} is missing: `learn --style {style}` builds it.")


def _composer(style: str = compose.DEFAULT_STYLE, **options) -> compose.Composer:
    """The composer in `style`, cutting hosts along KanjiVG's groups, with the learned layout and
    standalone model when `learn` and `learn-alone` have made them."""
    composer = compose.Composer(compose.Font.of(_style(style)), compose.drawn_sequences(style), **options)
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


def _collect_less() -> None:
    """Start a young collection after a hundred thousand allocations, where Python starts one after
    two thousand. A drawing builds the trees of every sequence and the host index over them, which
    it keeps, and little garbage in cycles: at the default the collector runs thousands of times
    while they are built, about a fifth of the time a drawing takes."""
    gc.set_threshold(100_000)


@app.command()
def draw(sequence: str, style: str = STYLE) -> None:
    """Print the SVG of one sequence."""
    _collect_less()
    print(compose.svg(_composer(style).compose(sequence)))


@app.command("draw-many")
def draw_many(sequences: Path, out: Path, style: str = STYLE) -> None:
    """Draw every sequence in a file (one a line) into `out` as `<sha256 of its NFC form>.svg`, the
    name a site stores a drawing under. A sequence that cannot be drawn is listed and skipped."""
    import hashlib
    import unicodedata

    _collect_less()
    composer = _composer(style)
    out.mkdir(parents=True, exist_ok=True)
    for line in sequences.read_text(encoding="utf-8").splitlines():
        sequence = unicodedata.normalize("NFC", line.strip())
        if not sequence:
            continue
        try:
            drawing = compose.svg(composer.compose(sequence))
        except (LookupError, ValueError) as error:
            print(f"{sequence}\tnot drawn: {error}")
            continue
        name = hashlib.sha256(sequence.encode()).hexdigest() + ".svg"
        (out / name).write_text(drawing, encoding="utf-8")
        print(f"{sequence}\t{name}")


#: Where `variants` writes, and whether its sheet draws a form another form already draws.
VARIANTS_OUT = typer.Option(..., "--out", help="the folder variants.json and variants.svg go in")
VARIANTS_ALL = typer.Option(False, "--all", help="draw the forms another form already draws too")


@app.command()
def variants(sequence: str, out: Path = VARIANTS_OUT, style: str = STYLE, every: bool = VARIANTS_ALL) -> None:
    """Write every form of one character, or of one sequence, into `out` (`han_compose.variants`):
    `variants.json`, each form with its label, the text that selects it, its font, glyph and
    outline, and `variants.svg`, one sheet of them.

    A character's forms are Noto CJK's regional designs, its sequences in the Ideographic Variation
    Database, its standardized variation sequences and its compatibility ideographs; `--style` is
    sans or serif, the designs Noto CJK draws by region. A sequence is composed once for each way
    to write its components with the variation sequences the style's font draws, in any style."""
    from han_compose import variants as V

    _style(style)
    if len(sequence) == 1:
        if style not in V.COLLECTIONS:
            raise typer.BadParameter(f"A character's variants are drawn in {' or '.join(V.COLLECTIONS)}, not {style}.")
        try:
            fonts = V.Fonts.of(style)
            found, sources = V.forms(sequence, fonts)
        except (FileNotFoundError, ValueError) as error:
            raise typer.BadParameter(str(error)) from error
        document = V.document(sequence, style, found, sources, fonts)
        title, above = f"{sequence} U+{ord(sequence):04X}", V.headings(fonts)
        summary = {"character": sequence, "forms": len(found), **{kind: sum(form.kind == kind for form in found) for kind in V.KINDS[:4]}}
    else:
        composer = _composer(style)
        _require_layout(composer, style)
        try:
            found, total = V.composed(sequence, composer)
            document = V.sequence_document(sequence, style, found, total, V.composing_fonts(style))
        except ValueError as error:
            raise typer.BadParameter(str(error)) from error
        title, above = sequence, V.sequence_headings(found, total)
        summary = {"sequence": sequence, "forms": len(found), "combinations": total, "cap": V.COMBINATIONS}
    if not any(form.outline for form in found):
        raise typer.BadParameter(f"No font draws {sequence}.")
    out.mkdir(parents=True, exist_ok=True)
    (out / "variants.json").write_text(json.dumps(document, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (out / "variants.svg").write_text(V.sheet(title, found, above, every), encoding="utf-8")
    print(json.dumps({**summary, "distinct": sum(bool(form.outline) and not form.same_as for form in found),
                      "undrawn": sum(form.outline is None for form in found)}, ensure_ascii=False))


def joyo() -> list[str]:
    """The jōyō kanji, by Unihan 16.0's kJoyoKanji, fetched once into `<cache>/ucd/unihan/`."""
    import io
    import zipfile

    from han_compose.variants import UNIHAN

    text = zipfile.ZipFile(io.BytesIO(UNIHAN.read())).read("Unihan_OtherMappings.txt").decode()
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
        parts = [(item.cut, compose._rings(item.part.contours, item.contours())) for item in items]
        points = np.concatenate([ring for cut, rings in parts if not cut for ring in rings])
        box = (*map(float, points.min(axis=0)), *map(float, points.max(axis=0)))
        # Each part filled apart and joined, less what ㇯ takes away, as `compose.raster` does: parts overlap.
        ink, taken = np.zeros((size, size), bool), np.zeros((size, size), bool)
        for cut, rings in parts:
            if cut:
                taken |= compose.fill(rings, size, box)
            else:
                ink |= compose.fill(rings, size, box)
        return ink & ~taken
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
            made = sum(drawer.ink("", p.part) * (p.scale[0] + p.scale[1]) / 2 for p in placed if not p.cut)
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
    _require_layout(composer, style)
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
    # Every fold's model read before the workers fork, so that they share them: each character is
    # laid out by the model that never saw it.
    composer.layout.read()
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
    the shards they fall in; `--add variants` does the same for every variation sequence the main
    font draws with a glyph of its own (`web_export.variants`), and `export-web-pack` lists them in
    `variants.json`. `--add kin` writes the kin table (`web_export.add_kin`), which
    `export-web-pack` publishes as `kin.json`. `--dry-run` reports how many keys and shards that is
    and writes nothing."""
    from han_compose import web_export

    composer = _composer(style)
    _require_layout(composer, style)
    if add:
        sets = {"letters": web_export.letters, "variants": web_export.variants}
        if add not in (*sets, "kin"):
            raise typer.BadParameter(f"--add takes letters, variants or kin, not {add}.")
        log = lambda line: print(line, flush=True)
        try:
            if add == "kin":
                print(json.dumps(web_export.add_kin(composer, out, dry_run=dry_run, log=log)))
                return
            result = web_export.add(composer, out, sets[add](composer.font), add, dry_run=dry_run, log=log)
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


@app.command("calibrate-columns")
def calibrate_columns(sample: int = 180, seed: int = 73, style: str = STYLE) -> None:
    """Measure native side-by-side clearances at the light master, as shares of each pair's ink width."""
    composer = _composer(style)
    chars = sorted(ch for ch, seq in composer.sequences.items() if seq.startswith("⿰") and composer.font.own(ch))
    random.Random(seed).shuffle(chars)
    rows = []
    for ch in chars:
        if len(rows) >= sample:
            break
        try:
            host = composer._host_node(ch, compose.parse(composer.sequences[ch]), ())
        except (ValueError, LookupError):
            continue
        if host is None or len(host.pieces) != 2:
            continue
        a, b = (compose.Placed(piece, piece.box, piece.box) for piece in host.pieces)
        profile = compose._column_profile([a], [b])
        if profile is not None:
            rows.append(profile[2:4])
    broad, closest = np.asarray(rows).T
    print(json.dumps({"style": style, "characters": len(rows), "column_clearance":
                      [round(float(np.percentile(broad, 75)), 3), round(float(np.percentile(closest, 25)), 3)]}))


@app.command("calibrate-parts")
def calibrate_parts(sample: int = 700, seed: int = 11, style: str = STYLE) -> None:
    """Fit the powers of a part's scale its stroke width follows in the font's own characters, for the
    style's `part_stems`: each part of a character cut cleanly in two against its own glyph.

    The stroke widths of a character's two parts, side by side or stacked, give the style's
    `part_spread`: how far apart they are in four of five characters.

    The stroke widths give the two powers. Growing an outline also thickens its dots, ends and
    diagonals, so the glyph set into the part's box and weighted by those powers holds more ink than
    the part: the powers are then brought toward 1 (plain scaling) by the strength at which the ink
    of the weighted glyphs is closest to the ink of the parts themselves."""
    from dataclasses import replace

    composer = _composer(style)
    held = composer.font.style

    def stem(part: compose.Part) -> tuple[float, float] | None:
        widths = compose.stems(compose.raster([compose.Placed(part, part.box, part.box)], 400), compose.EM / 400)
        return widths if all(np.isfinite(widths)) else None

    def ink(placed: compose.Placed) -> float:
        return float(compose.raster([placed], 200).sum())

    rows, pairs, apart = [], [], []
    for ops, places in ((tuple(compose.ENCLOSE), (1,)), (("⿰", "⿱"), (0, 1))):
        chars = sorted(ch for ch, s in composer.sequences.items() if s[0] in ops and composer.font.own(ch))
        random.Random(seed).shuffle(chars)
        cut = 0
        for char in chars:
            if cut >= sample:
                break
            try:
                tree = compose.parse(composer.sequences[char])
                host = composer._host_node(char, tree, ())
            except (ValueError, LookupError):
                continue
            if host is None or len(host.pieces) != 2:
                continue
            cut += 1
            if len(places) == 2:
                both = [stem(piece) for piece in host.pieces]
                if all(both):
                    apart.append([max(both[0][axis], both[1][axis]) / min(both[0][axis], both[1][axis]) for axis in (0, 1)])
            for place in places:
                piece, operand = host.pieces[place], tree[1 + place]
                if not isinstance(operand, str) or not composer.font.own(operand):
                    continue
                own = composer.font.glyph(operand)
                widths, natural = stem(piece), stem(own)
                if widths is None or natural is None:
                    continue
                rows.append([((piece.box[axis + 2] - piece.box[axis]) / max(own.box[axis + 2] - own.box[axis], 1),
                              widths[axis] / natural[axis]) for axis in (0, 1)])
                pairs.append((own, piece))
    fitted = []
    for axis in (0, 1):
        data = np.array([row[axis] for row in rows])
        data = data[(data[:, 0] > compose.PART_SCALE_LEAST) & (data[:, 0] < 1.2) & (data[:, 1] > 0)]
        x, y = np.log(data[:, 0]), np.log(data[:, 1])
        # Through the origin: a part at its glyph's size keeps its glyph's stem.
        fitted.append(float((x * y).sum() / (x * x).sum()))
    truth = np.array([ink(compose.Placed(piece, piece.box, piece.box)) for _, piece in pairs])
    native = [composer.ink("", own) for own, _ in pairs]
    best = None
    for strength in np.arange(0.5, 1.001, 0.05):
        powers = tuple(1 - strength * (1 - power) for power in fitted)
        composer.font.style = replace(held, part_stems=powers)
        try:
            drawn = []
            for (own, piece), length in zip(pairs, native):
                placed = compose.Placed(own, own.box, piece.box, native=length)
                composer._balance([placed])
                drawn.append(ink(placed))
        finally:
            composer.font.style = held
        ratio = np.array(drawn) / truth
        ratio = ratio[np.isfinite(ratio) & (ratio > 0)]
        error = float(np.abs(np.log(ratio)).mean())
        if best is None or error < best[0]:
            best = (error, float(strength), powers, float(np.median(ratio)))
    error, strength, powers, median = best
    print(json.dumps({"style": style, "parts": len(rows), "stem_powers": [round(power, 3) for power in fitted],
                      "strength": round(strength, 2), "part_stems": [round(power, 3) for power in powers],
                      "ink_error": round(error, 3), "ink_median": round(median, 3),
                      # The wider stroke width of a character's two parts over the narrower, in four of five.
                      "part_spread": [round(float(np.quantile([row[axis] for row in apart], 0.8)), 2) for axis in (0, 1)],
                      "characters_cut_in_two": len(apart)}))


if __name__ == "__main__":
    app()
