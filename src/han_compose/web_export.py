"""Everything a browser port of the composer needs to draw a sequence, written as static files.

`export` writes into one folder:

- `manifest.json`: the export's version (composer commit, style and layout file), the constants the
  composer draws with, the file scheme, the files' sizes, and the licence notices;
- `layout.json`: the learned layout's model on every character ("all", `SEEDS` networks), its
  weights quantized (`LAYOUT_DTYPES`), with the feature definition;
- `g/<hhh>.json`: the records of the keys (characters and sequences) whose SHA-256 starts with
  `hhh`, by that hash: a key's glyph outlines at weight 400 and the move to the style's heavy
  weight, its ink, its shape features and the layout table's statistics, its positional forms;
- `p/<hhh>.json`: the host lists of the (place, operand)s whose SHA-256 of place + TAB + operand
  starts with `hhh`, by that hash: the pieces host characters give that operand there, every host
  `Composer._ranked`, `_instance` and the kin and facing places may weigh, each cut by the composer
  (along KanjiVG's groups where it can).

`hhh` is the hash's first three hex digits, so each folder holds at most 4,096 shards. Every file
under `g/` and `p/` is gzip-compressed JSON, so a page fetches only the shards the operands of a
sequence fall in.

Workers write one file per record and per host list under `.work/` (`.work/g/<hh>/<sha256>.json`,
`.work/p/<hh>/<sha256>.json`), which a stopped run resumes from; `pack` builds the shards from them.
`.work/` is never published.

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
import zlib
from collections.abc import Iterable
from pathlib import Path

import numpy as np

from . import compose as C
from . import compose_layout as L

#: The export's own format; a change to any file's shape makes a new one. 4 is the style-aware
#: manifest without shards; 5 packs the records and host lists into shards.
FORMAT = 5
#: Shards are named by the hash's first `SHARD_DIGITS` hex digits.
SHARD_DIGITS = 3
SHARDS = 16 ** SHARD_DIGITS
#: The per-key files workers write, under the output folder.
WORK = ".work"
#: Outline coordinates are stored as int16 in units of 1 / `QUANT` font unit.
QUANT = 4
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


def hosts_hash(place: str, operand: str) -> str:
    """The SHA-256 a (place, operand)'s host list is filed under: of place + TAB + operand."""
    return key_hash(f"{place}\t{operand}")


def record_shard(key: str) -> str:
    """The shard holding a key's record: `g/<first three hex digits>.json`."""
    return f"g/{key_hash(key)[:SHARD_DIGITS]}.json"


def hosts_shard(place: str, operand: str) -> str:
    """The shard holding a (place, operand)'s host list: `p/<first three hex digits>.json`."""
    return f"p/{hosts_hash(place, operand)[:SHARD_DIGITS]}.json"


def record_work(key: str) -> str:
    """The file a worker writes a key's record to: `.work/g/<hh>/<sha256 hex>.json`."""
    h = key_hash(key)
    return f"{WORK}/g/{h[:2]}/{h}.json"


def hosts_work(place: str, operand: str) -> str:
    """The file a worker writes a (place, operand)'s host list to: `.work/p/<hh>/<sha256 hex>.json`."""
    h = hosts_hash(place, operand)
    return f"{WORK}/p/{h[:2]}/{h}.json"


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
    their move to the heavy weight (`HEAVY` in the constants), int16 in 1 / `QUANT` units, little-endian, x and y interleaved (an
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
        try:
            return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True).stdout.strip()
        except OSError:
            # No git on PATH: the commit is unknown, which no rerun resumes.
            return ""

    commit = git("rev-parse", "--short=12", "HEAD") or "unknown"
    dirty = bool(git("status", "--porcelain", "--", "src", "scripts", "data"))
    return commit, dirty


LICENCE_URLS = {C.OFL: "https://openfontlicense.org/open-font-license-official-text/",
                "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/"}
#: The licence texts an export carries, by licence, from `data/licences/`.
LICENCE_TEXTS = {C.OFL: ("OFL.txt", "OFL-1.1.txt"), "CC0 1.0": ("CC0.txt", "CC0-1.0.txt")}


def _font_notice(path: Path, licence: str) -> dict:
    from fontTools.ttLib import TTFont

    names = TTFont(path, lazy=True)["name"]
    name = lambda i: str(names.getName(i, 3, 1, 0x409) or "")
    return {"name": name(1), "version": name(5).split(";")[0], "copyright": name(0), "trademark": name(7),
            "licence": licence, "licence_url": LICENCE_URLS[licence], "file": path.name}


