"""Where a character stands alone, from where other characters draw it as a part.

An atomic character (日, 二, 工; `compose.atomic_characters`) is drawn whole. Redrawn without its own
glyph, it is taken from another character that holds it, and that piece's box says where the
character stands on its own: a 口 drawn on the left of 叶 is narrow and tall, 口 alone is a square in
the middle of the em. The map from an instance's box (by the place it holds) to the character's own
box is a ridge regression per place, fitted on every character that both stands in the font and is
held by others. Its sums can be taken apart, so a character redrawn to test is placed by a fit that
never saw it.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from . import compose as C

#: Ridge penalty on the map's weights, in em² / 10⁶ units.
RIDGE = 0.05
STANDALONE_FILE = "compose-standalone-v2.json"


#: Features per instance: its box, a constant, and its proportions and size as logarithms, which a
#: map linear in the box's edges does not see (a flat 二 is flat wherever it is held).
FEATURES = 7


def _x(box: tuple[float, ...]) -> np.ndarray:
    b = np.array(box) / C.EM
    w, h = max(b[2] - b[0], 0.01), max(b[3] - b[1], 0.01)
    return np.array([*b, 1.0, math.log(w / h), math.log(w * h)])


#: Instances `StandaloneModel.nearest` takes, and the features it compares (the constant left out).
NEAREST = 15
NEAR_FEATURES = [0, 1, 2, 3, 5, 6]


def _near_rows(rows: list[tuple[str, list[float], list[float]]]):
    """Per instance: its character, features, how its character's own box is sized against it, and
    where that box is centred."""
    chars = np.array([c for c, _, _ in rows])
    b, o = np.array([b for _, b, _ in rows], dtype=float), np.array([o for _, _, o in rows], dtype=float)
    feats = np.array([_x(x)[NEAR_FEATURES] for x in b]).reshape(-1, len(NEAR_FEATURES))
    scale = np.stack([(o[:, 2] - o[:, 0]) / np.maximum(b[:, 2] - b[:, 0], 1), (o[:, 3] - o[:, 1]) / np.maximum(b[:, 3] - b[:, 1], 1)], axis=1) if len(rows) else np.zeros((0, 2))
    centre = np.stack([(o[:, 0] + o[:, 2]) / 2, (o[:, 1] + o[:, 3]) / 2], axis=1) if len(rows) else np.zeros((0, 2))
    return chars, feats, scale, centre


@dataclass
class StandaloneModel:
    #: place → (XᵀX, XᵀY) over every (instance, own box) pair held in that place.
    sums: dict[str, tuple[np.ndarray, np.ndarray]]
    #: character → its own (place, instance box) rows and own box, to take it out of the sums.
    rows: dict[str, tuple[list[tuple[str, list[float]]], list[float]]]
    _near: dict = field(default_factory=dict, repr=False)

    @classmethod
    def fit(cls, records: list[dict]) -> StandaloneModel:
        sums: dict[str, tuple[np.ndarray, np.ndarray]] = {}
        rows = {}
        for r in records:
            own = np.array(r["own"]) / C.EM
            mine = []
            for inst in r["inst"]:
                x = _x(inst["box"])
                a, b = sums.get(inst["place"], (np.zeros((FEATURES, FEATURES)), np.zeros((FEATURES, 4))))
                sums[inst["place"]] = (a + np.outer(x, x), b + np.outer(x, own))
                mine.append((inst["place"], inst["box"]))
            rows[r["c"]] = (mine, r["own"])
        return cls(sums, rows)

    def predict(self, place: str, box: tuple[float, ...], leave: str | None = None) -> tuple[float, ...] | None:
        """The standalone box for a character held in `place` at `box`; `leave` is fitted without."""
        if place not in self.sums:
            return None
        a, b = (m.copy() for m in self.sums[place])
        if leave in self.rows:
            mine, own = self.rows[leave]
            y = np.array(own) / C.EM
            for p, inst in mine:
                if p == place:
                    x = _x(inst)
                    a -= np.outer(x, x)
                    b -= np.outer(x, y)
        if a[4, 4] < 3:  # fewer than three examples in this place
            return None
        penalty = RIDGE * np.eye(FEATURES)
        penalty[4, 4] = 0.0  # the constant is not shrunk
        w = np.linalg.solve(a + penalty, b)
        return tuple(float(v) for v in (_x(box) @ w) * C.EM)

    def nearest(self, place: str, box: tuple[float, ...], leave: str | None = None) -> tuple[float, ...] | None:
        """The standalone box for a character held in `place` at `box`, from the `NEAREST` instances
        held there most alike in edges, proportions and size: each scales `box` by how its own
        character grows standing alone and centres it where that character stands. A flat 二 held
        on the right of 仁 stays flat, which one linear map for every part on the right does not keep."""
        if place not in self._near:
            self._near[place] = _near_rows([(c, b, own) for c, (mine, own) in self.rows.items() for p, b in mine if p == place])
        chars, feats, scale, centre = self._near[place]
        keep = chars != leave
        if keep.sum() < 3:
            return None
        f = _x(box)[NEAR_FEATURES]
        d = np.abs(feats[keep] - f).sum(axis=1)
        idx = np.argsort(d)[:NEAREST]
        w, h = (box[2] - box[0]) * scale[keep][idx, 0], (box[3] - box[1]) * scale[keep][idx, 1]
        cx, cy = centre[keep][idx, 0], centre[keep][idx, 1]
        return tuple(float(v) for v in np.median(np.stack([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], axis=1), axis=0))

    def save(self, path: Path) -> None:
        path.write_text(json.dumps({
            "sums": {p: [a.tolist(), b.tolist()] for p, (a, b) in self.sums.items()},
            "rows": {c: [mine, own] for c, (mine, own) in self.rows.items()},
        }, ensure_ascii=False))

    @classmethod
    def load(cls, path: Path) -> StandaloneModel:
        data = json.loads(path.read_text())
        return cls({p: (np.array(a), np.array(b)) for p, (a, b) in data["sums"].items()},
                   {c: ([tuple(x) for x in mine], own) for c, (mine, own) in data["rows"].items()})


_COMPOSER: C.Composer | None = None


def records(composer: C.Composer, workers: int = 3) -> list[dict]:
    """Every character the font draws that at least five others hold: its own box and up to 12
    instances, each a piece cut from another character with the place it holds."""
    import multiprocessing as mp

    global _COMPOSER
    _COMPOSER = composer
    hosts, _ = composer._index
    held: dict[str, int] = {}
    for (place, written), found in hosts.items():
        if len(written) == 1:
            held[written] = held.get(written, 0) + len(found)
    chars = sorted(ch for ch, n in held.items() if n >= 5 and composer.font.has(ch) and ch in composer.sequences)
    with mp.get_context("fork").Pool(workers, maxtasksperchild=60) as pool:
        return [r for r in pool.imap(_record, chars, chunksize=1) if r["inst"]]


def _record(char: str) -> dict:
    composer = _COMPOSER
    hosts, _ = composer._index
    out = []
    for place, written in composer._places.get(char, ()):
        for host_char, tree, path, i in hosts[(place, written)][:40]:
            if host_char == char:
                continue
            try:
                host = composer._host_node(host_char, tree, path)
            except (ValueError, LookupError):
                host = None
            if host is not None:
                out.append({"place": place, "host": host_char, "box": [round(float(v), 1) for v in host.pieces[i].box]})
            if len(out) >= 12:
                break
        if len(out) >= 12:
            break
    glyph = composer.font.glyph(char)
    return {"c": char, "own": [round(float(v), 1) for v in glyph.box], "inst": out}
