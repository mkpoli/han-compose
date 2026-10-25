"""Everything a browser port of the composer needs to draw a sequence, written as static files.

`export` writes into one folder:

- `manifest.json`: the export's version (composer commit and layout file), the constants the
  composer draws with, the file scheme, the files' sizes, and the licence notices;
- `layout.json`: the learned layout's model on every character ("all", `SEEDS` networks), its
  weights quantized (`LAYOUT_DTYPES`), with the feature definition;
- `g/<hh>/<sha256(key)>.json`: one record per key (a character or a sequence): its glyph's outlines
  at weight 400 and the move to `HEAVY`, its ink, its shape features and the layout table's
  statistics, its positional forms;
- `p/<hh>/<sha256(place + TAB + operand)>.json`: one list per (place, operand) of the pieces host
  characters give that operand there, every host `Composer._ranked`, `_instance` and the kin and
  facing places may weigh, each cut by the composer (along KanjiVG's groups where it can), or a
  stub without a piece where it cannot cut it.

`hh` is the hash's first two hex digits. Every file under `g/` and `p/` is gzip-compressed JSON, so a
page fetches only the records and lists the operands of a sequence name.

With `parity`, a fixed sample of compound jōyō kanji is drawn from their sequences as a sequence no
character draws would be (each without itself and its twins, `reuse` off, the model on everything)
into `parity.json`, as reference drawings a port is checked against; every host piece those
drawings used joins the export. With `held_out`, more are drawn into `parity-held-out.json`, whose
hosts do not.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import random
import subprocess
from collections.abc import Iterable
from pathlib import Path

import numpy as np

from . import compose as C
from . import compose_layout as L

#: The export's own format; a change to any file's shape makes a new one.
FORMAT = 2.1
#: Outline coordinates are stored as int16 in units of 1 / `QUANT` font unit.
QUANT = 4
#: Host nodes exported per (place, operand), as `Composer._ranked` weighs them: the variable font's
#: and the fallback fonts' each up to the larger candidate cap (32 for a part placed in the em, 16
#: otherwise), by `_prior`; and the first `KIN_HOSTS` in the index's order, overall and of the
#: variable font's, which the kin and facing places and `_instance` (`INSTANCE_HOSTS`) slice.
CANDIDATES = 32
#: Layout weights: int8 with a scale per output column when its boxes stay within `INT8_TOLERANCE`
#: font units of the float32 model's on the check sample, else float16.
LAYOUT_DTYPES = ("int8", "float16")
INT8_TOLERANCE = 1.0
#: Sequences the int8 check predicts.
CHECK_SAMPLE = 400

KANJIVG_NOTICE = "KanjiVG, Copyright (C) 2009-2013 Ulrich Apel, CC BY-SA 3.0, https://kanjivg.tagaini.net/"


def key_hash(key: str) -> str:
    """The SHA-256 of a key's UTF-8, in hex."""
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def record_path(key: str) -> str:
    """Where a key's record is: `g/<first two hex digits>/<sha256 hex>.json`."""
    h = key_hash(key)
    return f"g/{h[:2]}/{h}.json"


def hosts_path(place: str, operand: str) -> str:
    """Where a (place, operand)'s host list is: `p/<hh>/<sha256(place + TAB + operand) hex>.json`."""
    h = key_hash(f"{place}\t{operand}")
    return f"p/{h[:2]}/{h}.json"


def _b64(array: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(array).astype(array.dtype.newbyteorder("<")).tobytes()).decode()


def _ops(ops: list[tuple[str, int, bool]]) -> str:
    """Pen commands as letters: M, L, or Q with its point count and `*` when the contour closes on an
    implied point (TrueType's all-off-curve contour), as `compose._segments` reads them."""
    out = []
    for op, n, implied in ops:
        if op == "moveTo":
            out.append("M")
        elif op == "lineTo":
            out.append("L")
        elif op == "qCurveTo":
            out.append(f"Q{n}" + ("*" if implied else ""))
        else:
            raise ValueError(f"{op} outlines are not exported.")
    return "".join(out)


def _r(values: Iterable[float], digits: int = 2) -> list[float]:
    return [round(float(v), digits) for v in values]


def part_record(part: C.Part) -> dict:
    """A part's outlines: its box, and per contour its pen commands, its points at weight 400 and
    their move to `HEAVY`, int16 in 1 / `QUANT` units, little-endian, x and y interleaved (an
    outline outside int16's range is refused). A part a fallback font draws carries the stroke width measured on its glyph (`Contour.width`)."""
    contours = []
    for c in part.contours:
        light, heavy = np.round(c.light * QUANT), np.round(c.heavy * QUANT)
        if min(light.min(), heavy.min()) < -32768 or max(light.max(), heavy.max()) > 32767 or abs(heavy - light).max() > 32767:
            raise ValueError(f"An outline at {part.box} does not fit int16 at 1/{QUANT} unit.")
        light, heavy = light.astype(np.int16), heavy.astype(np.int16)
        contours.append([_ops(c.ops), _b64(light.ravel()), _b64((heavy - light).ravel())])
    out = {"b": _r(part.box), "p": contours}
    if part.contours and part.contours[0].width is not None:
        out["w"] = _r(part.contours[0].width)
    return out