def constants(composer: C.Composer) -> dict:
    """Every module constant of `compose` the composer draws with, by name, the style's (`STEM_CURVE`,
    `HEAVY`, `GROW_Y`), and the font's stems and face: (width at 400, width at heavy) of 丨 across x
    and 一 across y."""
    out = {}
    for name in dir(C):
        if not name.isupper() or name.startswith("_") or name.endswith(("_URL", "_SHA256", "_FILE")) or name in ("STYLES", "DEFAULT_STYLE", "OFL"):
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
    style = composer.font.style
    out["STEM_CURVE"] = [list(v) for v in style.stem_curve]
    out["HEAVY"] = style.heavy
    out["GROW_Y"] = round(composer.font.grow_y, 3)
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


def layout_record(composer: C.Composer, checks: list[tuple[str, list[str]]], file: str = L.LAYOUT_FILE) -> dict:
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
        "file": file, "model": "all", "dtype": dtype, "error_against_float32": errors, "checked": len(checks),
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


def cut_record(composer: C.Composer, entry: tuple, host: C.Host | None) -> dict | None:
    """An entry's cut: None when `_host_node` does not cut it cleanly; else the piece as the indices
    `k` of the host glyph's contours it keeps (its outlines `p` instead, should a piece hold a
    contour its glyph does not), its box `b`, the node's frame `fr`, whether the node is the whole
    character `wh`, the pieces' gap `g`, and `kv` 1 when KanjiVG's groups cut it."""
    if host is None:
        return None
    char, tree, path, i = entry
    piece = host.pieces[i]
    at = {id(c): k for k, c in enumerate(composer.font.glyph(char).contours)}
    out = {"b": _r(piece.box), "fr": _r(host.frame), "wh": int(host.whole), "g": round(float(host.gap), 2)}
    indices = [at.get(id(c)) for c in piece.contours]
    if None in indices:
        out.update(part_record(piece))
    else:
        out["k"] = indices
    kvg = composer.kvg.host_node(char, tree, path) if composer.kvg is not None else None
    if kvg is not None and [[id(c) for c in p.contours] for p in kvg.pieces] == [[id(c) for c in p.contours] for p in host.pieces]:
        out["kv"] = 1
    return out


def entry_record(composer: C.Composer, entry: tuple, rank: int, host: C.Host | None) -> dict:
    """One index entry for an operand in a place, with what `Composer._ranked` weighs it by: `r` its
    position in the index's list, `h` the host, `i` the operand's index in the node, `op` the node's
    operator and `ok` the other operands' keys (for an exact match), `si` their ink, `d` the node's
    depth, `v` whether the variable font draws the host, `j` whether Japan writes it, `hd` the hand
    the hand filter reads (when it has one), and `c` its cut (`cut_record`)."""
    char, tree, path, i = entry
    here = _here(tree, path)
    record = {"r": rank, "h": char, "i": i, "op": here[0], "ok": [C.key(n) for k, n in enumerate(here[1:]) if k != i],
              "si": round(_sibling_ink(composer, entry), 1), "d": len(path), "v": int(composer.font.own(char)),
              "j": int(char in composer.japanese), "c": cut_record(composer, entry, host)}
    hand = composer.hands.get(composer.by_sequence.get(C.key(here), char if not path else ""))
    if hand is not None:
        record["hd"] = hand
    return record


def hosts_for(composer: C.Composer, place: str, written: str) -> list[dict]:
    """Every index entry for (place, operand), in the index's order, each cut as `_host_node` cuts it."""
    index, _ = composer._index
    return [entry_record(composer, entry, rank, composer._host_node(entry[0], entry[1], entry[2]))
            for rank, entry in enumerate(index.get((place, written), []))]


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


#: The blocks of alphabetic scripts whose letters and digits stand as operands of their own (a ligature
#: such as ⿸广⿰KO): Latin with IPA, Greek, Cyrillic, Hangul jamo, Latin and Greek additions, kana,
#: Hangul compatibility jamo, katakana extensions, jamo extensions, Hangul syllables, the full- and
#: half-width forms, and the kana supplements.
LETTER_BLOCKS = ((0x0000, 0x02AF), (0x0370, 0x052F), (0x1100, 0x11FF), (0x1E00, 0x1FFF), (0x3040, 0x30FF),
                 (0x3130, 0x318F), (0x31F0, 0x31FF), (0xA960, 0xA97F), (0xAC00, 0xD7FF), (0xFF00, 0xFFEF),
                 (0x1B000, 0x1B16F))
#: Hangul fillers: letters by category that draw nothing.
FILLERS = frozenset({0x115F, 0x1160, 0x3164, 0xFFA0})


