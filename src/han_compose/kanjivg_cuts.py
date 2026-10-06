"""Cutting a drawn character into its operands along KanjiVG's component groups.

KanjiVG (Copyright (C) 2009-2013 Ulrich Apel, CC BY-SA 3.0, https://kanjivg.tagaini.net/;
`data/sources/kanjivg.yaml`) draws each stroke of a Japanese kanji as a centreline path and nests
the strokes in groups named by the component they form (`kvg:element`) and where it stands
(`kvg:position`). Each outline of the font's glyph is matched to the strokes whose centrelines run
inside it, so an operand's piece is exactly the outlines of its strokes: no stroke is taken from a
neighbour or left behind.

The release file is fetched and checked like the fonts (`kanjivg_file`). Glyphs drawn from these
cuts adapt KanjiVG's component data and are shared alike under CC BY-SA.
"""

from __future__ import annotations

import gzip
import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import numpy as np

from . import compose as C

KVG = "{http://kanjivg.tagaini.net}"
KANJIVG_URL = "https://github.com/KanjiVG/kanjivg/releases/download/r20260714/kanjivg-20260714.xml.gz"
KANJIVG_SHA256 = "d4a8e5e11533fe6a5d81a158b2c153964322641d2982c90a919461f3c06dca6b"
KANJIVG_FILE = "kanjivg-20260714.xml.gz"
#: Share of a stroke's centreline that must lie inside an outline for the outline to hold it.
INSIDE = 0.6
#: Raster size an outline is filled at to test centreline points, and the pixels it is grown by.
SIZE, GROW = 160, 2


@dataclass
class Group:
    element: str | None
    position: str | None
    strokes: list[int] = field(default_factory=list)
    groups: list["Group"] = field(default_factory=list)

    def all_strokes(self) -> list[int]:
        out = list(self.strokes)
        for g in self.groups:
            out.extend(g.all_strokes())
        return sorted(out)

    def walk(self):
        yield self
        for g in self.groups:
            yield from g.walk()


@dataclass
class Entry:
    root: Group
    paths: list[np.ndarray]  # sampled centreline per stroke, 109 box, y down


_NUM = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")


def sample_path(d: str, steps: int = 12) -> np.ndarray:
    """Points along an SVG path of M, L, C, S commands (absolute or relative), as KanjiVG writes them."""
    tokens = re.findall(r"[MmLlCcSsZzHhVv]|" + _NUM.pattern, d)
    pts, cur, start, last_ctrl, cmd, i = [], np.zeros(2), np.zeros(2), None, None, 0

    def num():
        nonlocal i
        v = float(tokens[i])
        i += 1
        return v

    while i < len(tokens):
        if re.fullmatch(r"[A-Za-z]", tokens[i]):
            cmd = tokens[i]
            i += 1
            if cmd in "Zz":
                cur = start.copy()
                continue
        rel = cmd.islower()
        c = cmd.upper()
        base = cur if rel else np.zeros(2)
        if c == "M":
            cur = base + np.array([num(), num()])
            start = cur.copy()
            pts.append(cur.copy())
            cmd = "l" if rel else "L"
            last_ctrl = None
        elif c == "L":
            nxt = base + np.array([num(), num()])
            pts.extend(cur + (nxt - cur) * t for t in np.linspace(0, 1, steps)[1:])
            cur, last_ctrl = nxt, None
        elif c == "H":
            nxt = np.array([num() + (cur[0] if rel else 0), cur[1]])
            pts.append(nxt)
            cur, last_ctrl = nxt, None
        elif c == "V":
            nxt = np.array([cur[0], num() + (cur[1] if rel else 0)])
            pts.append(nxt)
            cur, last_ctrl = nxt, None
        elif c in "CS":
            if c == "C":
                p1 = base + np.array([num(), num()])
            else:
                p1 = 2 * cur - last_ctrl if last_ctrl is not None else cur.copy()
            p2 = base + np.array([num(), num()])
            p3 = base + np.array([num(), num()])
            for t in np.linspace(0, 1, steps)[1:]:
                pts.append((1 - t) ** 3 * cur + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3)
            cur, last_ctrl = p3, p2
        else:
            i += 1
    return np.array(pts) if pts else np.zeros((0, 2))


def kanjivg_file(cache: Path | None = None) -> Path:
    """KanjiVG's release file under `<cache>/fonts`, fetched and checked against its SHA-256 when missing."""
    return C._fetched(KANJIVG_FILE, KANJIVG_URL, KANJIVG_SHA256, cache)