def decode_part(record: dict) -> list[tuple[str, np.ndarray, np.ndarray]]:
    """A part record read back: per contour its commands, its light points and its heavy points."""
    out = []
    for ops, light, delta in record["p"]:
        lo = np.frombuffer(base64.b64decode(light), dtype="<i2").astype(float).reshape(-1, 2)
        d = np.frombuffer(base64.b64decode(delta), dtype="<i2").astype(float).reshape(-1, 2)
        out.append((ops, lo / QUANT, (lo + d) / QUANT))
    return out


def _version(root: Path) -> tuple[str, bool]:
    def git(*args: str) -> str:
        return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True).stdout.strip()

    commit = git("rev-parse", "--short=12", "HEAD") or "unknown"
    dirty = bool(git("status", "--porcelain", "--", "src", "scripts", "data"))
    return commit, dirty


def _font_notice(path: Path) -> dict:
    from fontTools.ttLib import TTFont

    names = TTFont(path, lazy=True)["name"]
    name = lambda i: str(names.getName(i, 3, 1, 0x409) or "")
    return {"name": name(1), "version": name(5).split(";")[0], "copyright": name(0), "trademark": name(7),
            "licence": "SIL OFL 1.1", "licence_url": "https://openfontlicense.org/open-font-license-official-text/",
            "file": path.name}


def constants(composer: C.Composer) -> dict:
    """Every module constant of `compose` the composer draws with, by name, and the font's stems
    and face: (width at 400, width at `HEAVY`) of 丨 across x and 一 across y."""
    out = {}
    for name in dir(C):
        if not name.isupper() or name.startswith("_") or name.endswith(("_URL", "_SHA256", "_FILE")) or name == "PLANGOTHIC":
            continue
        value = getattr(C, name)
        if isinstance(value, (frozenset, set)):
            value = sorted(value)
        elif isinstance(value, dict):
            value = {",".join(map(str, k)) if isinstance(k, tuple) else str(k): (list(v) if isinstance(v, tuple) else v)
                     for k, v in value.items()}
        elif isinstance(value, tuple):
            value = [list(v) if isinstance(v, tuple) else v for v in value]
        elif not isinstance(value, (int, float, str)):
            continue
        out[name] = value
    out["stem"] = [_r(s, 3) for s in composer.font.stem]
    out["face"] = _r(composer.face)
    return out


# ------------------------------------------------------------------ the layout
def _quantize(weights: np.ndarray, dtype: str) -> dict:
    if dtype == "float16":
        return {"shape": list(weights.shape), "data": _b64(weights.astype(np.float16))}
    scale = np.maximum(np.abs(weights).max(axis=0), 1e-12) / 127
    q = np.clip(np.round(weights / scale), -127, 127).astype(np.int8)
    return {"shape": list(weights.shape), "data": _b64(q), "scale": _b64(scale.astype(np.float32))}


def _dequantize(record: dict) -> np.ndarray:
    shape = record["shape"]
    if "scale" in record:
        q = np.frombuffer(base64.b64decode(record["data"]), dtype=np.int8).astype(np.float32).reshape(shape)
        return q * np.frombuffer(base64.b64decode(record["scale"]), dtype="<f4")
    return np.frombuffer(base64.b64decode(record["data"]), dtype="<f2").astype(np.float32).reshape(shape)


def layout_runs(layout: dict) -> list[list[np.ndarray]]:
    """`layout.json`'s networks read back as (weights, bias) arrays per layer, as `LayoutModel` holds them."""
    return [[_dequantize(a) if isinstance(a, dict) else np.frombuffer(base64.b64decode(a), dtype="<f4")
             for a in run] for run in layout["seeds"]]


def predict(runs: list[list[np.ndarray]], x: np.ndarray) -> np.ndarray:
    """`LayoutModel.predict`'s forward pass over these networks, in font units."""
    out = []
    for layers in runs:
        h = x
        for k in range(0, len(layers) - 2, 2):
            h = L._gelu(h @ layers[k] + layers[k + 1])
        out.append((h @ layers[-2] + layers[-1]) * 1000)
    return np.mean(out, axis=0)


def layout_checks(composer: C.Composer, n: int = CHECK_SAMPLE, seed: int = 1) -> list[tuple[str, list[str]]]:
    """A fixed sample of drawn characters' two-operand sequences, the operator and operand keys of each."""
    pool = []
    for char, seq in sorted(composer.sequences.items()):
        if seq[0] in L.OPS and composer.font.has(char):
            try:
                tree = C.parse(seq)
            except ValueError:
                continue
            if len(tree) == 3:
                pool.append((tree[0], [C.key(k) for k in tree[1:]]))
    return random.Random(seed).sample(pool, min(n, len(pool)))