def letters(font: C.Font) -> set[str]:
    """Every letter (category L) and decimal digit in `LETTER_BLOCKS` the style's fonts draw, the
    Hangul fillers left out."""
    import unicodedata

    out = set()
    for lo, hi in LETTER_BLOCKS:
        for point in range(lo, hi + 1):
            char, category = chr(point), unicodedata.category(chr(point))
            if point not in FILLERS and (category == "Nd" or category[0] == "L") and font.has(char):
                out.add(char)
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
#: Pool renewal: a worker's composer caches every cut and glyph it has read (about 0.4 MB per index
#: entry it cuts; 訁 on the left, 1,168 entries, grows one by 470 MB), so it is replaced after this
#: many chunks (`maxtasksperchild` counts chunks).
HOST_CHUNK, HOST_CHUNKS = 1, 25
RECORD_CHUNK, RECORD_CHUNKS = 16, 100
DRAW_CHUNK, DRAW_CHUNKS = 2, 25


def _replace(target: Path, data: bytes, sync: bool = True) -> None:
    """Write `data` to `target` through a `.part` file renamed into place (synced first when
    `sync`), so a stop leaves the old file whole."""
    import os

    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_suffix(".part")
    with open(partial, "wb") as f:
        f.write(data)
        if sync:
            f.flush()
            os.fsync(f.fileno())
    partial.replace(target)


def _write_gzip(target: Path, value, sync: bool = True) -> tuple[int, int]:
    """Write `value` as gzip-compressed JSON (mtime 0, level 9) through `_replace`: (raw, gzip)
    bytes."""
    data = _dump(value)
    packed = gzip.compress(data, 9, mtime=0)
    _replace(target, packed, sync)
    return len(data), len(packed)


def _write(path: str, value) -> tuple[int, int]:
    """Write `value` under the output folder (`_write_gzip`)."""
    return _write_gzip(_OUT / path, value)


def _existing(path: str) -> tuple[dict, tuple[int, int]] | None:
    """A file a stopped run already wrote, read back with its sizes; a truncated or unreadable one
    is deleted and counts as missing."""
    target = _OUT / path
    if not target.exists():
        return None
    try:
        packed = target.read_bytes()
        data = gzip.decompress(packed)
        return json.loads(data), (len(data), len(packed))
    except (OSError, EOFError, ValueError, zlib.error):
        target.unlink(missing_ok=True)
        return None


def _cuts(hosts: list[dict]) -> dict[tuple, tuple | None]:
    """The entries the export itself cuts, by (h, i, r): the contour indices kept, or None for a
    piece stored as its own outlines. Pieces only a parity drawing cut (`pc`) are left out."""
    return {(h["h"], h["i"], h["r"]): (tuple(h["c"]["k"]) if "k" in h["c"] else None)
            for h in hosts if h["c"] is not None and not h.get("pc")}


def _work(task: tuple[str, ...]):
    """One unit of the export, run in a worker forked from the exporting process; it writes its own
    file and returns only what the parent counts. A file a stopped run wrote is kept."""
    kind = task[0]
    if kind == "host":
        place, written = task[1], task[2]
        path = hosts_work(place, written)
        found = _existing(path)
        if found is not None:
            return task, _cuts(found[0]["hosts"]), found[1]
        hosts = hosts_for(_WORKER, place, written)
        by_id = {(h["h"], h["i"], h["r"]): k for k, h in enumerate(hosts)}
        for record in _INJECT.get((place, written), []):
            # An entry only a parity drawing cut, under its own exclusion, takes that drawing's piece.
            k = by_id.get((record["h"], record["i"], record["r"]))
            if k is not None and hosts[k]["c"] is None and record["c"] is not None:
                hosts[k] = {**record, "pc": 1}
        if not hosts:
            return task, {}, None
        return task, _cuts(hosts), _write(path, {"place": place, "operand": written, "hosts": hosts})
    key = task[1]
    path = record_work(key)
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
                used.append((where, written, entry_record(composer, entry, rank, found[0])))
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


def parity_stats(rows: list[dict], used: list, lists: dict[tuple[str, str], dict[tuple, tuple | None]] | None = None) -> dict:
    """How a parity set was drawn: rows drawn, part origins by kind, rows using a path the export does
    not carry, and hosts used. Given the host lists: `hosts_in_export`, how many of those hosts the
    export itself cuts (a piece only a parity drawing supplied does not count), and
    `hosts_same_piece`, how many of these it cuts into the very contours the drawing used."""
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
        held = [(lists.get((place, written), {}), (record["h"], record["i"], record["r"]), record) for place, written, record in hosts]
        present = [(cuts[ident], record) for cuts, ident, record in held if ident in cuts]
        out["hosts_in_export"] = len(present)
        out["hosts_same_piece"] = sum(k is not None and record["c"] is not None and tuple(record["c"].get("k", ())) == k
                                      for k, record in present)
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