@lru_cache(maxsize=1)
def load(path: str) -> dict[str, Entry]:
    """Every kanji of a KanjiVG file (plain or gzipped): its groups and its strokes' centrelines."""
    out: dict[str, Entry] = {}
    with (gzip.open(path) if str(path).endswith(".gz") else open(path, "rb")) as f:
        root = ET.parse(f).getroot()
    for kanji in root:
        top = next(iter(kanji), None)
        if top is None:
            continue
        paths: list[np.ndarray] = []

        def build(node) -> Group:
            g = Group(node.get(KVG + "element"), node.get(KVG + "position"))
            for child in node:
                if child.tag == "g":
                    g.groups.append(build(child))
                elif child.tag == "path":
                    g.strokes.append(len(paths))
                    paths.append(sample_path(child.get("d", "")))
            return g

        root = build(top)
        char = root.element
        if char and len(char) == 1 and ord(char) >= 0x2E80:
            out[char] = Entry(root, paths)
    return out


class Cutter:
    """Cuts drawn characters along KanjiVG's groups, for the composer's `_host_node`."""

    def __init__(self, composer: C.Composer, path: Path | None = None):
        self.c = composer
        self.entries = load(str(path or kanjivg_file()))
        self._owners: dict[str, list[set[int]] | None] = {}
        self._bases_of: dict[str, set[str]] = {}
        for base, forms in composer.forms.items():
            for form, _ in forms:
                self._bases_of.setdefault(form, set()).add(base)

    def owners(self, char: str) -> list[set[int]] | None:
        """For each outline of the glyph, the KanjiVG strokes whose centrelines run inside it; None when
        a stroke is in no outline (the glyph's drawing and KanjiVG's disagree)."""
        if char in self._owners:
            return self._owners[char]
        entry, glyph = self.entries.get(char), self.c.font.glyph(char)
        result = None
        if entry is not None and glyph is not None and entry.paths and all(len(p) for p in entry.paths):
            pts = np.vstack(entry.paths)
            kx0, ky0 = pts.min(axis=0)
            kx1, ky1 = pts.max(axis=0)
            x0, y0, x1, y1 = glyph.box
            half = self.c.font.stem[0][0] / 2
            # Centrelines span the ink box less half a stroke on each side.
            cx0, cy0, cx1, cy1 = x0 + half, y0 + half, x1 - half, y1 - half
            to_em = lambda p: np.column_stack([cx0 + (p[:, 0] - kx0) / max(kx1 - kx0, 1e-6) * (cx1 - cx0),
                                               cy1 - (p[:, 1] - ky0) / max(ky1 - ky0, 1e-6) * (cy1 - cy0)])
            w, h = (x1 - x0) / SIZE, (y1 - y0) / SIZE
            masks = []
            for contour in glyph.contours:
                m = C.fill(C._rings([contour], [contour.light]), SIZE, glyph.box)
                for _ in range(GROW):
                    g = m.copy()
                    g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
                    m = g
                masks.append(m)
            owners = [set() for _ in glyph.contours]
            strokes_em = [to_em(path) for path in entry.paths]
            # Each outline's ink as points, to measure how far a centreline runs from it.
            inks = []
            for m in masks:
                rr, cc = np.nonzero(m[::2, ::2])
                inks.append(np.column_stack([x0 + (cc * 2 + 0.5) * w, y1 - (rr * 2 + 0.5) * h]))
            def gap(points, ink):
                if not len(ink) or not len(points):
                    return 1e9
                d = np.sqrt(((points[:, None, :] - ink[None, :, :]) ** 2).sum(-1))
                return float(d.min(axis=1).mean())
            far = 0.0
            for s, em in enumerate(strokes_em):
                cols = np.clip(((em[:, 0] - x0) / w).astype(int), 0, SIZE - 1)
                rows = np.clip(((y1 - em[:, 1]) / h).astype(int), 0, SIZE - 1)
                held = [k for k, m in enumerate(masks) if m[rows, cols].mean() >= INSIDE]
                if not held:
                    # Drawn a little elsewhere than KanjiVG puts it: the nearest outline.
                    dists = [gap(em[::2], ink[::3]) for ink in inks]
                    best = int(np.argmin(dists))
                    held = [best]
                    far = max(far, dists[best])
                for k in held:
                    owners[k].add(s)
            for k, own in enumerate(owners):
                if not own:
                    # An outline no centreline runs inside: the stroke nearest to it.
                    dists = [gap(inks[k][::3], em[::2]) for em in strokes_em]
                    best = int(np.argmin(dists))
                    owners[k].add(best)
                    far = max(far, dists[best])
            # A centreline further than a stroke and a half from any outline: the drawings disagree.
            if far <= 1.5 * self.c.font.stem[0][0] * 1.5:
                result = owners
        self._owners[char] = result
        return result

    def names(self, operand: str) -> set[str]:
        out = {operand}
        out.update(self.c.bases.get(operand, ()))
        out.update(self._bases_of.get(operand, ()))
        return out

    def split(self, entry: Entry, strokes: set[int], operands: list) -> list[set[int]] | None:
        """The strokes of each operand within `strokes`: a group named like the operand, outermost
        first; one operand no group names takes what the others leave."""
        found: list[set[int] | None] = []
        taken: set[int] = set()
        for operand in operands:
            want = self.names(C.key(operand)) if isinstance(operand, str) else ({self.c.by_sequence[C.key(operand)]} if C.key(operand) in self.c.by_sequence else set())
            hit = None
            for g in entry.root.walk():
                if g.element in want:
                    own = set(g.all_strokes())
                    if own and own <= strokes and not own & taken:
                        hit = own
                        break
            found.append(hit)
            if hit:
                taken |= hit
        missing = [k for k, f in enumerate(found) if f is None]
        rest = strokes - taken
        if len(missing) > 1 or (missing and not rest) or (not missing and rest):
            return None
        if missing:
            found[missing[0]] = rest
        return found

    def host_node(self, char: str, tree: tuple, path: tuple) -> C.Host | None:
        entry, owners = self.entries.get(char), self.owners(char)
        if entry is None or owners is None:
            return None
        glyph = self.c.font.glyph(char)
        strokes = set(range(len(entry.paths)))
        node = tree
        for step in [*path, None]:
            if not isinstance(node, tuple):
                return None
            parts = self.split(entry, strokes, list(node[1:]))
            if parts is None:
                return None
            if step is None:
                break
            strokes, node = parts[step], node[1 + step]
        pieces = []
        for part_strokes in parts:
            contours = [ct for ct, own in zip(glyph.contours, owners) if own and own <= part_strokes]
            if not contours:
                return None
            pieces.append(C.Part(contours))
        # An outline holding strokes of two operands (a merged crossing) belongs to neither: ambiguous.
        used = sum(len(p.contours) for p in pieces)
        inside = [ct for ct, own in zip(glyph.contours, owners) if own and own <= set().union(*parts)]
        if used != len(inside):
            return None
        whole_box = C.Part([ct for p in pieces for ct in p.contours]).box
        gap = 0.0
        if node[0] in C.AXIS:
            axis = C.AXIS[node[0]]
            spans = sorted((p.box[axis], p.box[axis + 2]) for p in pieces)
            gap = float(np.mean([spans[k + 1][0] - spans[k][1] for k in range(len(spans) - 1)]))
        return C.Host(char, pieces, whole_box, gap, whole=not path)