def layout_record(composer: C.Composer, checks: list[tuple[str, list[str]]]) -> dict:
    """The "all" model, quantized as int8 when its boxes on `checks` stay within `INT8_TOLERANCE`, as
    float16 otherwise and always when there are no checks."""
    model = composer.layout
    runs = model.weights["all"]
    table = model.tables["all"]
    cache: dict = {}
    X = np.array([L.features(composer, op, kids, table, cache) for op, kids in checks]) if checks else np.zeros((0, 0))
    exact = predict(runs, X) if len(X) else None
    errors = {}
    chosen = None
    for dtype in LAYOUT_DTYPES:
        record = [[_quantize(a, dtype) if a.ndim == 2 else _b64(a.astype(np.float32)) for a in layers] for layers in runs]
        if exact is not None:
            got = predict(layout_runs({"seeds": record}), X)
            errors[dtype] = {"max": round(float(np.abs(got - exact).max()), 3), "mean": round(float(np.abs(got - exact).mean()), 4)}
        if chosen is None and (dtype != "int8" or (exact is not None and errors[dtype]["max"] <= INT8_TOLERANCE)):
            chosen = (dtype, record)
    dtype, record = chosen
    return {
        "file": L.LAYOUT_FILE, "model": "all", "dtype": dtype, "error_against_float32": errors, "checked": len(checks),
        "ops": list(L.OPS),
        "features": {
            "shape": L.SHAPE,
            "per_input": len(L.OPS) + 2 * (4 + 4 + 1 + 1 + L.SHAPE),
            "order": ["one-hot operator over ops"] + [
                f"operand {i}: usual box mean / 1000 (4), spread / 100 (4), log1p(count) / 5, log1p(outline count o) / 3, shape f ({L.SHAPE})"
                for i in (0, 1)],
            "usual": "the operand's u[place] in its record, else defaults[place], zero spread and count 0",
            "shape": "the operand's f and o in its record: a character's own glyph, or for a sequence the glyph of the character it describes (its e), as compose_layout.shape reads it; zeros and 0 when the record has none (a sequence no character draws, a character with a variation selector)",
            "activation": "gelu, tanh approximation, between layers; the last layer linear; mean over seeds, times 1000",
            "output": "two boxes (x0, y0, x1, y1) in font units, y up: operand 0 then operand 1",
        },
        "defaults": {p: _r(v) for p, v in sorted(table.defaults.items())},
        "seeds": record,
    }


# ------------------------------------------------------------------ hosts
def _here(tree: tuple, path: tuple) -> tuple:
    node = tree
    for step in path:
        node = node[1 + step]
    return node


def _prior(composer: C.Composer, entry: tuple) -> tuple:
    """The order hosts are tried in before a target is known: the variable font's own glyphs, then
    Japanese characters, then shallow nodes, then the index's order."""
    char, _tree, path, _i = entry
    return (not composer.font.own(char), char not in composer.japanese, len(path))


def _sibling_ink(composer: C.Composer, entry: tuple) -> float:
    char, tree, path, i = entry
    here = _here(tree, path)
    return sum(composer.ink(n) for k, n in enumerate(here[1:]) if k != i)


def host_record(composer: C.Composer, entry: tuple, host: C.Host, rank: int) -> dict:
    """One host's piece for an operand, with what `Composer._ranked` weighs it by: the node's operator
    and the other operands' keys (for an exact match), their ink, the node's depth, whether the
    variable font draws the host and whether Japan writes it; the node's frame and whether it is
    the whole character; whether KanjiVG's groups cut it; and `r`, the entry's position in the
    index's list for that place and operand."""
    char, tree, path, i = entry
    here = _here(tree, path)
    kvg = composer.kvg.host_node(char, tree, path) if composer.kvg is not None else None
    by_kvg = kvg is not None and [[id(c) for c in p.contours] for p in kvg.pieces] == [[id(c) for c in p.contours] for p in host.pieces]
    record = {"r": rank, "h": char, "i": i, "op": here[0], "ok": [C.key(n) for k, n in enumerate(here[1:]) if k != i],
              "si": round(_sibling_ink(composer, entry), 1), "d": len(path), "v": int(composer.font.own(char)),
              "j": int(char in composer.japanese), "n": round(composer.ink(char), 1), "fr": _r(host.frame),
              "wh": int(host.whole), "g": round(float(host.gap), 2), **part_record(host.pieces[i])}
    if by_kvg:
        record["kv"] = 1
    return record


def candidates(composer: C.Composer, place: str, written: str) -> list[tuple[int, tuple]]:
    """The index entries exported for (place, operand), with their positions in the index's list,
    in `_prior`'s order: the variable font's and the fallbacks' first `CANDIDATES` each by `_prior`,
    and the first `KIN_HOSTS` overall and of the variable font's in the index's order."""
    index, _ = composer._index
    entries = list(enumerate(index.get((place, written), [])))
    own = [e for e in entries if composer.font.own(e[1][0])]
    foreign = [e for e in entries if not composer.font.own(e[1][0])]
    prior = lambda rows: sorted(rows, key=lambda e: (_prior(composer, e[1]), e[0]))
    chosen = {r: e for r, e in [*entries[:C.KIN_HOSTS], *own[:C.KIN_HOSTS], *prior(own)[:CANDIDATES], *prior(foreign)[:CANDIDATES]]}
    return prior(chosen.items())


def stub_record(composer: C.Composer, entry: tuple, rank: int) -> dict:
    """A candidate the composer cannot cut: what `Composer._ranked` sorts it by, with `x` 1 and no
    piece. `_ranked` takes its first `limit` candidates before cutting them, so an entry that fails
    to cut still uses up a place among them."""
    char, tree, path, i = entry
    here = _here(tree, path)
    return {"r": rank, "h": char, "i": i, "op": here[0], "ok": [C.key(n) for k, n in enumerate(here[1:]) if k != i],
            "si": round(_sibling_ink(composer, entry), 1), "d": len(path), "v": int(composer.font.own(char)),
            "j": int(char in composer.japanese), "x": 1}