#: What each field of a record and of a host list means, as the manifest states it.
RECORD = {
    "k": "the record's key",
    "P": "the places that have a host list in p/ for this key, sorted; absent when none has one",
    "G": "the key's own glyph: v 1 when the variable font draws it (its strokes can be weighted), else a fallback's, with w its measured stroke widths; every character a sequence describes has one",
    "b": "box (x0, y0, x1, y1), font units, y up",
    "p": "contours: [commands, light points, move to constants.HEAVY], points int16 little-endian base64, x y interleaved, in 1/quant units",
    "commands": "M one point, L one point, Q<n> n points of a TrueType quadratic run (implied on-curve points between off-curve ones), Q<n>* when the contour closes on an implied point: it starts midway between the last and first",
    "s": "the character's sequence", "e": "the character a sequence describes (its own record holds G, a, s)", "at": "atomic: drawn whole",
    "hand": "which of 𠂇's strokes it writes first", "a": "positional forms by place, beyond itself",
    "ink": "Composer.ink: a character's outline length; for a sequence the sum over its operands",
    "nl": "outline count (Composer._outlines)",
    "o": "outline count the layout reads (compose_layout.outlines): a sequence's is that of the character it describes",
    "f": "shape features the layout reads (compose_layout.shape): a sequence's are those of the character it describes",
    "u": "layout table 'all' per place: [mean box, spread, count]",
    "hosts": "a host list in a p/ shard: {place, operand, hosts}: every entry of Composer._index for that place and operand, in its order. Each entry: r its position there (the kin and facing places slice the list to KIN_HOSTS, _instance to INSTANCE_HOSTS), h host, i operand index, op node operator, ok other operands' keys, si their ink, d depth, v 1 when the variable font draws the host, j 1 when Japan writes it, hd the hand (丿 or 一) the hand filter compares when the host has one, and c its cut. c is null when _host_node does not cut the entry cleanly; else {k the indices of the host glyph's contours (the host's G in its record) the piece keeps, b the piece's box, fr the node's frame, wh 1 for the whole character, g the pieces' gap, kv 1 when cut along KanjiVG's groups}, with p (and w) its own outlines in place of k for a piece holding a contour its glyph does not. pc 1 marks a cut only a parity drawing made, under its own exclusion. A port ranks the whole list against the target as _ranked does (exact, alien, sibling-ink ratio, depth), takes its caps (32 of the variable font's and 32 of the fallbacks' for a part placed in the em, 16 each otherwise) before cutting, so an entry with c null still takes a place, and draws a chosen entry's piece from its host's G",
    "parity rows": "c character, s sequence, x characters excluded while drawing it (it and its twins), face the em face under that exclusion, d SVG path (y down from ascent) or null with error, origins per part",
}

#: The file scheme, as the manifest states it.
PATHS = {
    "records": "g/{hhh}.json: {sha256 hex of the key's UTF-8: record}, the records of every key (a character with any variation selector, or a whole sequence) whose hash starts with hhh",
    "hosts": "p/{hhh}.json: {sha256 hex of UTF-8 place + TAB + operand: host list}, the host lists of every operand (a character or a whole sequence) in a place whose hash starts with hhh",
    "hhh": "the hash's first three hex digits: at most 4,096 shards in each of g/ and p/",
    "encoding": "every file under g/ and p/ is gzip-compressed JSON (mtime 0, keys sorted); serve it with Content-Encoding: gzip or decompress it",
    "missing": "a key or (place, operand) absent from its shard, or whose shard is absent, has no record or no host the composer cuts cleanly",
    "work": ".work/g/{hh}/{sha256}.json and .work/p/{hh}/{sha256}.json are the per-key files the export's workers write and pack builds the shards from. .work/ must never be uploaded: each of its files is one more object written (rclone copy --exclude '.work/**')",
    "rerun": ".export names the version, the layout, font and KanjiVG hashes, the key set and the parity sizes that wrote the folder; a rerun with the same, from a known clean commit, keeps the .work/ files and writes only the missing ones, then packs every shard afresh; anything else starts afresh. .complete is written last, after manifest.json and the shards",
}

#: What the outline data of each style's export is under.
OUTLINE_NOTES = {
    "sans": "Glyph outlines (G in g/ records) and the pieces host-list entries name by their contours' indices (c.k, or c.p where a piece holds its own outlines) are the fonts' outline data under the SIL Open Font License 1.1, whose full text with each font's copyright line is OFL.txt. Noto Sans CJK JP reserves the font name 'Source'; Plangothic declares no Reserved Font Name.",
    "serif": "Glyph outlines (G in g/ records) and the pieces host-list entries name by their contours' indices (c.k, or c.p where a piece holds its own outlines) are the fonts' outline data. Noto Serif CJK JP's are under the SIL Open Font License 1.1, whose full text with its copyright line is OFL.txt; its copyright line names no Reserved Font Name. Jigmo's (a record's G with v 0) are dedicated to the public domain under CC0 1.0 (CC0.txt), drawn from GlyphWiki by its contributors.",
}