def _leaves(node) -> list[str]:
    """The components a sequence names, nested sequences flattened: ⿻人⿰二二 → 人 二 二."""
    if isinstance(node, str):
        return [node]
    return [leaf for child in node[1:] for leaf in _leaves(child)]


def _parts(group: Group) -> list[str] | None:
    """A group's components one level down, an unnamed subgroup flattened; None when a stroke stands
    outside any named component."""
    if group.strokes:
        return None
    out = []
    for g in group.groups:
        if g.element:
            out.append(g.element)
        else:
            inner = _parts(g)
            if inner is None:
                return None
            out.extend(inner)
    return out


def groups_like(cutter: Cutter, node: tuple, exclude: set[str]) -> list[tuple[str, C.Part]]:
    """Pieces of other characters whose KanjiVG group is made of `node`'s components (the top of
    脊 inside 瘠 for ⿻人⿰二二), each the glyph's outlines lying wholly within that group's strokes."""
    want = sorted(_leaves(node))
    if len(want) < 2:
        return []
    if not hasattr(cutter, "_by_parts"):
        index: dict[tuple, list[tuple[str, Group]]] = {}
        for char, entry in cutter.entries.items():
            for g in entry.root.walk():
                parts = _parts(g)
                if parts and len(parts) >= 2 and g is not entry.root:
                    index.setdefault(tuple(sorted(parts)), []).append((char, g))
        cutter._by_parts = index
    out = []
    for char, group in cutter._by_parts.get(tuple(want), []):
        if char in exclude:
            continue
        owners, glyph = cutter.owners(char), cutter.c.font.glyph(char)
        if owners is None or glyph is None:
            continue
        strokes = set(group.all_strokes())
        contours = [ct for ct, own in zip(glyph.contours, owners) if own and own <= strokes]
        if contours and set().union(*[own for own in owners if own and own <= strokes]) == strokes:
            out.append((char, C.Part(contours)))
    return out