def hosts_for(composer: C.Composer, place: str, written: str) -> list[dict]:
    """Every `candidates` entry: its piece as `_host_node` cuts it, or a stub when it does not cut."""
    out = []
    for rank, entry in candidates(composer, place, written):
        host = composer._host_node(entry[0], entry[1], entry[2])
        out.append(host_record(composer, entry, host, rank) if host is not None else stub_record(composer, entry, rank))
    return out


# ------------------------------------------------------------------ keys
def _alternatives(composer: C.Composer, char: str, places: Iterable[str]) -> dict[str, list[str]]:
    out = {}
    for place in places:
        alts = composer.alternatives(char, place)[1:]
        if alts:
            out[place] = alts
    return out


def char_record(composer: C.Composer, char: str, places: list[str], table: L.Table, shapes: dict) -> dict:
    """A character's own drawing data: glyph, sequence, ink, outline counts, shape features and
    positional forms (`alternatives` beyond itself, by place)."""
    out = key_record(composer, char, table, shapes)
    glyph = composer.font.glyph(char)
    if glyph is not None:
        out["G"] = {"v": int(composer.font.own(char)), **part_record(glyph)}
    if char in composer.sequences:
        out["s"] = composer.sequences[char]
    if char in composer.atomic:
        out["at"] = 1
    if char in composer.hands:
        out["hand"] = composer.hands[char]
    alts = _alternatives(composer, char, places)
    if alts:
        out["a"] = alts
    out["nl"] = composer._outlines(char)
    return out


def key_record(composer: C.Composer, key: str, table: L.Table, shapes: dict) -> dict:
    """What the layout reads of an operand (`compose_layout.features`): its usual boxes by place, its
    outline count, its shape features, and its ink."""
    out: dict = {"ink": round(composer.ink(key if len(key) == 1 or C._selector(key[-1]) else C.parse(key)), 1)}
    o = L.outlines(composer, key)
    if o:
        out["o"] = o
        out["f"] = _r(L.shape(composer, key, shapes), 4)
    return out


def _leaf(key: str) -> bool:
    return len(key) == 1 or (len(key) == 2 and C._selector(key[1]))


_WORKER: C.Composer | None = None
_PLACES: list[str] = []
_SHAPES: dict = {}
#: Set before workers fork: the output folder, the injected parity hosts by (place, operand), and
#: the fields the parent adds to each record (u, e, P).
_OUT: Path | None = None
_INJECT: dict[tuple[str, str], list[dict]] = {}
_EXTRA: dict[str, dict] = {}
#: Pool renewal: a worker's composer caches every cut and glyph it has read (about 1.4 MB a host
#: list), so it is replaced after this many chunks (`maxtasksperchild` counts chunks).
HOST_CHUNK, HOST_CHUNKS = 4, 50
RECORD_CHUNK, RECORD_CHUNKS = 16, 100
DRAW_CHUNK, DRAW_CHUNKS = 2, 25


def _write(path: str, value) -> tuple[int, int]:
    """Write `value` as gzip-compressed JSON (mtime 0) under the output folder: (raw, gzip) bytes."""
    data = _dump(value)
    packed = gzip.compress(data, 9, mtime=0)
    target = _OUT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(".part")
    partial.write_bytes(packed)
    partial.replace(target)
    return len(data), len(packed)


def _existing(path: str) -> tuple[dict, tuple[int, int]] | None:
    """A file a stopped run already wrote, read back with its sizes."""
    target = _OUT / path
    if not target.exists():
        return None
    packed = target.read_bytes()
    data = gzip.decompress(packed)
    return json.loads(data), (len(data), len(packed))


def _ids(hosts: list[dict]) -> list[tuple]:
    """The entries a list holds a piece for: stubs left out."""
    return [(h["h"], h["i"], h["r"]) for h in hosts if not h.get("x")]


def _work(task: tuple[str, ...]):
    """One unit of the export, run in a worker forked from the exporting process; it writes its own
    file and returns only what the parent counts. A file a stopped run wrote is kept."""
    kind = task[0]
    if kind == "host":
        place, written = task[1], task[2]
        path = hosts_path(place, written)
        found = _existing(path)
        if found is not None:
            return task, _ids(found[0]["hosts"]), found[1]
        hosts = hosts_for(_WORKER, place, written)
        for record in _INJECT.get((place, written), []):
            # A parity drawing cut it, under its own exclusion: its piece replaces the stub.
            hosts = [h for h in hosts if not (h.get("x") and _same_host(record, h))]
            if not any(_same_host(record, h) for h in hosts):
                hosts.append(record)
        if not any(not h.get("x") for h in hosts):
            return task, [], None
        hosts.sort(key=lambda h: (not h["v"], not h["j"], h["d"], h["r"]))
        return task, _ids(hosts), _write(path, {"place": place, "operand": written, "hosts": hosts})
    key = task[1]
    path = record_path(key)
    found = _existing(path)
    if found is not None:
        return task, None, found[1]
    table = _WORKER.layout.tables["all"]
    record = char_record(_WORKER, key, _PLACES, table, _SHAPES) if kind == "char" else key_record(_WORKER, key, table, _SHAPES)
    return task, None, _write(path, {"k": key, **record, **_EXTRA.get(key, {})})


def tasks(composer: C.Composer, only: set[str] | None = None) -> list[tuple[str, str, str]]:
    """Every (place, operand) the index holds: a host list each."""
    index, _ = composer._index
    return [("host", place, written) for place, written in sorted(index) if only is None or written in only]