def export(composer: C.Composer, out: Path, joyo: list[str] | None = None, parity: int = 0, held_out: int = 0,
           only: set[str] | None = None, pairs: set[tuple[str, str]] | None = None, workers: int = 1,
           root: Path | None = None, log=print) -> dict:
    """Write the export into `out` and return its manifest. `only` limits it to those keys, and
    `pairs` its host lists to those (place, operand)s (tests).
    Workers write each record and host list under `.work/` as they finish; a rerun of the same
    version into the same folder keeps those files and writes only the rest. `pack` then builds the
    shards from them."""
    global _WORKER, _PLACES, _OUT, _INJECT, _EXTRA
    import shutil

    from .vocab import ROOT, VOCAB

    root = root or ROOT
    commit, dirty = _version(root)
    style = composer.font.style
    layout_file = L.layout_file(style.name)
    version = f"{commit}{'+dirty' if dirty else ''}-{style.name}-{Path(layout_file).stem}-f{FORMAT}"
    sources = (style.font, *style.fallbacks)
    inputs = _inputs(composer)
    out.mkdir(parents=True, exist_ok=True)
    complete = out / ".complete"
    complete.unlink(missing_ok=True)
    # Files of another version, other inputs, another key set, a dirty tree or an unknown commit are
    # never kept: the folder starts afresh, manifest and layout and parity included.
    marker = out / ".export"
    stamp = json.dumps({"version": version, **inputs, "only": sorted(only) if only is not None else None,
                        "pairs": sorted(pairs) if pairs is not None else None,
                        "parity": parity, "held_out": held_out}, ensure_ascii=False, sort_keys=True)
    if dirty or commit == "unknown" or not marker.exists() or marker.read_text(encoding="utf-8") != stamp:
        for folder in (WORK, "g", "p"):
            if (out / folder).exists():
                shutil.rmtree(out / folder)
        for name in ("manifest.json", "layout.json", "parity.json", "parity-held-out.json", "OFL.txt", "CC0.txt", "MIT-hfhchan-ids.txt"):
            (out / name).unlink(missing_ok=True)
    for name, wanted in (("parity.json", parity), ("parity-held-out.json", held_out)):
        if not wanted:
            (out / name).unlink(missing_ok=True)
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
    work = [t for t in tasks(composer, only) if pairs is None or (t[1], t[2]) in pairs]
    work += [("host", place, written) for place, written in sorted(_INJECT) if (place, written) not in composer._index[0]]
    log(f"{len(work)} (place, operand) pairs to cut")
    lists: dict[tuple[str, str], dict[tuple, tuple | None]] = {}
    sizes: dict[str, list[tuple[int, int]]] = {"records": [], "hosts": []}
    pool = _pool(workers, HOST_CHUNKS)
    for (_, place, written), cuts, size in _run(pool, work, HOST_CHUNK, log, "hosts", 2000):
        if size is not None:
            lists[(place, written)] = cuts
            sizes["hosts"].append(size)
    split = sum(1 for cuts in lists.values() for k in cuts.values() if k is None)
    if pool:
        pool.close()
        pool.join()

    # Records: every operand the index holds, every character a sequence describes, every
    # positional form, the parity drawings' leaves, every sequence the font draws, every operand of
    # the layout table, every operand with a host list, and every letter the fonts draw (`letters`).
    chars = {w for _, w in index if _leaf(w)} | set(composer.by_sequence.values()) | letters(composer.font)
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
    # Every host a list cuts: a port draws a chosen entry's piece from its host's glyph.
    chars |= {h for cuts in lists.values() for h, _, _ in cuts}
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

    layout = layout_record(composer, layout_checks(composer), layout_file)
    layout_bytes = _dump(layout)
    (out / "layout.json").write_bytes(layout_bytes)

    fonts = [_font_notice(C._fetched(source, None), source.licence) for source in sources]
    licence_dir = VOCAB.parent / "licences"
    texts = []
    for licence, (name, text) in LICENCE_TEXTS.items():
        held = [f for f in fonts if f["licence"] == licence]
        if held:
            notices = "".join(f"{f['name']}: {f['copyright'] or f['version']}\n" for f in held)
            (out / name).write_text(notices + "\n" + (licence_dir / text).read_text(encoding="utf-8"), encoding="utf-8")
            texts.append(name)
    (out / "MIT-hfhchan-ids.txt").write_text((licence_dir / "hfhchan-ids-MIT.txt").read_text(encoding="utf-8"), encoding="utf-8")

    layout_gz = len(gzip.compress(layout_bytes, 9, mtime=0))
    parity_files = {kind: {"path": name, "rows": len(sets[kind][0]), "hosts_injected": kind == "injected", "stats": stats[kind]}
                    for kind, name in (("injected", "parity.json"), ("held_out", "parity-held-out.json")) if sets[kind][0]}
    manifest = {
        "format": FORMAT,
        "version": version,
        "composer": {"repository": "https://github.com/mkpoli/han-compose", "commit": commit, "dirty": dirty,
                     "style": style.name, "layout_file": layout_file, **inputs},
        "style": style.name,
        "em": C.EM, "ascent": C.ASCENT, "heavy": style.heavy, "quant": QUANT,
        "constants": constants(composer),
        "constants_note": "tuple keys are joined with a comma: SHARES[('⿳', 3)] is SHARES['⿳,3']",
        "spelled": sorted(composer.spelled),
        "not_exported": NOT_EXPORTED,
        "paths": PATHS,
        "record": RECORD,
        "files": {
            "layout": {"path": "layout.json", "bytes": len(layout_bytes), "gzip": layout_gz, "dtype": layout["dtype"]},
            "records": _summary(sizes["records"]),
            "hosts": {**_summary(sizes["hosts"]), "entries_cut": sum(len(c) for c in lists.values()),
                      "pieces_with_own_outlines": split},
            **({"parity": parity_files} if parity_files else {}),
            "licences": [*texts, "MIT-hfhchan-ids.txt"],
        },
        "licences": {
            "code": {"licence": "MIT", "note": "han-compose's code, and a port of it"},
            "outlines": {"licence": " and ".join(sorted({f["licence"] for f in fonts})), "texts": texts,
                         "note": OUTLINE_NOTES[style.name], "fonts": fonts},
            "cuts": {"licence": "CC BY-SA 3.0", "attribution": KANJIVG_NOTICE, "url": "https://creativecommons.org/licenses/by-sa/3.0/",
                     "note": "A host-list entry whose cut has kv 1 (p/ hosts[].c.kv) is cut along KanjiVG's component groups, and a drawing that uses one adapts KanjiVG's data: it is shared alike under CC BY-SA 3.0 with this notice. The hand forms (hand) are read from KanjiVG's stroke types and carry the same licence."},
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
                {"fields": ["p/ hosts[].c.kv", "hand", "p/ hosts[].hd"], "name": "KanjiVG r20260714", "attribution": KANJIVG_NOTICE, "licence": "CC BY-SA 3.0"},
            ],
        },
    }
    _write_manifest(out, manifest)
    manifest = pack(out, root, log)
    complete.write_text(manifest["version"], encoding="utf-8")
    return manifest