# ------------------------------------------------------------------ parity
def parity_sample(composer: C.Composer, joyo: list[str], n: int, seed: int = 0) -> list[tuple[str, str]]:
    """`n` compound jōyō kanji (two or more operands under ⿰ ⿱ ⿲ ⿳ or an enclosure), drawn at random
    with a fixed seed, with their sequences. Atomic characters are left out: the composer draws them
    whole, from their glyph or from where another character holds them, never from their parts."""
    pool = []
    for char in joyo:
        seq = composer.sequences.get(char)
        if seq is None or char in composer.atomic:
            continue
        try:
            tree = C.parse(seq)
        except ValueError:
            continue
        if isinstance(tree, tuple) and (tree[0] in C.AXIS or tree[0] in C.ENCLOSE):
            pool.append((char, seq))
    return random.Random(seed).sample(pool, min(n, len(pool)))


def parity_samples(composer: C.Composer, joyo: list[str], injected: int, held_out: int) -> tuple[list, list]:
    """The injected sample (`parity_sample`, seed 0), and a held-out one of other characters (seed 2)."""
    first = parity_sample(composer, joyo, injected)
    taken = {c for c, _ in first}
    rest = [item for item in parity_sample(composer, joyo, len(joyo)) if item[0] not in taken]
    rest.sort()
    return first, random.Random(2).sample(rest, min(held_out, len(rest)))


def _used_entry(composer: C.Composer, place: str, node, host: C.Host, i: int) -> tuple[str, str, tuple, int] | None:
    """The index entry a host the composer chose came from, by its node path: the entry whose cut is
    that very host (`_host_node` returns the cut it cached for `_ranked`), with the place and the
    written form it is held under."""
    index, _ = composer._index
    places = [place] + [p for p in (C.KIN_PLACES.get(place), C.FACING_PLACES.get(place)) if p]
    for where in places:
        for written in composer.alternatives(node, where):
            for rank, entry in enumerate(index.get((where, written), [])):
                if entry[0] == host.char and entry[3] == i and composer._host_node(entry[0], entry[1], entry[2]) is host:
                    return where, written, entry, rank
    return None


def _recording(composer: C.Composer, used: list) -> None:
    """Note every host `_host` returns, with the index entry, and so the node path, it was cut from."""
    original = composer._host

    def recorded(op, index, node, siblings, box, placed=False):
        found = original(op, index, node, siblings, box, placed)
        if found is not None:
            hit = _used_entry(composer, C.slot(op, index), node, found[0], found[1])
            if hit is None:
                used.append(None)
            else:
                where, written, entry, rank = hit
                used.append((where, written, host_record(composer, entry, found[0], rank)))
        return found

    composer._host = recorded


#: Origins of parts drawn by composer paths the export does not carry.
UNEXPORTED_ORIGINS = ("teacher", "overlay", "transplant", "kin", "alone")


def _draw(item: tuple[str, str]) -> tuple[dict, list]:
    char, seq = item
    used: list = []
    composer = _WORKER
    excluded = sorted({char, *composer.twins.get(char, ())})
    # Drawn as a sequence no character draws would be: without the character and its twins, every
    # part from others, laid out by the model on everything, which is the one exported.
    saved = composer.exclude, composer.reuse, composer.layout.fold_of
    try:
        composer.exclude, composer.reuse, composer.layout.fold_of = set(excluded), False, {}
        _recording(composer, used)
        row = {"c": char, "s": seq, "x": excluded, "face": _r(composer.face)}
        try:
            placed = composer.compose(seq)
            row |= {"d": C.svg_path(placed), "origins": [p.origin for p in placed]}
        except (LookupError, ValueError) as error:
            row |= {"d": None, "error": str(error)}
    finally:
        composer.__dict__.pop("_host", None)
        composer.exclude, composer.reuse, composer.layout.fold_of = saved
    return row, used


def parity_stats(rows: list[dict], used: list, lists: dict[tuple[str, str], set[tuple]] | None = None) -> dict:
    """How a parity set was drawn: rows drawn, part origins by kind, rows using a path the export does
    not carry, hosts used, and, given the host lists, how many of those hosts the export holds."""
    drawn = [r for r in rows if r["d"] is not None]
    kinds: dict[str, int] = {}
    for r in drawn:
        for o in r["origins"]:
            k = o.split()[0]
            kinds[k] = kinds.get(k, 0) + 1
    hosts = [u for u in used if u is not None]
    out = {"rows": len(rows), "drawn": len(drawn), "origins": dict(sorted(kinds.items())),
           "rows_using_unexported_paths": sum(any(o.split()[0] in UNEXPORTED_ORIGINS for o in r["origins"]) for r in drawn),
           "hosts_used": len(used), "hosts_unmatched": len(used) - len(hosts)}
    if lists is not None:
        out["hosts_in_export"] = sum((record["h"], record["i"], record["r"]) in lists.get((place, written), set())
                                     for place, written, record in hosts)
    return out


# ------------------------------------------------------------------ writing
def _dump(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def _same_host(a: dict, b: dict) -> bool:
    """The same index entry: host, operand index, and position in the place's list."""
    return a["h"] == b["h"] and a["i"] == b["i"] and a["r"] == b["r"]


def _pool(workers: int, chunks: int):
    """Workers forked from this process, each replaced after `chunks` chunks."""
    import multiprocessing as mp

    return mp.get_context("fork").Pool(workers, maxtasksperchild=chunks) if workers > 1 else None


def _run(pool, work: list, chunksize: int, log, label: str, every: int):
    results = pool.imap(_work, work, chunksize=chunksize) if pool else map(_work, work)
    for k, result in enumerate(results):
        if (k + 1) % every == 0:
            log(f"{label} {k + 1}/{len(work)}")
        yield result


def _parity_file(version: str, kind: str, rows: list, stats: dict) -> bytes:
    return _dump({"version": version, "set": kind, "size": 96, "stats": stats, "rows": rows})


#: Composer paths whose data the export does not carry: a port drawing through them differs from Python.
NOT_EXPORTED = {
    "_template": "teachers: a drawn character with a node of the same operator whose operands are most like the target's, cut into them; used where the learned layout does not apply (three operands, nested nodes other than ⿰ ⿱) and before shares",
    "_transplant": "a whole ⿰ ⿲ ⿱ ⿳ character assembled from each operand's host pieces at the gaps their own hosts keep, tried at the root after the learned layout",
    "_kin_outer": "an enclosing part taken from a kin enclosing part's hosts cut along KanjiVG (KIN_TRIED, KIN_OUTER_HOSTS)",
    "_upper": "the upper part of an enclosing operand as hosts holding it on the left draw it, cut along KanjiVG",
    "_overlays(None)": "the any-overlay fallback: the first OVERLAY_ANY two-operand overlays averaged when no overlay shares an operand; overlay teachers (_overlay) too",
    "_alone, _instances": "a character taken whole from where others hold it, placed by the standalone model: used only when the character itself is excluded, which a typed sequence never is",
    "twins": "characters the font draws alike: only an excluded character's twins matter, listed per parity row in x",
    "guide": "the guide networks (COMPOSE_GUIDE), off by default",
    "rerank": "Composer.rerank, off by default",
}


def export(composer: C.Composer, out: Path, joyo: list[str] | None = None, parity: int = 0, held_out: int = 0,
           only: set[str] | None = None, workers: int = 1, root: Path | None = None, log=print) -> dict:
    """Write the export into `out` and return its manifest. `only` limits it to those keys (tests).
    Workers write each record and host list as they finish; a rerun of the same version into the
    same folder keeps those files and writes only the rest."""
    global _WORKER, _PLACES, _OUT, _INJECT, _EXTRA
    import shutil

    from .vocab import ROOT, VOCAB

    root = root or ROOT
    commit, dirty = _version(root)
    version = f"{commit}{'+dirty' if dirty else ''}-{Path(L.LAYOUT_FILE).stem}-f{FORMAT}"
    out.mkdir(parents=True, exist_ok=True)
    for name, wanted in (("parity.json", parity), ("parity-held-out.json", held_out)):
        if not wanted and (out / name).exists():
            (out / name).unlink()
    # Files of another version, another key set or a dirty tree are never kept.
    marker = out / ".export"
    stamp = json.dumps({"version": version, "only": sorted(only) if only is not None else None,
                        "parity": parity, "held_out": held_out}, ensure_ascii=False)
    if dirty or not marker.exists() or marker.read_text(encoding="utf-8") != stamp:
        for folder in ("b", "g", "p"):
            if (out / folder).exists():
                shutil.rmtree(out / folder)
    marker.write_text(stamp, encoding="utf-8")
    _WORKER, _OUT = composer, out
    index, _ = composer._index
    _ = composer.japanese, composer.usage, composer.by_sequence, composer.twins
    _PLACES = sorted({p for p, _ in index})
    table = composer.layout.tables["all"]

    # Parity drawings first: the hosts the injected set uses join the export; the held-out set's do not.
    sets = {"injected": ([], []), "held_out": ([], [])}
    if parity or held_out:
        injected, held = parity_samples(composer, joyo or [], parity, held_out)
        sample = [("injected", item) for item in injected] + [("held_out", item) for item in held]
        pool = _pool(workers, DRAW_CHUNKS)
        items = [item for _, item in sample]
        results = pool.imap(_draw, items, chunksize=DRAW_CHUNK) if pool else map(_draw, items)
        for k, ((kind, _), (row, used)) in enumerate(zip(sample, results)):
            sets[kind][0].append(row)
            sets[kind][1].extend(used)
            if (k + 1) % 50 == 0:
                log(f"parity {k + 1}/{len(sample)}")
        if pool:
            pool.close()
            pool.join()
    _INJECT = {}
    for place, written, record in (u for u in sets["injected"][1] if u is not None):
        if only is None or written in only:
            held_hosts = _INJECT.setdefault((place, written), [])
            if not any(_same_host(record, h) for h in held_hosts):
                held_hosts.append(record)

    # Host lists, written by the workers; the parent keeps each list's entries and sizes.
    work = tasks(composer, only)
    work += [("host", place, written) for place, written in sorted(_INJECT) if (place, written) not in composer._index[0]]
    log(f"{len(work)} (place, operand) pairs to cut")
    lists: dict[tuple[str, str], set[tuple]] = {}
    sizes: dict[str, list[tuple[int, int]]] = {"records": [], "hosts": []}
    pool = _pool(workers, HOST_CHUNKS)
    for (_, place, written), ids, size in _run(pool, work, HOST_CHUNK, log, "hosts", 2000):
        if size is not None:
            lists[(place, written)] = set(ids)
            sizes["hosts"].append(size)
    if pool:
        pool.close()
        pool.join()

    # Records: every operand the index holds, every character a sequence describes, every
    # positional form, the parity drawings' leaves, every sequence the font draws, every operand of
    # the layout table and every operand with a host list.
    chars = {w for _, w in index if _leaf(w)} | set(composer.by_sequence.values())
    chars |= {form for forms in composer.forms.values() for form, _ in forms}
    chars |= {written for _, written in _INJECT if _leaf(written)}
    for rows, _ in sets.values():
        for row in rows:
            chars.update(c for c in row["s"] if not C._selector(c) and c not in C.BINARY | C.TERNARY | C.UNARY)
    chars = {c for c in chars if composer.font.has(c) or c in composer.sequences}
    seqs = set(composer.by_sequence)
    kids = {kid for _, kid in table.counts}
    listed = {written for _, written in lists}
    if only is not None:
        chars &= only
        seqs &= only
        kids &= only
    _EXTRA = {}
    for (place, kid) in sorted(table.counts):
        if kid in kids:
            mean, spread, count = table.usual(place, kid)
            _EXTRA.setdefault(kid, {}).setdefault("u", {})[place] = [_r(mean, 1), _r(spread, 2), int(count)]
    for seq in sorted(seqs):
        _EXTRA.setdefault(seq, {})["e"] = composer.by_sequence[seq]
    for place, written in sorted(lists):
        _EXTRA.setdefault(written, {}).setdefault("P", []).append(place)
    others = sorted((seqs | kids | listed) - chars)
    units = [("char", c) for c in sorted(chars)] + [("key", k) for k in others]
    log(f"{len(chars)} characters and {len(others)} other keys to record")
    pool = _pool(workers, RECORD_CHUNKS)
    for _task, _, size in _run(pool, units, RECORD_CHUNK, log, "records", 10000):
        sizes["records"].append(size)
    if pool:
        pool.close()
        pool.join()
    log("files written")

    stats = {kind: parity_stats(rows, used, lists) for kind, (rows, used) in sets.items() if rows}
    for kind, name in (("injected", "parity.json"), ("held_out", "parity-held-out.json")):
        if sets[kind][0]:
            (out / name).write_bytes(_parity_file(version, kind, sets[kind][0], stats[kind]))

    layout = layout_record(composer, layout_checks(composer))
    layout_bytes = _dump(layout)
    (out / "layout.json").write_bytes(layout_bytes)

    fonts = [_font_notice(C.font_file()), *(_font_notice(p) for p in C.fallback_files())]
    licence_dir = VOCAB.parent / "licences"
    ofl = "".join(f"{f['name']}: {f['copyright']}\n" for f in fonts) + "\n" + (licence_dir / "OFL-1.1.txt").read_text(encoding="utf-8")
    (out / "OFL.txt").write_text(ofl, encoding="utf-8")
    (out / "MIT-hfhchan-ids.txt").write_text((licence_dir / "hfhchan-ids-MIT.txt").read_text(encoding="utf-8"), encoding="utf-8")

    def summary(rows: list[tuple[int, int]]) -> dict:
        raw, gz = np.array([r[0] for r in rows] or [0]), np.array([r[1] for r in rows] or [0])
        return {"files": len(rows), "bytes": int(raw.sum()), "gzip": int(gz.sum()), "median_gzip": int(np.median(gz)),
                "p95_gzip": int(np.percentile(gz, 95)), "max_gzip": int(gz.max())}

    layout_gz = len(gzip.compress(layout_bytes, 9, mtime=0))
    parity_files = {kind: {"path": name, "rows": len(sets[kind][0]), "hosts_injected": kind == "injected", "stats": stats[kind]}
                    for kind, name in (("injected", "parity.json"), ("held_out", "parity-held-out.json")) if sets[kind][0]}
    manifest = {
        "format": FORMAT,
        "version": version,
        "composer": {"repository": "https://github.com/mkpoli/han-compose", "commit": commit, "dirty": dirty,
                     "layout_file": L.LAYOUT_FILE},
        "em": C.EM, "ascent": C.ASCENT, "heavy": C.HEAVY, "quant": QUANT,
        "constants": constants(composer),
        "constants_note": "tuple keys are joined with a comma: SHARES[('⿳', 3)] is SHARES['⿳,3']",
        "spelled": sorted(composer.spelled),
        "not_exported": NOT_EXPORTED,
        "paths": {
            "records": "g/{hh}/{sha256 hex of the key's UTF-8}.json: a character (with any variation selector) or a whole sequence",
            "hosts": "p/{hh}/{sha256 hex of UTF-8 place + TAB + operand}.json: the host list of an operand (a character or a whole sequence) in a place",
            "hh": "the hash's first two hex digits",
            "encoding": "every file under g/ and p/ is gzip-compressed JSON (mtime 0); serve it with Content-Encoding: gzip or decompress it",
            "missing": "a key or (place, operand) with no file has no record or no host the composer cuts cleanly",
            "format": "2.1 adds the stubs of uncut candidates to p/ lists (x 1); records and paths are as in 2",
            "rerun": ".export names the version, key set and parity sizes that wrote g/ and p/; a rerun with the same keeps their files and writes only the missing ones",
        },
        "record": {
            "k": "the record's key",
            "P": "the places that have a p/ host list for this key, sorted; absent when none has one",
            "G": "the key's own glyph: v 1 when the variable font draws it (its strokes can be weighted), else a fallback's, with w its measured stroke widths; every character a sequence describes has one",
            "b": "box (x0, y0, x1, y1), font units, y up",
            "p": "contours: [commands, light points, move to HEAVY], points int16 little-endian base64, x y interleaved, in 1/quant units",
            "commands": "M one point, L one point, Q<n> n points of a TrueType quadratic run (implied on-curve points between off-curve ones), Q<n>* when the contour closes on an implied point: it starts midway between the last and first",
            "s": "the character's sequence", "e": "the character a sequence describes (its own record holds G, a, s)", "at": "atomic: drawn whole",
            "hand": "which of 𠂇's strokes it writes first", "a": "positional forms by place, beyond itself",
            "ink": "Composer.ink: a character's outline length; for a sequence the sum over its operands",
            "nl": "outline count (Composer._outlines)",
            "o": "outline count the layout reads (compose_layout.outlines): a sequence's is that of the character it describes",
            "f": "shape features the layout reads (compose_layout.shape): a sequence's are those of the character it describes",
            "u": "layout table 'all' per place: [mean box, spread, count]",
            "hosts": "a p/ file: {place, operand, hosts}; each host: r its position in the index's list for that place and operand (Composer._index, which the kin and facing places slice to KIN_HOSTS and _instance to INSTANCE_HOSTS), h host, i operand index, op node operator, ok other operands' keys, si their ink, d depth, v variable font, j Japanese, n host ink, fr node frame, wh whole character, g gap, kv 1 when cut along KanjiVG's groups, then b, p, w as a part; ordered by v, then j, then d, then r. A list holds every entry _ranked may weigh: the first 32 of the variable font's and 32 of the fallbacks' in that order (16 each when a part is not placed in the em), and the first KIN_HOSTS in r order overall and of the variable font's; an entry the composer cannot cut is a stub: x 1, with r h i op ok si d v j and no piece (no n fr wh g kv b p w); _ranked takes its candidates before cutting them, so a stub uses up a place among the 32 (or 16) and is then skipped. A list with only stubs is not written",
            "parity rows": "c character, s sequence, x characters excluded while drawing it (it and its twins), face the em face under that exclusion, d SVG path (y down from ascent) or null with error, origins per part",
        },
        "files": {
            "layout": {"path": "layout.json", "bytes": len(layout_bytes), "gzip": layout_gz, "dtype": layout["dtype"]},
            "records": summary(sizes["records"]),
            "hosts": summary(sizes["hosts"]),
            **({"parity": parity_files} if parity_files else {}),
            "licences": ["OFL.txt", "MIT-hfhchan-ids.txt"],
        },
        "licences": {
            "code": {"licence": "MIT", "note": "han-compose's code, and a port of it"},
            "outlines": {"licence": "SIL OFL 1.1", "text": "OFL.txt",
                         "note": "Glyph outlines and the pieces cut from them (G, x) are the fonts' outline data under the SIL Open Font License 1.1, whose full text with each font's copyright line is OFL.txt. Noto Sans CJK JP reserves the font name 'Source'; Plangothic declares no Reserved Font Name.",
                         "fonts": fonts},
            "cuts": {"licence": "CC BY-SA 3.0", "attribution": KANJIVG_NOTICE, "url": "https://creativecommons.org/licenses/by-sa/3.0/",
                     "note": "Pieces marked kv 1 are cut along KanjiVG's component groups, and a drawing that uses one adapts KanjiVG's data: it is shared alike under CC BY-SA 3.0 with this notice. The hand forms (hand) are read from KanjiVG's stroke types and carry the same licence."},
            "sources": [
                {"fields": ["s", "e"], "name": "BabelStone IDS (IDS.TXT, file date 2025-06-27)", "author": "Andrew West (魏安)",
                 "url": "https://www.babelstone.co.uk/CJK/IDS.TXT", "licence": "public domain: its header states IDS sequences are facts not eligible for copyright and waives any claim to the file's format"},
                {"fields": ["s", "e", "spelled"], "name": "data/vocab/han-ids-drawn.tsv", "author": "han-compose",
                 "licence": "MIT", "note": "editorial sequences replacing the source's where its operands are not the shapes the glyph draws"},
                {"fields": ["a"], "name": "CJKVI Variants Database, radical-variants.txt", "author": "川幡太一",
                 "url": "https://github.com/cjkvi/cjkvi-variants/blob/e4f1da248c9737a243f9930b5dc497cef5d5ae16/radical-variants.txt",
                 "licence": "public domain"},
                {"fields": ["at"], "name": "hfhchan/ids v1.0.2 (ids-20240112.txt)", "attribution": "Copyright (c) 2021 Henry Chan, hfhchan/ids",
                 "url": "https://github.com/hfhchan/ids", "licence": "MIT", "text": "MIT-hfhchan-ids.txt",
                 "note": "only the list of characters it leaves undecomposed"},
                {"fields": ["x.kv", "hand"], "name": "KanjiVG r20260714", "attribution": KANJIVG_NOTICE, "licence": "CC BY-SA 3.0"},
            ],
        },
    }
    (out / "manifest.json").write_bytes(json.dumps(manifest, ensure_ascii=False, indent=1, sort_keys=True).encode("utf-8"))
    return manifest