#: Where `add` lists the shards its records fall in, for `pack` to rebuild alone.
PENDING = f"{WORK}/pending.json"
#: Characters `add` redraws to show this commit writes the records the folder's own commit wrote.
PROBE = 40


class AddError(ValueError):
    """A folder `add` cannot write into, or a commit whose records differ from the folder's."""


def _inputs(composer: C.Composer) -> dict:
    from . import kanjivg_cuts
    from .vocab import cache_root

    style = composer.font.style
    layout_path = getattr(composer.layout, "path", None) or (cache_root() / "compose" / L.layout_file(style.name))
    return {"layout_sha256": hashlib.sha256(Path(layout_path).read_bytes()).hexdigest() if Path(layout_path).exists() else None,
            "font_sha256": {source.file: source.sha256 for source in (style.font, *style.fallbacks)},
            "kanjivg_sha256": {kanjivg_cuts.KANJIVG_FILE: kanjivg_cuts.KANJIVG_SHA256}}


def add(composer: C.Composer, out: Path, keys: Iterable[str], name: str, root: Path | None = None,
        dry_run: bool = False, log=print) -> dict:
    """Write records for `keys` (characters, each with any variation selector) into a finished
    export, so that a folder already published need not be exported again for them. Only keys with
    no record yet are written, under `.work/`, and the shards they fall in are listed in
    `PENDING` for `pack` to rebuild alone; the manifest's `added` names the commit, the set (`name`)
    and the count.

    The records must be those the folder's own commit would have written: the fonts, layout and
    KanjiVG must hash as the folder's stamp records, the checkout must be clean, and `PROBE`
    characters the folder already holds are recorded again and must come out the same, else
    `AddError`. A key whose record would carry what the parent export adds (host lists, layout
    table statistics, a sequence's character) is refused too: those come from the index, which
    adding records never changes. `dry_run` checks everything and writes nothing. Returns
    `{"keys", "new", "shards", "probe"}`: the keys asked for, those written, the shards they
    fall in, and how many characters the probe redrew."""
    global _OUT
    from .vocab import ROOT

    commit, dirty = _version(root or ROOT)
    if dirty or commit == "unknown":
        raise AddError("records are added only from a known, clean commit")
    marker, manifest_path = out / ".export", out / "manifest.json"
    if not (out / ".complete").exists() or not marker.exists() or not manifest_path.exists():
        raise AddError(f"{out} is not a finished export")
    if (out / PENDING).exists() and not dry_run:
        raise AddError(f"{out / PENDING} is waiting for export-web-pack")
    stamp = json.loads(marker.read_text(encoding="utf-8"))
    inputs = _inputs(composer)
    for field, value in inputs.items():
        if stamp.get(field) != value:
            raise AddError(f"{field} differs from the folder's: {stamp.get(field)} against {value}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("style") != composer.font.style.name:
        raise AddError(f"the folder is the {manifest.get('style')} style, the composer {composer.font.style.name}")

    index, _ = composer._index
    places = sorted({p for p, _ in index})
    table = composer.layout.tables["all"]
    shapes: dict = {}
    _OUT = out
    # The probe: characters the folder holds, recorded again by this commit.
    held = sorted(c for c in set(composer.by_sequence.values()) if (out / record_work(c)).exists())
    probe = random.Random(0).sample(held, min(PROBE, len(held)))
    if not probe:
        raise AddError(f"{out} holds no character to check this commit's records against")
    for char in probe:
        mine = {"k": char, **char_record(composer, char, places, table, shapes)}
        theirs = {k: v for k, v in _read_work(out / record_work(char)).items() if k not in ("u", "e", "P")}
        if theirs != mine:
            raise AddError(f"{char}'s record differs from the folder's: this commit does not write the records it holds")
    wanted = sorted(set(keys))
    kids = {kid for _, kid in table.counts}
    for key in wanted:
        if not _leaf(key) or not composer.font.has(key):
            raise AddError(f"{key!r} is not a character the fonts draw")
        if key in kids or any((place, key) in index for place in places) or key in composer.by_sequence:
            raise AddError(f"{key} has data from the index; only a full export records it")
    new = [key for key in wanted if not (out / record_work(key)).exists()]
    shards = sorted({record_shard(key) for key in new})
    log(f"{len(wanted)} keys, {len(new)} without a record, in {len(shards)} shards (probe of {len(probe)} matched)")
    if dry_run or not new:
        return {"keys": len(wanted), "new": len(new), "shards": shards, "probe": len(probe)}
    # Each shard as it is before: pack counts a shard changed against these.
    before = {}
    for shard in shards:
        packed = (out / shard).read_bytes() if (out / shard).exists() else None
        data = gzip.decompress(packed) if packed is not None else b"{}"
        before[shard] = {"sha256": hashlib.sha256(packed).hexdigest() if packed is not None else None,
                         "bytes": len(data) if packed is not None else 0, "entries": len(json.loads(data))}
    (out / ".complete").unlink(missing_ok=True)
    for k, key in enumerate(new):
        _write(record_work(key), {"k": key, **char_record(composer, key, places, table, shapes)})
        if (k + 1) % 2000 == 0:
            log(f"added {k + 1}/{len(new)}")
    manifest.setdefault("added", []).append({"set": name, "commit": commit, "keys": len(new), "probe": len(probe)})
    _write_manifest(out, manifest)
    _replace(out / PENDING, _dump({"shards": before, **{k: manifest["files"]["records"][k] for k in ("bytes", "entries")}}))
    return {"keys": len(wanted), "new": len(new), "shards": shards, "probe": len(probe)}


def _write_manifest(out: Path, manifest: dict) -> None:
    _replace(out / "manifest.json", json.dumps(manifest, ensure_ascii=False, indent=1, sort_keys=True).encode("utf-8"))


def _summary(rows: list[tuple[int, int]]) -> dict:
    raw, gz = np.array([r[0] for r in rows] or [0]), np.array([r[1] for r in rows] or [0])
    return {"files": len(rows), "bytes": int(raw.sum()), "gzip": int(gz.sum()), "median_gzip": int(np.median(gz)),
            "p95_gzip": int(np.percentile(gz, 95)), "max_gzip": int(gz.max())}


class WorkFileError(ValueError):
    """A per-key file under `.work/` that cannot be read back."""


def _sync_dir(path: Path) -> None:
    import os

    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def _read_work(path: Path):
    try:
        return json.loads(gzip.decompress(path.read_bytes()))
    except (OSError, EOFError, ValueError, zlib.error) as error:
        raise WorkFileError(f"{path}: unreadable work file ({error}); delete it and rerun export-web to write it again") from error


def pack(out: Path, root: Path | None = None, log=print, changed: list[str] | None = None) -> dict:
    """Build `g/` and `p/` shards in `out` from the per-key files under `.work/`, and bring the folder
    to this format: `manifest.json` gets `paths`, `record`, the per-shard `files` summaries,
    `format`, the version's format suffix and `pack` (the commit pack ran at, the shard count);
    the parity files and `.export` get the manifest's version. Each folder's shards are built and
    synced beside it and replace it whole, so an unreadable work file or a work folder that is not
    there (`WorkFileError`) stops the pack before the manifest. Returns the manifest.

    After `add`, only the shards `PENDING` lists are rebuilt (`_pack_pending`), and `changed`
    receives those whose bytes differ: the files to upload."""
    import re
    import shutil

    from .vocab import ROOT

    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    commit, dirty = _version(root or ROOT)
    version = re.sub(r"-f\d+$", f"-f{FORMAT}", manifest["version"])
    # A work folder that was never moved, or was moved elsewhere, would otherwise pack as empty.
    for folder, kind in (("g", "records"), ("p", "hosts")):
        summary = manifest["files"].get(kind, {})
        expected = summary.get("entries", summary.get("files"))
        if expected and not (out / WORK / folder).is_dir():
            raise WorkFileError(f"{out / WORK / folder} is missing, but the manifest records {expected}")
    if (out / PENDING).exists():
        return _pack_pending(out, manifest, log, changed if changed is not None else [])
    for folder in ("g", "p"):
        files: dict[str, list[Path]] = {}
        for path in (out / WORK / folder).glob("*/*.json"):
            files.setdefault(path.stem[:SHARD_DIGITS], []).append(path)
        building = out / f".pack-{folder}"
        if building.exists():
            shutil.rmtree(building)
        building.mkdir()
        sizes = []
        for k, shard in enumerate(sorted(files)):
            entries = {path.stem: _read_work(path) for path in files[shard]}
            sizes.append(_write_gzip(building / f"{shard}.json", entries))
            if (k + 1) % 1000 == 0:
                log(f"pack {folder} {k + 1}/{len(files)}")
        _sync_dir(building)
        if (out / folder).exists():
            shutil.rmtree(out / folder)
        building.rename(out / folder)
        kind = "records" if folder == "g" else "hosts"
        manifest["files"][kind] = {**manifest["files"].get(kind, {}), **_summary(sizes),
                                   "entries": sum(len(v) for v in files.values())}
    for name in ("parity.json", "parity-held-out.json"):
        if (out / name).exists():
            parity = json.loads((out / name).read_text(encoding="utf-8"))
            parity["version"] = version
            _replace(out / name, _dump(parity))
    marker = out / ".export"
    if marker.exists():
        stamp = json.loads(marker.read_text(encoding="utf-8"))
        stamp["version"] = version
        _replace(marker, json.dumps(stamp, ensure_ascii=False, sort_keys=True).encode("utf-8"))
    manifest["format"] = FORMAT
    manifest["version"] = version
    manifest["paths"] = PATHS
    manifest["record"] = RECORD
    manifest["pack"] = {"commit": f"{commit}{'+dirty' if dirty else ''}", "shards": SHARDS}
    _write_manifest(out, manifest)
    _sync_dir(out)
    return manifest


def _pack_pending(out: Path, manifest: dict, log, changed: list[str]) -> dict:
    """Rebuild the record shards `PENDING` lists from their work files, each replaced on its own,
    note in `changed` those whose bytes differ from what they were before `add` (so a stopped run
    rerun counts the same), bring the records' summary up to date (gzip figures from every shard's
    size, raw bytes and entries against `PENDING`'s figures from before) and set the last `added`
    entry's `shards` to the count changed. The version stays: no record the folder held changes."""
    pending = json.loads((out / PENDING).read_text(encoding="utf-8"))
    summary = dict(manifest["files"]["records"])
    raw = entries = 0
    for k, (shard, before) in enumerate(sorted(pending["shards"].items())):
        h = Path(shard).stem
        records = {path.stem: _read_work(path) for path in sorted((out / WORK / "g" / h[:2]).glob(f"{h}*.json"))}
        data = _dump(records)
        packed = gzip.compress(data, 9, mtime=0)
        target = out / shard
        if not target.exists() or target.read_bytes() != packed:
            _replace(target, packed)
        if hashlib.sha256(packed).hexdigest() != before["sha256"]:
            changed.append(shard)
        raw += len(data) - before["bytes"]
        entries += len(records) - before["entries"]
        if (k + 1) % 500 == 0:
            log(f"pack {k + 1}/{len(pending['shards'])}")
    _sync_dir(out / "g")
    gz = np.array(sorted(path.stat().st_size for path in (out / "g").glob("*.json")) or [0])
    summary.update({"files": len(list((out / "g").glob("*.json"))), "gzip": int(gz.sum()), "median_gzip": int(np.median(gz)),
                    "p95_gzip": int(np.percentile(gz, 95)), "max_gzip": int(gz.max()),
                    "bytes": pending["bytes"] + raw, "entries": pending["entries"] + entries})
    manifest["files"]["records"] = summary
    if manifest.get("added"):
        manifest["added"][-1]["shards"] = len(changed)
    _write_manifest(out, manifest)
    (out / PENDING).unlink()
    _sync_dir(out)
    log(f"{len(changed)} of {len(pending['shards'])} shards changed")
    return manifest
