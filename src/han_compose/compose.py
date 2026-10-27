"""Draw a character Unicode lacks from its Ideographic Description Sequence, in one of three styles.

`sans` draws in GenZui Sans, which takes its ideographs unchanged from Noto Sans JP at weight 400,
which in turn draws them as Noto Sans CJK JP does. The composer reads Noto Sans CJK JP, the variable
font that draws 30,289 ideographs to Noto Sans JP's 13,742 with the same outlines, so each outline is
known at weight 400 and at the style's heavy weight with the same points. `serif` reads Noto Serif
CJK JP, the variable Source Han Serif, the same way. `kaisho` reads Kureedo, the Klee One design
extended with historical kana, at one static weight, with GenZui Sans drawing characters Kureedo
lacks (`STYLES`). Every layout and every part comes
from a character a type designer drew; a sequence (⿰亻哥) is drawn in three steps:

1. Teacher. For each node, the drawn character with a node of the same operator whose operands are
   most like the target's (written the same, else holding about as much ink in about the same
   proportions) is cut into its operands (`split` along the operator's axis where no outline
   crosses; `enclosures` round an enclosed operand). Its layout is a designer's balance for such
   operands. An operand written there as the target writes it is used as the teacher drew it.
2. Parts. Any other operand is cut from a host: a drawn character with that operand, or its
   positional form (王 on the left as 𤣩, 水 as 氵), in the same position, at any depth of the
   host's sequence, beside siblings holding about as much ink. It takes the teacher's share along
   the operator's axis and the extent its own host gave it across. A cut is used only when each
   piece looks like its operand. With no host, a nested sequence is drawn the same way, and a
   character from its own glyph.
3. Weight. Noto thins its strokes as a character fills up (`Style.stem_curve`). Each part is moved
   towards the heavy master, along x and along y apart, until its strokes have the width the
   whole composed character's density calls for; a lone stroke keeps that width without scaling.

The result is a set of closed outlines in the font's 1000-unit em, y up, drawn out by `svg_path`.
Operands drawn across each other (⿻) are laid out as characters that overlay the same operands do.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter
from collections.abc import Iterator
from dataclasses import dataclass, field, replace
from functools import cache, cached_property
from itertools import combinations, pairwise
from pathlib import Path

import numpy as np
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

from .vocab import BINARY, TERNARY, UNARY, read_rows

# Generated from the pinned BabelStone IDS catalog; see docs/pyramid-glyphs.md.
_PYRAMID_GLYPHS = {
    sequence: row["char"]
    for row in json.loads(Path(__file__).with_name("pyramid-glyphs.json").read_text(encoding="utf-8"))["entries"]
    for sequence in (row["sequence"], f"⿱{row['part']}{row['pair']}",
                     f"⿱{row['part']}⿰{row['part']}{row['part']}")
}

@dataclass(frozen=True)
class Source:
    """A font file the composer reads, fetched once into `<cache>/fonts/<file>` and pinned by SHA-256.
    With `member`, `url` is a zip archive pinned by `archive_sha256`, and the file is that member."""

    file: str
    url: str
    sha256: str
    licence: str
    member: str | None = None
    archive_sha256: str | None = None


@dataclass(frozen=True)
class Style:
    """A design the composer draws in: a variable font with a `wght` axis, read at 400 and at `heavy`,
    and static fonts drawing what it lacks.

    `stem_curve` is the variable font's stroke width at 400 against a glyph's density (`calibrate`).
    `synthetic_y` grows the heavy master's horizontals synthetically, for a font whose horizontals
    keep their width at every weight. `kindred` fallbacks draw in the variable font's own design
    (Plangothic extends Source Han Sans): the layout learns from their characters too, and each
    fallback glyph's stroke widths are measured on it. Fallbacks of another design (Jigmo) are left
    out of the layout's examples, and a glyph of theirs takes the stroke widths its family's 丨 and
    一 have against the variable font's, thinned with density as the variable font thins: a Mincho's
    thin horizontals are lost among the short runs of ink between them (𡉵 measured 65 units across
    y, its horizontals 20)."""

    name: str
    font: Source
    fallbacks: tuple[Source, ...]
    stem_curve: tuple[tuple[float, float], tuple[float, float]]
    heavy: int = 900
    synthetic_y: bool = False
    kindred: bool = True
    #: Whether stroke weights are balanced across parts. A static brush face keeps its own weights.
    weighted: bool = True
    #: Whether hosts come only from the main font, so a fallback never supplies a piece.
    own_hosts: bool = False


OFL = "SIL OFL 1.1"
#: Plangothic P1 and P2 draw the CJK extensions in the Source Han Sans design Noto Sans CJK shares:
#: the source of components Noto lacks (𦒱, 𡉵). Pinned as `scripts/build_vi_hani.py` pins them.
PLANGOTHIC_URL = "https://github.com/Fitzgerald-Porthmouth-Koenigsegg/Plangothic-Project/releases/download/V2.9.5795"
#: Jigmo (CC0 1.0, from GlyphWiki's KAGE outlines) draws every CJK unified ideograph through
#: Extension J in one Mincho weight: Jigmo2 the SIP (B to F, I), Jigmo3 the TIP (G, H, J), Jigmo the
#: BMP. Its site gives the archive's SHA-1, 2fb963ee7bba1d23ccfe81b228422f22da9dc574.
JIGMO_URL = "https://kamichikoichi.github.io/jigmo/Jigmo-20250912.zip"
JIGMO_SHA256 = "5744c7386d129475d87607ca66d043c8793c65448adeaedc921b6931890e5d0b"

STYLES = {
    # Noto Sans CJK JP 2.004: GenZui Sans takes its ideographs unchanged from Noto Sans JP, which
    # draws them as this font does. Stroke widths fitted on 1,500 of its ideographs: it thins its
    # strokes as a character fills up, the horizontals more than the verticals.
    "sans": Style(
        "sans",
        Source("NotoSansCJKjp-VF-2.004.ttf",
               "https://github.com/notofonts/noto-cjk/raw/Sans2.004/Sans/Variable/TTF/NotoSansCJKjp-VF.ttf",
               "240c9b83bf7b386edbae39995ae7e068ed4583f484d92e4a74c34158b5f27b1a", OFL),
        (Source("PlangothicP1-Regular.ttf", f"{PLANGOTHIC_URL}/PlangothicP1-Regular.ttf",
                "550b5d0775b15405946b18f4843df439a51e69508d7e6778d94c1f7a53dc5ad6", OFL),
         Source("PlangothicP2-Regular.ttf", f"{PLANGOTHIC_URL}/PlangothicP2-Regular.ttf",
                "681933370adfe0fc7253f77735275a82fea09fe4f8adba907bdeb46c110daf8f", OFL)),
        ((85.34, -1.324), (86.93, -1.914)),
    ),
    # Noto Serif CJK JP 2.003 (Source Han Serif's design), whose horizontals stay about 30 units at
    # every weight from 200 to 900 while its verticals grow from 45 to 145.
    "serif": Style(
        "serif",
        Source("NotoSerifCJKjp-VF-2.003.ttf",
               "https://github.com/notofonts/noto-cjk/raw/Serif2.003/Serif/Variable/TTF/NotoSerifCJKjp-VF.ttf",
               "c2ff7cffb6ef75193d4406b030eab5aa6503c48004acec6b040327e2fe1e9e51", OFL),
        tuple(Source(f"Jigmo-20250912-{name}", JIGMO_URL, sha, "CC0 1.0", member=name, archive_sha256=JIGMO_SHA256)
              for name, sha in (("Jigmo2.ttf", "5da3582efe77e22073b86b3b86b556d7111148a76b957cfb53318a91da2efff0"),
                                ("Jigmo3.ttf", "815b18c1c670103723fe743090559208fdea47dc587ecb057a5a4721ee8dfeff"),
                                ("Jigmo.ttf", "c8f295b9bd8f9f117a76b3a454aaaa1bb5b4babc18e254978c6deb88464e40cf"))),
        # Fitted on 1,500 of its ideographs: its verticals thin a little as a character fills up, its
        # horizontals not at all.
        ((67.77, -0.463), (22.31, 0.164)),
        synthetic_y=True,
        kindred=False,
    ),
    # Kureedo v0.4.3: Klee One's kaisho with the historical kana and Ainu small kana. It is a static
    # font, so 400 is also the heavy master; GenZui Sans draws the ideographs Klee One lacks.
    "kaisho": Style(
        "kaisho",
        Source("Kureedo-Regular.ttf",
               "https://github.com/mkpoli/kureedo/releases/download/v0.4.3/Kureedo-Regular.ttf",
               "3402dc79e14f333ceb670d3e14e246a702701d2af67e2fee6baa95fc1c5e3527", OFL),
        (Source("GenZuiSans-Regular.ttf",
                "https://github.com/mkpoli/GenZui/releases/download/sans-v0.105/GenZuiSans-Regular.ttf",
                "121871ee522380b1f591fc6871850416cb74e075a534438eb5180b43094ebe0f", OFL),),
        # Kureedo's stems measured at 400; the static font has no weight axis to thin them.
        ((70.0, 0.0), (70.0, 0.0)),
        heavy=400,
        kindred=False,
        weighted=False,
        own_hosts=True,
    ),
}
DEFAULT_STYLE = "sans"
EM = 1000
#: How far a static style's outlines grow on every side to make its heavy master.
STATIC_GROW = 20.0
#: The em's top in the font's units: an SVG path is drawn from here down.
ASCENT = 880
#: The operators a part is cut from its host along: x for side by side, y for stacked.
AXIS = {"⿰": 0, "⿲": 0, "⿱": 1, "⿳": 1}
#: The sides an enclosing operand closes, y up: ⿸ 厂 closes the left and the top.
ENCLOSE = {"⿴": "LRBT", "⿵": "LRT", "⿶": "LRB", "⿷": "LBT", "⿸": "LT", "⿹": "RT", "⿺": "LB",
           "⿼": "RBT", "⿽": "RB"}
#: Where an enclosed operand sits when no host shows it, as shares of the region (x0, y0, x1, y1).
INSIDE = {"⿴": (0.2, 0.15, 0.8, 0.8), "⿵": (0.2, 0.0, 0.8, 0.8), "⿶": (0.2, 0.2, 0.8, 1.0),
          "⿷": (0.2, 0.15, 1.0, 0.85), "⿸": (0.3, 0.0, 1.0, 0.78), "⿹": (0.0, 0.0, 0.75, 0.78),
          "⿺": (0.3, 0.25, 1.0, 1.0), "⿼": (0.0, 0.15, 0.8, 0.85), "⿽": (0.0, 0.25, 0.7, 1.0)}
#: Least likeness of a cut piece to its operand's own glyph.
LIKENESS = 0.45
#: The share of its opening an enclosed part drawn there takes: designers leave it room (the inner
#: 口 of 回 spans 57% of its opening, the 玉 of 国 75%).
OPENING_SHARE = 0.85
#: The least share of the em a learned enclosing part's box may cover at the root.
ENCLOSING_LEAST = 0.5
#: How far an enclosing part's host piece may change its proportions in its learned box before the
#: part is drawn from its own glyph instead.
ENCLOSING_STRETCH = 1.4
#: How far an atomic character taken from another may change its proportions in its own box.
ALONE_STRETCH = 1.6
#: How far a learned box may change the proportions of a part a character draws at its top level
#: before the part keeps that character's extent across the axis it is split along: 弓 beside 丨 in
#: 引 stands as tall as in 弘, where the network shortened it.
HOST_EXTENT = 1.25
#: Below this the learned box only nudges such a part, and the part keeps that character's extent
#: as well: 訁 cut short from 訌 stays short in 討, where the network gives 訁's usual height.
#: Jōyō, redrawn without their glyphs: 0.7338 → 0.7387 (331 better, 224 worse; 信 +0.41, 訂 +0.28).
HOST_SNAP = 1.05
#: How many levels of components `Composer._expanded` writes out from their own sequences.
EXPAND_DEPTH = 2
#: Below how many characters writing a part out its hosts are sought inside components too.
EXPAND_FEW = 3
#: An enclosure cut by its enclosing operand's template (`Composer._guided`): how many KanjiVG cuts
#: make the template, at what size, grown by how many pixels, and how much of an outline must lie on
#: it to go with the enclosing part.
TEMPLATES = 5
TEMPLATE_SIZE = 48
TEMPLATE_GROW = 1
TEMPLATE_ON = 0.6
#: Enclosures whose enclosing part's box holds the enclosed part's (`covering`).
COVERING = frozenset("⿴⿵⿶⿷")
#: Least hosts in a place a kin enclosing part needs to stand for another (`_kin_outer`).
KIN_OUTER_HOSTS = 3
#: Hosts of a kin enclosing part tried, best first, for one KanjiVG can cut (`_kin_outer`).
KIN_TRIED = 16
#: Characters holding an enclosing part on their left tried for its upper part (`_upper`).
UPPER_HOSTS = 8
#: An enclosed part's learned box is kept when at least this share of it lies in the opening.
ROOM_TRUST = 0.5
#: Likeness at which an enclosing part is taken as certain, whatever its enclosed part looks like.
SURE = 0.9
#: Most a cut piece's outline length for its size may differ from its operand's glyph's.
DENSER = 1.7
#: Characters whose median box is the box a full ideograph fills.
FULL = "國圖體觀讀鬱識護議變顯襲驚響露臨"

Node = str | tuple
Box = tuple[float, float, float, float]


def _fetched(source: Source, cache: Path | None) -> Path:
    import io
    import zipfile

    import httpx

    from .vocab import cache_root

    path = (cache or cache_root()) / "fonts" / source.file
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        if source.member is not None:
            # The archive is kept beside its members, so the others extract without fetching it again.
            archive = path.parent / source.url.rsplit("/", 1)[-1]
            data = archive.read_bytes() if archive.exists() else httpx.get(source.url, follow_redirects=True, timeout=600).content
            if hashlib.sha256(data).hexdigest() != source.archive_sha256:
                raise ValueError(f"{source.url} does not match its pinned SHA-256.")
            archive.write_bytes(data)
            data = zipfile.ZipFile(io.BytesIO(data)).read(source.member)
        else:
            data = httpx.get(source.url, follow_redirects=True, timeout=600).content
        if hashlib.sha256(data).hexdigest() != source.sha256:
            raise ValueError(f"{source.url} ({source.member or source.file}) does not match its pinned SHA-256.")
        path.write_bytes(data)
    return path


def font_file(cache: Path | None = None, style: str = DEFAULT_STYLE) -> Path:
    """The style's variable font under `<cache>/fonts`, fetched and checked against its SHA-256 when missing."""
    return _fetched(STYLES[style].font, cache)


def fallback_files(cache: Path | None = None, style: str = DEFAULT_STYLE) -> list[Path]:
    """The style's fallback fonts under `<cache>/fonts`, fetched and checked the same way."""
    return [_fetched(source, cache) for source in STYLES[style].fallbacks]


def styled(name: str, style: str) -> str:
    """A cached model's file name for a style: the name itself for the default, `<stem>-<style><suffix>`
    for another, so that models fitted on one design never load for another."""
    if style == DEFAULT_STYLE:
        return name
    path = Path(name)
    return f"{path.stem}-{style}{path.suffix}"


# ------------------------------------------------------------------ sequences
def _selector(char: str) -> bool:
    point = ord(char)
    return 0xFE00 <= point <= 0xFE0F or 0xE0100 <= point <= 0xE01EF


def parse(sequence: str) -> Node:
    """`⿰亻⿱亠女` as ('⿰', '亻', ('⿱', '亠', '女')); a character, with any variation selector, stands for itself."""
    chars = list(sequence)
    at = 0

    def node() -> Node:
        nonlocal at
        if at >= len(chars):
            raise ValueError(f"{sequence} is missing a component.")
        char = chars[at]
        at += 1
        arity = 2 if char in BINARY else 3 if char in TERNARY else 1 if char in UNARY else 0
        if not arity:
            if at < len(chars) and _selector(chars[at]):
                char += chars[at]
                at += 1
            return char
        return (char, *(node() for _ in range(arity)))

    tree = node()
    if at != len(chars):
        raise ValueError(f"{sequence} has more components than its operators take.")
    return tree


def key(node: Node) -> str:
    """A node written out again as a sequence."""
    return node if isinstance(node, str) else node[0] + "".join(key(n) for n in node[1:])


#: A sequence's source regions: (GJ), (G[B]) or (UTC2003).
REGIONS = re.compile(r"^(.*?)\(([A-Z0-9\[\]]+)\)$")


def japanese_characters() -> set[str]:
    """The ideographs BabelStone gives a sequence for Japan."""
    out = set()
    for row in read_rows("han-ids.tsv"):
        for item in row[2].split():
            match = REGIONS.match(item)
            if match and "J" in match.group(2):
                out.add(row[1])
                break
    return out


def hand_forms() -> dict[str, str]:
    """The stroke of the hand 𠂇 a character spelled ⿸𠂇X writes first, 丿 (右) or 一 (左), as
    KanjiVG records it (`data/vocab/han-hand-forms.tsv`): the font draws the two hands differently."""
    return {row[0]: row[1] for row in read_rows("han-hand-forms.tsv")}


def atomic_characters() -> set[str]:
    """The ideographs drawn whole, never composed from their sequence: those hfhchan/ids leaves
    undecomposed as productive components (日, 二, 工, 万; `data/vocab/han-atomic.tsv`), and those
    `data/vocab/han-ids-drawn.tsv` draws whole (㐧)."""
    return {row[0] for row in read_rows("han-atomic.tsv")} | {
        row[0] for row in read_rows("han-ids-drawn.tsv") if row[1] == row[0]}


def japanese_sequences() -> dict[str, str]:
    """Each ideograph's sequence as BabelStone gives it for Japan, else its first; sequences naming
    an unencoded component ({n}) or an unnameable one (？) are left out. A sequence in
    `data/vocab/han-ids-drawn.tsv` replaces the source's where its operands are not the shapes the
    glyph draws (㞙 as ⿸尸⿱毛水)."""
    out = {}
    for row in read_rows("han-ids.tsv"):
        char, chosen = row[1], None
        for item in row[2].split():
            match = REGIONS.match(item)
            text, regions = (match.group(1), match.group(2)) if match else (item, "")
            if "J" in regions:
                chosen = text
                break
            chosen = chosen or text
        if chosen and chosen != char and "{" not in chosen and "？" not in chosen:
            out[char] = chosen
    for char, sequence, _source, _note in read_rows("han-ids-drawn.tsv"):
        if sequence == char:
            out.pop(char, None)
        else:
            out[char] = sequence
    return out


#: BabelStone's tag for another analysis of the same shape, not a glyph of its own (主 as ⿱亠土).
ANALYSIS = "X"


def regional_sequences() -> dict[str, list[tuple[str, str]]]:
    """The ideographs BabelStone gives more than one sequence by source region, each distinct
    sequence with the regions that write it, Japan's first: 侮 → [('⿰亻毎', 'J'), ('⿰亻每', 'GHTKP')].
    Another analysis of the same shape (tagged `ANALYSIS`) and a sequence naming an unencoded or
    unnameable component are left out; Japan's is the sequence `japanese_sequences` draws."""
    japanese = japanese_sequences()
    out = {}
    for row in read_rows("han-ids.tsv"):
        char, merged = row[1], {}
        for item in row[2].split():
            match = REGIONS.match(item)
            if not match:
                continue
            text, regions = match.group(1), "".join(r for r in match.group(2) if r.isalnum())
            regions = regions.replace(ANALYSIS, "")
            if not regions or text == char or "{" in text or "？" in text:
                continue
            if "J" in regions and char in japanese:
                text = japanese[char]
            merged[text] = merged.get(text, "") + "".join(r for r in regions if r not in merged.get(text, ""))
        if len(merged) > 1:
            out[char] = sorted(merged.items(), key=lambda form: "J" not in form[1])
    return out


def spelled_nodes() -> set[str]:
    """The nodes written out inside `data/vocab/han-ids-drawn.tsv`'s sequences: each is composed
    from its operands, never drawn as the character it describes (実's ⿻三人, not 春's 𡗗)."""
    out = set()

    def walk(node: Node, root: bool) -> None:
        if isinstance(node, tuple):
            if not root:
                out.add(key(node))
            for kid in node[1:]:
                walk(kid, False)

    for char, sequence, _source, _note in read_rows("han-ids-drawn.tsv"):
        if sequence != char:
            walk(parse(sequence), True)
    return out


# ------------------------------------------------------------------ outlines
@dataclass
class Contour:
    """One closed contour: its pen commands (command, points, whether it closes on an implied
    point), and its points at weight 400 and at the style's heavy weight. A contour of a fallback font
    also carries its glyph's stroke width as measured, across x and across y, which the style's
    `stem_curve` (fitted on its variable font's outlines) does not predict for another design."""

    ops: list[tuple[str, int, bool]]
    light: np.ndarray
    heavy: np.ndarray
    width: tuple[float, float] | None = None

    @cached_property
    def box(self) -> Box:
        return (*self.light.min(axis=0), *self.light.max(axis=0))


def _contours(pen: RecordingPen) -> list[tuple[list, np.ndarray]]:
    out, ops, points = [], [], []
    for op, args in pen.value:
        if op in ("closePath", "endPath"):
            out.append((ops, np.array(points, dtype=float)))
            ops, points = [], []
            continue
        real = [p for p in args if p is not None]
        ops.append((op, len(real), bool(args) and args[-1] is None))
        points.extend(real)
    return out


@dataclass
class Part:
    """The contours of a glyph, or of an operand cut from one."""

    contours: list[Contour]

    @cached_property
    def box(self) -> Box:
        boxes = np.array([c.box for c in self.contours])
        return boxes[:, 0].min(), boxes[:, 1].min(), boxes[:, 2].max(), boxes[:, 3].max()


class Font:
    """A style's variable font with a `wght` axis, read at weight 400 and at the style's `heavy`, and
    static fonts that draw what it lacks: a glyph from one of those has one set of points, and its
    heavy outline is grown from it synthetically."""

    def __init__(self, path: Path, fallbacks: list[Path] = (), style: str = DEFAULT_STYLE):
        self.style = STYLES[style]
        self.font = TTFont(path)
        fonts = [TTFont(f) for f in fallbacks]
        # Each fallback with the scale that brings its em to this font's (Jigmo draws on 1,024 units).
        self.fallbacks = [(font, font.getBestCmap(), font.getGlyphSet(), self.font["head"].unitsPerEm / font["head"].unitsPerEm)
                          for font in fonts]
        self.cmap = self.font.getBestCmap()
        self.static = "fvar" not in self.font
        # Ideographic variation sequences: (base, selector) → glyph name, None for the base's own glyph.
        self.variants = {(base, selector): name for table in self.font["cmap"].tables if table.format == 14
                         for selector, pairs in table.uvsDict.items() for base, name in pairs}
        self.light = self.font.getGlyphSet(location={"wght": 400})
        self.heavy = self.light if self.static else self.font.getGlyphSet(location={"wght": self.style.heavy})
        self._parts: dict[str, Part | None] = {}
        # Stem widths at 400 and at heavy: 丨's width across x, 一's height across y, each across the
        # middle of the stroke, clear of the serifs at its ends.
        across_x, across_y = self._stem("丨", 0), self._stem("一", 1)
        #: How far the heavy master's outlines are grown along y where the font's own do not grow there.
        self.grow_y = 0.0
        if self.style.synthetic_y:
            # Horizontals grown in the proportion the verticals grow in.
            self.grow_y = across_y[0] * (across_x[1] / across_x[0] - 1) / 2
            across_y = (across_y[0], across_y[0] + 2 * self.grow_y)
        if self.static:
            across_x = (across_x[0], across_x[1] + 2 * STATIC_GROW)
            across_y = (across_y[0], across_y[1] + 2 * STATIC_GROW)
        self.stem = (across_x, across_y)
        #: The fallbacks' stroke widths against this font's at 400, across x and across y.
        self.family = None
        if not self.style.kindred:
            font, cmap, glyphs, scale = next(f for f in self.fallbacks if ord("丨") in f[1] and ord("一") in f[1])
            widths = []
            for char, axis in (("丨", 0), ("一", 1)):
                pen = RecordingPen()
                glyphs[cmap[ord(char)]].draw(pen)
                flat = [Contour(ops, p * scale, p * scale) for ops, p in _contours(pen)]
                widths.append(_across(_rings(flat, [c.light for c in flat], steps=8), axis) / self.stem[axis][0])
            self.family = (widths[0], widths[1])

    @classmethod
    def of(cls, style: str = DEFAULT_STYLE, cache: Path | None = None) -> Font:
        """The style's fonts, fetched into `<cache>/fonts` when missing."""
        return cls(font_file(cache, style), fallback_files(cache, style), style)

    def _stem(self, char: str, axis: int) -> tuple[float, float]:
        name = self.cmap[ord(char)]
        out = []
        for glyphs in (self.light, self.heavy):
            pen = RecordingPen()
            glyphs[name].draw(pen)
            flat = [Contour(ops, p, p) for ops, p in _contours(pen)]
            out.append(_across(_rings(flat, [c.light for c in flat], steps=8), axis))
        return out[0], out[1]

    def width(self, density: float, axis: int) -> float:
        """The stroke width the font draws in a glyph of `density`, along `axis`'s stems."""
        intercept, slope = self.style.stem_curve[axis]
        return intercept + slope * density / 1000

    def _name(self, char: str) -> str | None:
        """The glyph a character draws with, with a variation selector only as the font maps that sequence."""
        if len(char) == 1:
            return self.cmap.get(ord(char))
        if len(char) == 2 and _selector(char[1]) and (ord(char[0]), ord(char[1])) in self.variants:
            return self.variants[(ord(char[0]), ord(char[1]))] or self.cmap.get(ord(char[0]))
        return None

    def selected(self, char: str) -> list[str]:
        """`char` with each variation selector the font maps to a glyph of its own, not its base's."""
        base = self.cmap.get(ord(char))
        return [char + chr(selector) for (point, selector), name in sorted(self.variants.items())
                if point == ord(char) and name is not None and name != base]

    def own(self, char: str) -> bool:
        """Whether the variable font itself draws `char`: its strokes can be weighted."""
        return self._name(char) is not None

    def has(self, char: str) -> bool:
        return self._name(char) is not None or (len(char) == 1 and any(ord(char) in cmap for _, cmap, _, _ in self.fallbacks))

    def glyph(self, char: str) -> Part | None:
        if char not in self._parts:
            part = None
            name = self._name(char)
            if name is None and len(char) == 1:
                for _, cmap, glyphs, scale in self.fallbacks:
                    if ord(char) in cmap:
                        pen = RecordingPen()
                        glyphs[cmap[ord(char)]].draw(pen)
                        # A static font has one weight: its heavy outline is the light one grown by as
                        # much as this font's stems of the same width grow at heavy, so its parts are
                        # thinned and thickened like the font's own.
                        rings = [(ops, p * scale if scale != 1 else p) for ops, p in _contours(pen)]
                        flat = [Contour(ops, p, p) for ops, p in rings]
                        if self.family is not None:
                            density = sum(float(np.linalg.norm(np.diff(np.vstack([c.light, c.light[:1]]), axis=0), axis=1).sum())
                                          for c in flat)
                            width = tuple(self.family[axis] * self.width(density, axis) for axis in (0, 1))
                        else:
                            mask = fill(_rings(flat, [c.light for c in flat], steps=2), 200, (0.0, ASCENT - EM, EM, ASCENT))
                            width = tuple(w if np.isfinite(w) else self.stem[axis][0] for axis, w in enumerate(stems(mask, EM / 200)))
                        grow = tuple(width[axis] * (self.stem[axis][1] / self.stem[axis][0] - 1) / 2 for axis in (0, 1))
                        contours = [Contour(ops, p, _grown(p, grow), width) for ops, p in rings]
                        part = Part(contours) if contours else None
                        break
            if name is not None:
                light, heavy = RecordingPen(), RecordingPen()
                self.light[name].draw(light)
                self.heavy[name].draw(heavy)
                contours = [Contour(ops, p, q) for (ops, p), (_, q) in zip(_contours(light), _contours(heavy))]
                if self.static:
                    flat = [Contour(ops, p, p) for ops, p in _contours(light)]
                    mask = fill(_rings(flat, [c.light for c in flat], steps=2), 200, (0.0, ASCENT - EM, EM, ASCENT))
                    width = tuple(w if np.isfinite(w) else self.stem[axis][0] for axis, w in enumerate(stems(mask, EM / 200)))
                    for c in contours:
                        c.heavy = _grown(c.light, (STATIC_GROW, STATIC_GROW))
                        c.width = width
                if self.grow_y:
                    for c in contours:
                        c.heavy = np.column_stack([c.heavy[:, 0], _grown(c.light, (0.0, self.grow_y))[:, 1]])
                part = Part(contours) if contours else None
            self._parts[char] = part
        return self._parts[char]


def _across(rings: list[np.ndarray], axis: int) -> float:
    """A single stroke's width along `axis`: the median extent of its ink along `axis` on nine lines
    across its middle two fifths, so that serifs and the triangles at a stroke's end do not count."""
    points = np.concatenate(rings)
    other = 1 - axis
    low, high = points[:, other].min(), points[:, other].max()
    widths = []
    for at in low + (high - low) * np.linspace(0.3, 0.7, 9):
        hits = []
        for ring in rings:
            a, b = ring, np.roll(ring, -1, axis=0)
            on = ((a[:, other] <= at) & (b[:, other] > at)) | ((a[:, other] > at) & (b[:, other] <= at))
            t = (at - a[on, other]) / (b[on, other] - a[on, other])
            hits.extend(a[on, axis] + t * (b[on, axis] - a[on, axis]))
        if len(hits) >= 2:
            widths.append(max(hits) - min(hits))
    if not widths:
        raise ValueError("No line across the stroke's middle meets its outline twice.")
    return float(np.median(widths))


def _grown(points: np.ndarray, by: tuple[float, float]) -> np.ndarray:
    """A contour's points moved outward from its ink by `by` (along x, along y), each along the
    bisector of its two edges, as far as keeps the edges `by` away; a point stays put where its
    edges fold back on each other. Ink lies to the right of a contour's direction in a font."""
    if len(points) < 3:
        return points.copy()
    before = points - np.roll(points, 1, axis=0)
    after = np.roll(points, -1, axis=0) - points
    def left(v: np.ndarray) -> np.ndarray:
        n = np.stack([-v[:, 1], v[:, 0]], axis=1)
        length = np.linalg.norm(n, axis=1, keepdims=True)
        return np.divide(n, length, out=np.zeros_like(n), where=length > 1e-9)
    a, b = left(before), left(after)
    bisector = a + b
    size = np.linalg.norm(bisector, axis=1, keepdims=True)
    unit = np.divide(bisector, size, out=np.zeros_like(bisector), where=size > 1e-9)
    # Moving along the bisector by d / cos(half the turn) keeps each edge d away; capped at a sharp turn.
    cos_half = np.clip((unit * a).sum(axis=1, keepdims=True), 0.35, 1.0)
    return points + unit / cos_half * np.array(by)


# ------------------------------------------------------------------ cutting hosts
def _units(contours: list[Contour]) -> list[list[Contour]]:
    """Contours grouped with those inside them: a counter goes with the smallest contour winding the
    other way whose box holds it. A stroke that only lies within another's box (the strokes inside
    the 冂 of 図) winds the same way and is a shape of its own, as is one inside a counter (回)."""
    order = {id(c): k for k, c in enumerate(contours)}
    area = lambda c: (c.box[2] - c.box[0]) * (c.box[3] - c.box[1])
    winding = {id(c): np.sign(_signed_area(c.light)) for c in contours}

    def inside(a: Contour, b: Contour) -> bool:
        # Of two contours with the same box, the earlier holds the later, so no two hold each other.
        if winding[id(a)] == winding[id(b)]:
            return False
        held = a.box[0] >= b.box[0] and a.box[1] >= b.box[1] and a.box[2] <= b.box[2] and a.box[3] <= b.box[3]
        return held and (area(a) < area(b) or (area(a) == area(b) and order[id(b)] < order[id(a)]))

    owner = {}
    for c in contours:
        holders = [d for d in contours if inside(c, d)]
        if holders:
            owner[id(c)] = min(holders, key=lambda d: (d.box[2] - d.box[0]) * (d.box[3] - d.box[1]))

    def depth(c: Contour) -> int:
        n = 0
        while id(c) in owner:
            c, n = owner[id(c)], n + 1
        return n

    def root(c: Contour) -> Contour:
        # A counter (odd depth) goes with the outline holding it; an outline, however deep, is its own.
        return owner[id(c)] if depth(c) % 2 else c

    groups: dict[int, list[Contour]] = {}
    for c in contours:
        groups.setdefault(id(root(c)), []).append(c)
    return list(groups.values())


def _signed_area(points: np.ndarray) -> float:
    x, y = points[:, 0], points[:, 1]
    return float(np.dot(x, np.roll(y, -1)) - np.dot(np.roll(x, -1), y)) / 2


def _span(unit: list[Contour], axis: int) -> tuple[float, float]:
    return min(c.box[axis] for c in unit), max(c.box[axis + 2] for c in unit)


#: A cut may pass through an outline that lies at least this share on one side of it, which goes with
#: that side: a stroke reaching under its neighbour, as 正's last stroke rises under 攵 in 政.
SIDED = 0.8


def split(part: Part, axis: int, pieces: int) -> list[Part] | None:
    """`part` cut into `pieces` along `axis` (x 0, y 1), in reading order: left to right, top to bottom.

    The cuts are where the fewest outlines cross them, and those least; an outline a cut passes
    through goes with the side that holds at least `SIDED` of it. A cut through the middle of an
    outline gives None, as does an empty piece.
    """
    best = min(_linear_partitions(part, axis, pieces), key=lambda candidate: candidate[:2], default=None)
    return None if best is None else best[2]


def _linear_partitions(part: Part, axis: int, pieces: int) -> Iterator[tuple[tuple[int, float], tuple[float, ...], list[Part]]]:
    """Nonempty partitions respecting counter ownership and the SIDED crossing limit."""
    units = _units(part.contours)
    if len(units) < pieces:
        return
    spans = [_span(u, axis) for u in units]
    centres = sorted({(a + b) / 2 for a, b in spans})
    cuts = [(centres[k] + centres[k + 1]) / 2 for k in range(len(centres) - 1)]

    def cost(cut: float) -> tuple[int, float]:
        through = [(cut - a) / max(b - a, 1) for a, b in spans if a < cut < b]
        return sum(1 for share in through if 1 - SIDED < share < SIDED), sum(min(s, 1 - s) for s in through)

    def total(chosen: tuple[float, ...]) -> tuple[int, float]:
        costs = [cost(c) for c in chosen]
        return sum(c[0] for c in costs), sum(c[1] for c in costs)

    for chosen in combinations(cuts, pieces - 1):
        crossing = total(chosen)
        if crossing[0]:
            continue
        bounds = [-math.inf, *chosen, math.inf]
        groups: list[list[Contour]] = [[] for _ in range(pieces)]
        for unit, (a, b) in zip(units, spans):
            centre = (a + b) / 2
            groups[next(i for i in range(pieces) if bounds[i] <= centre < bounds[i + 1])].extend(unit)
        if any(not g for g in groups):
            continue
        parts = [Part(g) for g in groups]
        yield crossing, chosen, parts[::-1] if axis == 1 else parts


def enclosures(part: Part, op: str) -> list[tuple[Part, Part]]:
    """The ways `part` may be cut into an enclosing and an enclosed operand under `op`: its outlines
    ranked by how far inside the closed sides they lie, the innermost k taken as the enclosed one."""
    units = _units(part.contours)
    X0, Y0, X1, Y1 = part.box

    def depth(unit: list[Contour]) -> float:
        (x0, x1), (y0, y1) = _span(unit, 0), _span(unit, 1)
        far = {"L": x0 - X0, "R": X1 - x1, "B": y0 - Y0, "T": Y1 - y1}
        return min(far[side] for side in ENCLOSE[op])

    ranked = sorted(units, key=depth, reverse=True)
    return [(Part([c for u in ranked[k:] for c in u]), Part([c for u in ranked[:k] for c in u]))
            for k in range(1, len(ranked))]


def mapped(box: Box, frame: Box, region: Box) -> Box:
    """`box`, drawn within `frame`, carried into `region` in proportion."""
    sx = (region[2] - region[0]) / max(frame[2] - frame[0], 1)
    sy = (region[3] - region[1]) / max(frame[3] - frame[1], 1)
    return (region[0] + (box[0] - frame[0]) * sx, region[1] + (box[1] - frame[1]) * sy,
            region[0] + (box[2] - frame[0]) * sx, region[1] + (box[3] - frame[1]) * sy)


# ------------------------------------------------------------------ composing
#: The positions an operand takes, by operator: left, centre, right; top, middle, bottom.
SLOTS = {"⿰": "LR", "⿲": "LCR", "⿱": "TB", "⿳": "TMB"}
#: The table's position names for a radical's positional form.
FORM_POSITION = {"left": "L", "right": "R", "top": "T", "bottom": "B"}
#: A piece's stroke count must be at least this share of its operand's most common count in that
#: place (馬 on the left has 10 strokes in most hosts and 9 in many; 其 never 5), over the first
#: `STROKE_HOSTS` hosts, once `STROKE_EVIDENCE` of them have been cut.
STROKE_SHARE = 0.25
STROKE_HOSTS = 60
#: A cut piece scaled to a `TYPICAL_SIZE` square against its fellows': the hosts looked at, how many
#: are enough to compare with, and the share of its ink it may have where a fellow has none, or of
#: the fellow's it may lack, to agree with it (𠟻's 貝 cut as 目, 噟's 口 as two bars, agreeing with
#: none). A piece agreeing with a third of them, and at least `TYPICAL_AGREE`, passes, so that a form
#: several hosts share (辶 with one dot or two) stands. Fewer hosts are measured against the operand's
#: own glyph, which stands alone: ink it lacks is as strictly kept to, what it has more loosely.
TYPICAL_SIZE = 32
TYPICAL_HOSTS = 24
TYPICAL_FEW = 4
TYPICAL_EXTRA, TYPICAL_MISSING = 0.10, 0.10
TYPICAL_AGREE = 2
TYPICAL_GLYPH = 0.2
TYPICAL_SHARE = 1 / 3
STROKE_EVIDENCE = 4
#: How much an instance taken whole is ranked down per e-fold its area must grow.
GROWN = 1.0
#: How much an instance taken whole is ranked down per e-fold its proportions must change.
STRETCHED = 4.0
#: The least share of its operand's own outlines a cut piece keeps (strokes merge when written
#: together, never down to a fraction).
KEPT = 0.5
#: How many outlines a piece the variable font draws may have beyond those it draws its operand with
#: (`_own_outlines`), each stroke an outline of its own: one or two more is a stroke drawn in two (豊
#: in 鄷), more took strokes from a neighbour (𭃌 cut from 𪘂 with 止 of 歯).
EXTRA_OUTLINES = 2
#: For a half-enclosure's enclosed part, the place whose hosts write it the same way, how many
#: of them are looked at, and what a host from there costs against one from the place itself.
KIN_PLACES = {"⿺1": "R", "⿸1": "R"}
KIN_HOSTS = 24
KIN_COST = 0.5
#: For a part on one side that only characters a fallback font draws hold there, the facing side
#: whose hosts the variable font draws in its own design (半 left of 刂 in 判, held there only by
#: Plangothic's Chinese 半, whose stem bends; this font's 伴 and 畔 hold it on the right).
FACING_PLACES = {"L": "R", "R": "L", "T": "B", "B": "T"}
#: How much a host a fallback font draws is ranked down: its strokes are merged into fewer outlines
#: and drawn to another design (令 in 𧰾, whose foot is not this font's 卩).
FOREIGN_COST = 0.5
#: How much a host with no Japanese sequence is ranked down: it may write a part in a form Japan does
#: not (奐 in 㬇, 免 in 睌, a stroke short of 喚's and 勉's).
UNJAPANESE_COST = 0.5
#: Places whose parts take positional forms, so an instance there does not stand for the part elsewhere.
SIDED_PLACES = frozenset({"L", "T"})
#: Places round another part whose parts take a combining form unlike the one they stand alone in:
#: round the lower left a sweep runs out under the other part (走 under 召 in 超, 瓦 under 十 in 瓧).
#: Above or round the upper left the form is kept (厂 in 原, 疒 in 病).
COMBINING_PLACES = frozenset({"⿺0"})
#: Places where a character wraps round another part and takes an enclosing form (戊 round 臣 in
#: 蒧, 戸 over 羽 in 扇): like a positional form, an instance there stands for it only when no
#: other place yields one.
ENCLOSING_PLACES = frozenset(op + "0" for op in ENCLOSE) - COMBINING_PLACES
#: Operands drawn across each other.
OVERLAY = "⿻"
#: Least likeness of a piece whose operand is overlaid: its sketch, the operands' own glyphs laid
#: over each other, is far from a designed shape (⿻干二 cut from 拜 scores 0.41).
LIKENESS_OVERLAID = 0.35
#: The least share of its region the opening of an overlay's first operand must take for that
#: operand to hold the other in it.
OPEN_ROOM = 0.15
#: The least share of the region each cell of a divided opening takes.
CELL_ROOM = 0.06
#: How far a part may change its proportions to fill its cell.
CELL_STRETCH = 2.2
#: How many times larger than the opposite opening that opening must be (山 0.17 against 0.01).
OPEN_ONE_SIDE = 4.0
#: Characters overlaying the same first operand looked at, and how many agree an overlaid layout.
OVERLAY_HOSTS = 24
TEACHERS_OVERLAY = 3
#: How many overlays of any operands are averaged when none share an operand.
OVERLAY_ANY = 60
#: Most a teacher's operand and the one it stands for may differ in ink, either way.
OVERLAY_INK = 2.0
#: The operator an overlay with no teacher is drawn as.
AXIS_STACK = "⿱"
#: The least share of its parts' outlines an instance of a sequence keeps (strokes may merge
#: when drawn whole, a part may not go missing).
INSTANCE_KEPT = 0.75
#: How many characters the variable font draws must hold a redrawn character whole, and how little
#: its composition may overlap the instance taken from them, for the instance to replace it.
HELD_OFTEN = 8
HELD_AGREE = 0.5
#: How many hosts after the first `Composer.rerank` tries for a ⿰ or ⿱ character's second part,
#: and its weights on (ranking score, agreement with the other drawings, rank, 1), both against
#: the first drawing: a linear fit of the overlap each drawing gains (`cache/fit_rerank.py`).
RERANK = 2
RERANK_WEIGHTS = (-0.0193, 0.3709, 0.004, 0.0014)
#: How many hosts of each place an instance of a sequence is looked for in.
INSTANCE_HOSTS = 12
#: An enclosed part's room stays this many stroke widths clear of the enclosing part's ink: drawn
#: parts come within half a stroke of it (枼 under the sweep of 尸 in 屟, 合 inside 匸 in 匼).
ROOM_MARGIN = 0.4
#: Share of an enclosed part's ink over the enclosing part's above which it is fitted clear of it.
COLLIDE = 0.03
#: A stroke of a part drawn round the lower left of another sweeps under it when it reaches this
#: share of the part's width from its right edge and of its height from its foot (毛's last stroke).
SWEEP_REACH = (0.15, 0.25)
#: The least share of its width a swept part's other strokes keep, and the share of its width at the
#: sweep's end (the hook up) moved whole rather than drawn out.
SWEEP_PRESSED = 0.4
SWEEP_END = 0.12
#: The least share of its part's height a sweep rises by.
SWEEP_RISE = 0.3
#: The least share of its part's width a sweep runs along the foot, in its lowest fifth: 毛's 乚 runs
#: 0.62 of 毛, 九's 0.34; 瓜's last stroke falls to the right at 0.12 and does not sweep.
SWEEP_FOOT = 0.3
#: How far right of a sweep's left edge it turns along its foot, past its stem.
STEM_SPAN = 90.0
#: Enclosures whose enclosed part is kept clear of the enclosing ink: under a corner's sweep (君's 口
#: below 尹, ⿸) the part tucks against it by design.
CLEARED = frozenset("⿴⿵⿶⿷⿺")
#: Least gap two neighbouring parts keep where they face each other, side by side and stacked: the
#: median gap along their facing edges, as 95% of drawn characters keep it (measured on 800).
FACING = (72.0, 53.0)
#: Most of its length a part gives up to make room for its neighbour.
SQUEEZE = 0.15
#: How an aligned operator with no teacher shares its axis: by operand ink to `power`, the middle
#: operands weighted by `middle`. Fitted on the drawn characters of each operator that cut cleanly
#: (56 ⿳, 72 ⿲): a stacked middle part is compressed, a centre column is not.
SHARES = {("⿳", 3): (0.85, 0.75), ("⿲", 3): (0.5, 0.95)}
#: Choosing a part for a box in the em: font units of mean edge distance that count as one unit of
#: mismatch, and the mismatch a part drawn inside a nested node counts as, its em place unknown.
PLACED_UNITS = 40.0
PLACED_NESTED = 0.5
#: For a transplant: how many hosts each operand is looked for in, how many cut cleanly are weighed,
#: and how far, in font units, a pair of neighbours may stand from the gap their own hosts keep
#: (ink-ratio mismatch of their siblings counted at 40 units per unit of log ratio).
TRANSPLANT_HOSTS = 80
TRANSPLANT_CANDIDATES = 20
TRANSPLANT_TOLERANCE = 40.0
#: Least number of Japanese characters that must write a positional form in a place for it to be used there.
JAPANESE_USE = 3
#: Most an operand may differ from the teacher's, in ink or in proportions, for the teacher's layout to hold.
UNLIKE = 2.0
#: Most an enclosed part's or a whole glyph's proportions may change on the way into its box.
STRETCH = 1.6
#: The same in a row of three, whose parts a designer flattens or narrows much further (大 in 器):
#: on the 19 drawn ⿳ and ⿲ characters that place a whole glyph, 0.392 at `STRETCH`, 0.513 at 4.
#: Two operands gain nothing from it (⿱ 0.640 → 0.639, ⿰ 0.652 → 0.654 on 382).
ROW_STRETCH = 4.0


def slot(op: str, index: int) -> str:
    """An operand's position: L C R T M B for the aligned operators, the operator and index for the rest."""
    return SLOTS[op][index] if op in SLOTS else f"{op}{index}"


def positional_forms() -> dict[str, list[tuple[str, str | None]]]:
    """character → its radical variants and where each stands, None where the table names no place:
    水 → [(氵, L), (氺, B)], 玉 → [(王, None), (𤣩, L)]."""
    out: dict[str, list[tuple[str, str | None]]] = {}
    for form, char, source, detail in read_rows("han-component-forms.tsv"):
        if source == "cjkvi-variants":
            out.setdefault(char, []).append((form, FORM_POSITION.get(detail.rsplit(" ", 1)[-1])))
    return out


def fitted(source: Box, target: Box, stretch: float = 0.0) -> Box:
    """`target` narrowed about its centre so that a part from `source` changes its proportions by
    at most `stretch` (`STRETCH` unless given)."""
    stretch = stretch or STRETCH
    sx = (target[2] - target[0]) / max(source[2] - source[0], 1)
    sy = (target[3] - target[1]) / max(source[3] - source[1], 1)
    x0, y0, x1, y1 = target
    if sx > sy * stretch:
        half = sy * stretch * (source[2] - source[0]) / 2
        middle = (x0 + x1) / 2
        x0, x1 = middle - half, middle + half
    elif sy > sx * stretch:
        half = sx * stretch * (source[3] - source[1]) / 2
        middle = (y0 + y1) / 2
        y0, y1 = middle - half, middle + half
    return x0, y0, x1, y1


@dataclass
class Placed:
    """A part drawn into `target` from `source`, thickened by `weight`: the share of the way to
    the heavy master its points move, along x and along y. `native` is the density of the glyph the part
    was drawn in, which set its strokes' width."""

    part: Part
    source: Box
    target: Box
    weight: tuple[float, float] = (0.0, 0.0)
    native: float = 0.0
    #: Where the part comes from: "teacher 謌", "host 何" or "glyph 王".
    origin: str = ""

    @property
    def scale(self) -> tuple[float, float]:
        return ((self.target[2] - self.target[0]) / max(self.source[2] - self.source[0], 1),
                (self.target[3] - self.target[1]) / max(self.source[3] - self.source[1], 1))

    def contours(self) -> list[np.ndarray]:
        scale = np.array(self.scale)
        centre = np.array([(self.source[0] + self.source[2]) / 2, (self.source[1] + self.source[3]) / 2])
        goal = np.array([(self.target[0] + self.target[2]) / 2, (self.target[1] + self.target[3]) / 2])
        weight = np.array(self.weight)
        return [(c.light + (c.heavy - c.light) * weight - centre) * scale + goal for c in self.part.contours]


def _share(box: Box, frame: Box) -> Box:
    """`box` as shares of `frame`: (0, 0, 1, 1) fills it."""
    w, h = max(frame[2] - frame[0], 1), max(frame[3] - frame[1], 1)
    return ((box[0] - frame[0]) / w, (box[1] - frame[1]) / h, (box[2] - frame[0]) / w, (box[3] - frame[1]) / h)


@dataclass
class Host:
    """A node of a drawn character cut into its operands: the character, the pieces, the box of the
    node's ink, and the mean gap between the pieces. A teacher also carries `layout`, each
    operand's box as shares of the node's, agreed among the closest teachers."""

    char: str
    pieces: list[Part]
    frame: Box
    gap: float
    layout: list[Box] | None = None
    #: Whether the node is the whole character, so its pieces stand where the designer put them in the em.
    whole: bool = False


class _FittedEnclosure(list[Placed]):
    """Root hosted enclosure with a feasible bare-inner fit before balancing or guidance."""


class _Exclusion(set):
    """Excluded characters that note, for each cache entry being computed, every character asked
    about; iterating or sizing the set notes None, a dependence on all of it."""

    def __init__(self, items=(), frames: list[set] | None = None):
        super().__init__(items)
        self.frames = frames if frames is not None else []

    def _note(self, item) -> None:
        if self.frames:
            self.frames[-1].add(item)

    def __contains__(self, item) -> bool:
        self._note(item)
        return set.__contains__(self, item)

    def __iter__(self):
        self._note(None)
        return set.__iter__(self)

    def __len__(self) -> int:
        self._note(None)
        return set.__len__(self)

    def __bool__(self) -> bool:
        self._note(None)
        return set.__len__(self) > 0

    def __and__(self, other):
        self._note(None)
        return set(set.__iter__(self)) & other

    __rand__ = __and__


@dataclass
class Composer:
    font: Font
    sequences: dict[str, str]
    #: Characters nothing is taken from: the character being drawn, when an encoded one is redrawn to test.
    exclude: set[str] = field(default_factory=set)
    #: Whether layouts and parts come from drawn characters, and whether strokes are brought to the
    #: weight the result's density calls for. With both off, each operand's own glyph is squeezed
    #: into its share, the plainest way to compose, for comparison.
    hosted: bool = True
    #: None takes the style's own setting (Kaisho's static brush keeps its weights).
    weighted: bool | None = None
    #: How many of the closest teachers the layout is agreed among.
    teachers: int = 3
    #: A learned layout (`compose_layout.LayoutModel`) for a whole character's two operands, when loaded.
    layout: object | None = None
    #: Where a character stands alone (`compose_standalone.StandaloneModel`), when loaded.
    standalone: object | None = None
    #: A `kanjivg_cuts.Cutter` cutting hosts along KanjiVG's component groups, when set.
    kvg: object | None = None
    #: Whether an encoded character redrawn without its glyph that the learned layout cannot place
    #: whole from hosts is taken whole from where other characters draw it; an atomic one always is.
    reuse: bool = True
    #: A `compose_guide.Guide` whose ink each stroke group is nudged toward at the end, when set.
    guide: object | None = None
    #: Whether a two-part ⿰ or ⿱ character is also drawn with its second part from the hosts ranked
    #: next (`RERANK`), and the drawing `RERANK_WEIGHTS` expect to match its glyph best is kept. It
    #: draws each such character three times, so it suits builds that store their results.
    rerank: bool = False
    _rank_pick: int = field(default=0, init=False, repr=False)
    _root_ranks: list[float] = field(default_factory=list, init=False, repr=False)
    _expanding: set[str] = field(default_factory=set, init=False, repr=False)
    _inks: dict[str, float] = field(default_factory=dict, init=False, repr=False)
    _own_counts: dict[str, int | None] = field(default_factory=dict, init=False, repr=False)
    #: Entries that depend on the exclusion, each as (value, characters its computation asked about).
    _any_overlays: dict[None, tuple] = field(default_factory=dict, init=False, repr=False)
    _faces: dict[None, tuple] = field(default_factory=dict, init=False, repr=False)
    _hosts: dict[tuple, tuple] = field(default_factory=dict, init=False, repr=False)
    _sketches: dict[str, tuple] = field(default_factory=dict, init=False, repr=False)
    _strokes: dict[tuple[str, str], tuple] = field(default_factory=dict, init=False, repr=False)
    _templates: dict[tuple[str, str], tuple] = field(default_factory=dict, init=False, repr=False)
    _typical: dict[tuple[str, str], tuple] = field(default_factory=dict, init=False, repr=False)
    _frames: list[set] = field(default_factory=list, init=False, repr=False)
    _reference_exclude: frozenset[str] = field(default_factory=frozenset, init=False, repr=False)

    def __post_init__(self) -> None:
        if self.weighted is None:
            self.weighted = getattr(getattr(self.font, "style", None), "weighted", True)

    @cached_property
    def by_sequence(self) -> dict[str, str]:
        """The drawn character each sequence describes."""
        return {seq: char for char, seq in self.sequences.items() if self.font.has(char)}

    @cached_property
    def twins(self) -> dict[str, frozenset[str]]:
        """Characters the font draws alike, each with the others: one glyph under two code points, or
        one sequence drawn with the same outlines twice (胶 and 㬵). A character redrawn to test takes
        its twins out with it, or it would be drawn from its own glyph under another name."""
        groups: dict = {}
        by_seq: dict[str, list[str]] = {}
        cmap = getattr(self.font, "cmap", {})
        for char, seq in self.sequences.items():
            if len(char) == 1 and self.font.has(char):
                by_seq.setdefault(seq, []).append(char)
                name = cmap.get(ord(char))
                if name is not None:
                    groups.setdefault(("name", name), set()).add(char)
        for seq, chars in by_seq.items():
            if len(chars) > 1:
                for char in chars:
                    glyph = self.font.glyph(char)
                    contours = getattr(glyph, "contours", None)
                    outline = tuple(np.round(np.concatenate([c.light for c in contours]).ravel(), 1)) if contours else None
                    if outline is not None:
                        groups.setdefault(("outline", seq, outline), set()).add(char)
        out: dict[str, set[str]] = {}
        for chars in groups.values():
            if len(chars) > 1:
                for char in chars:
                    out.setdefault(char, set()).update(chars - {char})
        return {char: frozenset(others) for char, others in out.items()}

    @cached_property
    def forms(self) -> dict[str, list[tuple[str, str | None]]]:
        return positional_forms()

    @cached_property
    def _index(self) -> tuple[dict, dict]:
        """(slot, operand) → drawn characters holding that operand there, and operator → drawn
        characters with a node of it; each with its tree and the path of positions to the node."""
        hosts: dict[tuple[str, str], list] = {}
        templates: dict[str, list] = {}

        def walk(char: str, tree: tuple, node: Node, path: tuple, names: dict, hosts: dict, templates: dict) -> None:
            if not isinstance(node, tuple) or (node[0] not in AXIS and node[0] not in ENCLOSE and node[0] != OVERLAY):
                return
            templates.setdefault(node[0], []).append((char, tree, path))
            for i, child in enumerate(node[1:]):
                entry = (char, tree, path, i)
                hosts.setdefault((slot(node[0], i), key(child)), []).append(entry)
                if id(child) in names:
                    # A component written out from its own sequence is found under its name too.
                    hosts.setdefault((slot(node[0], i), names[id(child)]), []).append(entry)
                walk(char, tree, child, path + (i,), names, hosts, templates)

        trees = {}
        for char, seq in self.sequences.items():
            if self.font.has(char):
                try:
                    trees[char] = parse(seq)
                except ValueError:
                    continue
                walk(char, trees[char], trees[char], (), {}, hosts, templates)
        # A part fewer than `EXPAND_FEW` characters write out is also found inside components
        # that hold it whole (夂 in 拠's 処). Only there: cutting every character along its
        # components' own sequences cuts it finer than it is drawn.
        expanded_hosts: dict = {}
        for char, tree in trees.items():
            names: dict = {}
            expanded = self._expanded(tree, char, names, EXPAND_DEPTH)
            if names:
                walk(char, expanded, expanded, (), names, expanded_hosts, {})
        for k, entries in expanded_hosts.items():
            if len(hosts.get(k, ())) < EXPAND_FEW:
                have = {e[0] for e in hosts.get(k, ())}
                hosts.setdefault(k, []).extend(e for e in entries if e[0] not in have)
        return hosts, templates

    def _expanded(self, node: Node, char: str, names: dict, depth: int) -> Node:
        """`node` with each compound component written out from its own sequence, `depth` levels
        down (拠 ⿰扌処 as ⿰扌⿺夂几), so a character holding a component whole is a host for its
        parts. Single-body characters stay whole. `names` records each written-out node's name."""
        if isinstance(node, tuple):
            return (node[0], *(self._expanded(k, char, names, depth) for k in node[1:]))
        if depth <= 0 or node == char or node in self.atomic or node not in self.sequences:
            return node
        try:
            own = parse(self.sequences[node])
        except ValueError:
            return node
        if not isinstance(own, tuple) or own[0] not in AXIS and own[0] not in ENCLOSE:
            return node
        out = self._expanded(own, char, names, depth - 1)
        names[id(out)] = node
        return out

    @cached_property
    def _places(self) -> dict[str, list[tuple[str, str]]]:
        """operand → the (place, operand) keys it is held under."""
        out: dict[str, list[tuple[str, str]]] = {}
        for place, written in self._index[0]:
            out.setdefault(written, []).append((place, written))
        return out

    @cached_property
    def spelled(self) -> set[str]:
        return spelled_nodes()

    @cached_property
    def hands(self) -> dict[str, str]:
        return hand_forms()

    @cached_property
    def atomic(self) -> set[str]:
        return atomic_characters()

    @property
    def face(self) -> Box:
        """The median box of permitted full ideographs, or the em when none are available."""
        def median() -> Box:
            boxes = [g.box for char in FULL if char not in self.exclude if (g := self.font.glyph(char)) is not None]
            return tuple(float(v) for v in np.median(np.array(boxes), axis=0)) if boxes else (0.0, ASCENT - EM, EM, ASCENT)
        return self._memo(self._faces, None, median)

    def ink(self, node: Node, part: Part | None = None, seen: frozenset[str] = frozenset()) -> float:
        """Permitted outline length, or an IDS estimate for missing and excluded glyphs. Unknown
        analyses use permitted 永, or one em of nominal outline when it is unavailable."""
        if part is not None:
            return sum(float(np.linalg.norm(np.diff(np.vstack([c.light, c.light[:1]]), axis=0), axis=1).sum())
                       for c in part.contours)
        self._reference_context()
        if isinstance(node, tuple):
            return sum(self.ink(n, seen=seen) for n in node[1:])
        if node not in self.exclude:
            if node not in self._inks:
                glyph = self.font.glyph(node)
                if glyph is not None:
                    self._inks[node] = self.ink(node, glyph)
            if node in self._inks:
                return self._inks[node]
        if node in self.sequences and node not in seen:
            try:
                return self.ink(parse(self.sequences[node]), seen=seen | {node})
            except ValueError:
                pass
        # Unknown or cyclic analyses use permitted 永; without it, one em of nominal outline.
        glyph = self.font.glyph("永") if "永" not in self.exclude else None
        return self.ink("", glyph) if glyph is not None else float(EM)

    def aspect(self, node: Node, seen: frozenset[str] = frozenset()) -> float:
        """An operand's natural width over height: its glyph's, or for a sequence the operands'
        put side by side or stacked; an enclosure takes its enclosing operand's."""
        self._reference_context()
        if isinstance(node, str):
            glyph = self.font.glyph(node) if node not in self.exclude else None
            if glyph is not None:
                return max(glyph.box[2] - glyph.box[0], 1) / max(glyph.box[3] - glyph.box[1], 1)
            if node in self.sequences and node not in seen:
                try:
                    return self.aspect(parse(self.sequences[node]), seen | {node})
                except ValueError:
                    pass
            return 1.0
        encoded = self.by_sequence.get(key(node))
        if encoded is not None and encoded not in self.exclude and encoded not in seen:
            return self.aspect(encoded, seen)
        parts = [self.aspect(n, seen) for n in node[1:]]
        if node[0] in ("⿰", "⿲"):
            return sum(parts)
        if node[0] in ("⿱", "⿳"):
            return 1 / sum(1 / a for a in parts)
        return parts[0]

    @cached_property
    def _plain(self) -> Composer:
        # The plain composer asks the same exclusion, so what it reads joins the entry being computed.
        font, excluded = self.font, _Exclusion(set.__iter__(self.exclude), self._frames)

        class ReferenceFont:
            def glyph(self, char: str) -> Part | None:
                if char in excluded:
                    raise LookupError(f"Excluded reference glyph: {char}")
                return font.glyph(char)

            def has(self, char: str) -> bool:
                return char not in excluded and font.has(char)

            def __getattr__(self, name):
                return getattr(font, name)

        plain = Composer(ReferenceFont(), self.sequences, hosted=False, weighted=False, exclude=excluded)
        plain._frames = self._frames
        return plain

    def _sketch(self, node: tuple) -> Part | None:
        """A sequence drawn on its own the plain way, from its operands' own glyphs, as one part to
        compare pieces with; None when it cannot be drawn."""
        def draw() -> Part | None:
            try:
                placed = self._plain._node(node, self._plain.face)
            except LookupError:
                return None
            contours = [Contour(c.ops, points, points) for p in placed for c, points in zip(p.part.contours, p.contours())]
            return Part(contours) if contours else None
        return self._memo(self._sketches, key(node), draw, pending=True)

    def likeness(self, part: Part, node: Node) -> float:
        """How much a piece looks like its operand's own glyph, each stretched to fill a square; 1
        for an operand with no glyph. An operand written as a sequence is compared with that sequence
        drawn on its own. Proportions far from the operand's (a lone stroke of 口) count
        as no likeness, since stretching would hide them."""
        own = self._operand_shape(node)
        if own is None:
            return 0.0 if isinstance(node, tuple) and (key(node) not in self.by_sequence or self.by_sequence[key(node)] in self.exclude) else 1.0
        return self._shape_likeness(part, own)

    def _operand_shape(self, node: Node) -> Part | None:
        """A comparison glyph or a sketch of an unencoded sequence."""
        self._reference_context()
        encoded = self.by_sequence.get(key(node)) if isinstance(node, tuple) else node
        if isinstance(node, tuple) and (encoded is None or encoded in self.exclude):
            return self._sketch(node)
        return None if encoded in self.exclude else self.font.glyph(encoded)

    def _shape_likeness(self, part: Part, own: Part) -> float:
        """Overlap with a reference, guarded by aspect and outline-density differences."""
        aspect = lambda box: max(box[2] - box[0], 1) / max(box[3] - box[1], 1)
        if abs(math.log(aspect(part.box) / aspect(own.box))) > 1.2:
            return 0.0
        # As much outline for its size as the operand's: one dot of 馬 is not 馬.
        density = lambda p: self.ink("", p) / max(p.box[2] - p.box[0] + p.box[3] - p.box[1], 1)
        # A piece or reference with no outline length is like nothing (a serif cut of 固 met one).
        if min(density(part), density(own)) <= 0 or abs(math.log(density(part) / density(own))) > math.log(DENSER):
            return 0.0
        a, b = _shape(part), _shape(own)
        return float((a & b).sum()) / max(float((a | b).sum()), 1.0)

    def _linear(self, part: Part, node: tuple) -> list[Part] | None:
        """Choose boundaries by the operands' geometry, with crossing cost breaking ties."""
        references = [self._operand_shape(n) for n in node[1:]]
        if any(reference is None and isinstance(n, tuple)
               and (key(n) not in self.by_sequence or self.by_sequence[key(n)] in self.exclude)
               for n, reference in zip(node[1:], references)):
            return None
        least = [LIKENESS_OVERLAID if OVERLAY in key(n) else LIKENESS for n in node[1:]]
        scores: dict[tuple[int, tuple[int, ...]], float] = {}
        best = None
        for crossing, cuts, pieces in _linear_partitions(part, AXIS[node[0]], len(node) - 1):
            known = []
            for i, (piece, reference) in enumerate(zip(pieces, references)):
                if reference is None:
                    continue
                group = (i, tuple(id(c) for c in piece.contours))
                if group not in scores:
                    scores[group] = self._shape_likeness(piece, reference)
                score = scores[group]
                if score < least[i]:
                    break
                known.append(score)
            else:
                rank = (-min(known, default=0.0), -sum(known), crossing, cuts)
                if best is None or rank < best[0]:
                    best = rank, pieces
        return None if best is None else best[1]

    def _cut(self, part: Part, node: tuple, strict: bool = True) -> tuple[list[Part], float] | None:
        """`part`, drawn as `node`, cut into its operands with the mean gap between them; None when
        no clean cut exists or a piece does not look like its operand. Strictly, each piece must
        also have as many strokes as that operand usually has in that place (`strokes`): the
        variable font keeps each stroke an outline of its own, so a piece with a stroke too many
        or too few took one from its neighbour or left one behind."""
        if node[0] not in AXIS and node[0] not in ENCLOSE:
            return None
        if node[0] in ENCLOSE:
            best = None
            guided = self._guided(part, node)
            for outer, inner in ([guided[:2]] if guided else []) + enclosures(part, node[0]):
                if strict and not (self._counted(outer, node[0], 0, node[1]) and self._counted(inner, node[0], 1, node[2])):
                    continue
                # A piece with under half its operand's own strokes is a stroke or two of something
                # else (one stroke of 鬼 taken for 厶); a positional form keeps most of them (忄, 氵).
                if any(isinstance(n, str) and 2 * len(p.contours) < self._outlines(n) for p, n in ((outer, node[1]), (inner, node[2]))):
                    continue
                if node[0] == "⿺" and outer.box[2] < (inner.box[0] + inner.box[2]) / 2:
                    # The part round the lower left sweeps under the other, past its middle; a cut of
                    # interlocking outlines can give that stroke away to it (尢's in 尮).
                    continue
                # The guided cut's enclosing part is measured against the enclosing form it was cut
                # by: an operand's own glyph (走's short sweep) is far from that form.
                a = guided[2] if guided and outer is guided[0] else self.likeness(outer, node[1])
                b = self.likeness(inner, node[2])
                if a >= SURE and isinstance(node[2], tuple) and len(inner.contours) == self._outlines(node[2]):
                    # The enclosing part is unmistakable and what it holds has the inner sequence's
                    # strokes: a sketch of that sequence (⺀ stacked on 㐅) cannot show how a
                    # designer interlocked them (図).
                    b = max(b, LIKENESS)
                if a >= LIKENESS and b >= LIKENESS and (best is None or a + b > best[0]):
                    best = (a + b, [outer, inner])
            return None if best is None else (best[1], 0.0)
        axis = AXIS[node[0]]
        pieces = self._linear(part, node)
        if pieces is None:
            pieces = self._matched(part, node) if len(node) == 3 and OVERLAY in key(node) else None
            if pieces is None:
                return None
        if strict and not all(self._counted(p, node[0], i, n) for i, (p, n) in enumerate(zip(pieces, node[1:]))):
            return None
        spans = sorted((p.box[axis], p.box[axis + 2]) for p in pieces)
        return pieces, float(np.mean([spans[k + 1][0] - spans[k][1] for k in range(len(spans) - 1)]))

    def _reference_context(self) -> None:
        """Keep reference masks and the cuts derived from them in the current exclusion context: an
        entry stays while every character its computation asked about is excluded as it was."""
        if not isinstance(self.exclude, _Exclusion) or self.exclude.frames is not self._frames:
            self.exclude = _Exclusion(set.__iter__(self.exclude) if isinstance(self.exclude, _Exclusion) else self.exclude, self._frames)
        excluded = frozenset(set.__iter__(self.exclude))
        if excluded:
            grown = excluded.union(*(self.twins.get(c, ()) for c in excluded))
            if grown != excluded:
                set.update(self.exclude, grown)
                excluded = grown
        changed = excluded ^ self._reference_exclude
        if changed:
            for store in (self._templates, self._typical, self._strokes, self._sketches, self._faces, self._any_overlays, self._hosts):
                for k in [k for k, (_, asked) in store.items() if None in asked or not asked.isdisjoint(changed)]:
                    del store[k]
            self.__dict__.pop("_plain", None)
            self._reference_exclude = excluded

    def _memo(self, store: dict, name, compute, pending: bool = False):
        """`store[name]`, computed in the current exclusion context and kept with the characters its
        computation asked about; those join any entry being computed around it. With `pending`, a
        computation that reaches its own entry gets None."""
        self._reference_context()
        if name in store:
            value, asked = store[name]
        else:
            if pending:
                store[name] = (None, set())
            self._frames.append(set())
            try:
                value = compute()
            except BaseException:
                store.pop(name, None)
                raise
            finally:
                asked = self._frames.pop()
            store[name] = (value, asked)
        if self._frames:
            self._frames[-1].update(asked)
        return value

    def _enclosing_ink(self, op: str, operand: str) -> np.ndarray | None:
        """Where an enclosing operand's ink lies in its node's frame, as the mean of up to
        `TEMPLATES` masks of it cut by KanjiVG's groups (走 from 赴 起 超 …), or None without them.
        A mean of several keeps any one character's glyph from deciding how others are cut."""
        def mean() -> np.ndarray | None:
            hosts, _ = self._index
            masks = []
            for char, tree, path, i in hosts.get((slot(op, 0), operand), []) if self.kvg is not None else []:
                if len(masks) >= TEMPLATES:
                    break
                if char in self.exclude:
                    continue
                found = self.kvg.host_node(char, tree, path)
                if found is not None and len(found.pieces) == 2:
                    piece = found.pieces[i]
                    frame = Part([c for p in found.pieces for c in p.contours]).box
                    masks.append(fill(_rings(piece.contours, [c.light for c in piece.contours], steps=2), TEMPLATE_SIZE, frame))
            return np.mean(masks, axis=0) if len(masks) >= 3 else None
        return self._memo(self._templates, (op, operand), mean)

    @cached_property
    def _by_lower(self) -> dict[str, list[tuple[str, Node]]]:
        """lower operand → the characters written as something over it (走 and 足 over 龰), with their trees."""
        out: dict[str, list[tuple[str, Node]]] = {}
        for char, seq in self.sequences.items():
            try:
                tree = parse(seq)
            except ValueError:
                continue
            if isinstance(tree, tuple) and tree[0] == "⿱" and isinstance(tree[2], str):
                out.setdefault(tree[2], []).append((char, tree))
        return out

    def _kin_outer(self, op: str, outer: Node, inner: Node, box: Box, inner_box: Box) -> list[Placed] | None:
        """An enclosing part no character draws in that place, from one written over the same lower
        part that many do: 足 round 羽 in 䟳 as 走's sweep, cut from a host, under 口 in 土's place.
        None when the outer is written otherwise or has no such kin."""
        if not isinstance(outer, str) or outer not in self.sequences:
            return None
        try:
            own = parse(self.sequences[outer])
        except ValueError:
            return None
        if not (isinstance(own, tuple) and own[0] == "⿱" and isinstance(own[2], str)):
            return None
        hosts, _ = self._index
        place, best = slot(op, 0), None
        for other, tree in self._by_lower.get(own[2], []):
            count = sum(1 for e in hosts.get((place, other), []) if e[0] not in self.exclude)
            if other != outer and count >= KIN_OUTER_HOSTS and (best is None or count > best[0]):
                best = (count, other, tree)
        if best is None:
            return None
        _, other, tree = best
        if self.kvg is None:
            return None
        entries = {e[0]: e for e in hosts.get((place, other), []) if e[0] not in self.exclude}
        # The kin cut along KanjiVG's groups of its own two parts (走 into 土 and 龰), whose outlines
        # interlock too closely for a geometric cut: so only from characters KanjiVG draws, the
        # best ranked first (the best ranked are often rarer than it covers).
        ranked = [found.char for _, found, _ in self._ranked(op, 0, other, [inner], box, placed=True)]
        chars = list(dict.fromkeys(ranked + list(entries)))
        for char in [ch for ch in chars if ch in self.kvg.entries and self.font.own(ch)][:KIN_TRIED]:
            char, host_tree, path, i = entries[char]
            cut = self.kvg.host_node(char, _replaced(host_tree, path + (i,), tree), path + (i,))
            if cut is None or len(cut.pieces) != 2:
                continue
            top, lower = cut.pieces
            frame = Part(top.contours + lower.contours).box
            native = self.ink(char)
            placed = [Placed(lower, lower.box, mapped(lower.box, frame, box), native=native, origin=f"kin {char}")]
            room = mapped(top.box, frame, box)
            upper = self._upper(outer, own)
            if upper is not None:
                # In the kin's upper part's room, short of the enclosed part's box by the gap
                # neighbours keep, its proportions kept within `STRETCH`.
                part, source = upper
                right = min(room[2], inner_box[0] - FACING[0]) if op in "⿺⿸" else room[2]
                target = fitted(part.box, (room[0], room[1], max(right, room[0] + (room[2] - room[0]) / 3), room[3]))
                placed.append(Placed(part, part.box, target, native=self.ink(source), origin=f"kin {source}"))
            else:
                placed += self._node(own[1], room)
            return placed
        return None

    def _upper(self, outer: str, own: tuple) -> tuple[Part, str] | None:
        """The upper part of `outer` (written `own`, ⿱ over its lower part) as characters holding
        `outer` on their left draw it, narrow as it stands over a sweep (⻊'s 口), cut along
        KanjiVG's groups; with the character it comes from."""
        hosts, _ = self._index
        entries = [e for written in self.alternatives(outer, "L") for e in hosts.get(("L", written), [])
                   if e[0] not in self.exclude and e[0] in self.kvg.entries and self.font.own(e[0])]
        for char, tree, path, i in entries[:UPPER_HOSTS]:
            cut = self.kvg.host_node(char, _replaced(tree, path + (i,), own), path + (i,))
            if cut is not None and len(cut.pieces) == 2:
                return cut.pieces[0], char
        return None

    def _guided(self, part: Part, node: tuple) -> tuple[Part, Part, float] | None:
        """An enclosure cut along where its enclosing operand's clean cuts have ink (`_enclosing_ink`):
        each outline lying mostly there goes to the enclosing part, which is answered with its overlap
        with the template's ink. The geometric cut ranks outlines
        by their distance from the closed sides, so strokes of the enclosed part that rest on them
        (支's lower strokes on 走's sweep) go with the enclosing part."""
        if not isinstance(node[1], str):
            return None
        template = self._enclosing_ink(node[0], node[1])
        if template is None:
            return None
        ink = form = template >= 0.5
        for _ in range(TEMPLATE_GROW):
            grown = ink.copy()
            grown[1:] |= ink[:-1]; grown[:-1] |= ink[1:]; grown[:, 1:] |= ink[:, :-1]; grown[:, :-1] |= ink[:, 1:]
            ink = grown
        outer, inner, drawn = [], [], np.zeros_like(form)
        for unit in _units(part.contours):
            mask = fill(_rings(unit, [c.light for c in unit], steps=2), TEMPLATE_SIZE, part.box)
            on = float((mask & ink).sum()) / max(float(mask.sum()), 1.0)
            if on >= TEMPLATE_ON:
                outer.extend(unit)
                drawn |= mask
            else:
                inner.extend(unit)
        if not outer or not inner:
            return None
        return Part(outer), Part(inner), float((drawn & form).sum()) / max(float((drawn | form).sum()), 1.0)

    def _matched(self, part: Part, node: tuple) -> list[Part] | None:
        """`part` cut into two operands, one of them drawn across something (⿻), by shape where no
        clean line separates them (傘's 𠆢 resting on the overlaid strokes): outlines taken in
        reading order, the first k given to the first operand, at the k whose two pieces look most
        like their operands."""
        axis = AXIS[node[0]]
        units = sorted(_units(part.contours), key=lambda u: sum(_span(u, axis)) * (-1 if axis else 1))
        best = None
        for k in range(1, len(units)):
            pieces = [Part([c for u in units[:k] for c in u]), Part([c for u in units[k:] for c in u])]
            scores = [self.likeness(p, n) for p, n in zip(pieces, node[1:])]
            least = [LIKENESS_OVERLAID if OVERLAY in key(n) else LIKENESS for n in node[1:]]
            if all(a >= b for a, b in zip(scores, least)) and (best is None or sum(scores) > best[0]):
                best = (sum(scores), pieces)
        return None if best is None else best[1]

    def _counted(self, piece: Part, op: str, index: int, node: Node) -> bool:
        """Whether a piece has a number of strokes its operand commonly has in that place."""
        if not isinstance(node, str):
            return True
        expected = self._own_outlines(node)
        if (piece.contours and piece.contours[0].width is None and expected
                and len(piece.contours) > expected + EXTRA_OUTLINES):
            return False
        if not self._like_fellows(piece, slot(op, index), node):
            return False
        if piece.contours and piece.contours[0].width is None and len(piece.contours) == expected:
            # Drawn with its operand's own strokes, whatever most hosts there draw (巳 left of 攵 in
            # 攺, where most hosts nest a smaller 巳 atop another part, as in 巽).
            return True
        counts = self.strokes(slot(op, index), node)
        if sum(counts.values()) < STROKE_EVIDENCE:
            return True
        common = max(counts.values())
        return counts.get(len(piece.contours), 0) >= STROKE_SHARE * common

    def _like_fellows(self, piece: Part, place: str, operand: str) -> bool:
        """Whether a piece, scaled to a square, keeps to the shape the operand's other pieces in that
        place take there, or to its own glyph's where few hosts hold it."""
        reference = self._consensus(place, operand)
        if reference is None:
            return True
        shapes, fellows = reference
        mask = _square(piece)
        if not mask.any():
            return True
        grown = _grown_mask(mask, 2)

        def agrees(shape: np.ndarray, extra: float, missing: float) -> bool:
            return ((mask & ~_grown_mask(shape, 2)).sum() <= extra * mask.sum()
                    and (shape & ~grown).sum() <= missing * max(shape.sum(), 1))

        if fellows:
            need = max(TYPICAL_AGREE, math.ceil(TYPICAL_SHARE * len(shapes)))
            return sum(agrees(shape, TYPICAL_EXTRA, TYPICAL_MISSING) for shape in shapes) >= need
        return agrees(shapes[0], TYPICAL_EXTRA, TYPICAL_GLYPH)

    def _consensus(self, place: str, operand: str) -> tuple[list[np.ndarray], bool] | None:
        """The shapes of an operand's pieces in a place, cut without this check, and whether they come
        from them; else its own glyph's alone; None for neither."""
        def cut() -> list[tuple[str, np.ndarray]]:
            hosts, _ = self._index
            masks = []
            seen = set()
            for char, tree, path, i in hosts.get((place, operand), []):
                if char in seen or char in self.exclude:
                    continue
                found = self._host_node(char, tree, path, strict=False)
                if found is not None:
                    mask = _square(found.pieces[i])
                    if mask.any():
                        masks.append((char, mask))
                        seen.add(char)
                        if len(masks) >= TYPICAL_HOSTS:
                            break
            return masks
        masks = [mask for _, mask in self._memo(self._typical, (place, operand), cut)]
        if len(masks) >= TYPICAL_FEW:
            return masks, True
        glyph = self.font.glyph(operand) if operand not in self.exclude and self.font.own(operand) else None
        return ([_square(glyph)], False) if glyph is not None else None

    def _kept(self, piece: Part, node: Node) -> bool:
        """Whether a piece keeps enough of its operand's own outlines to be it: a cut that gives 戈
        one outline of its four took the rest elsewhere."""
        own = self._outlines(node)
        return not own or KEPT * own <= len(piece.contours)

    def strokes(self, place: str, operand: str) -> Counter:
        """How many strokes (outlines) an operand's piece has, over the drawn characters holding it
        in `place`, each cut without this check."""
        def count() -> Counter:
            hosts, _ = self._index
            counts: Counter = Counter()
            usable = 0
            for char, tree, path, i in hosts.get((place, operand), []):
                if char in self.exclude:
                    continue
                found = self._host_node(char, tree, path, strict=False)
                if found is not None:
                    counts[len(found.pieces[i].contours)] += 1
                    usable += 1
                    if usable >= STROKE_HOSTS:
                        break
            return counts
        return self._memo(self._strokes, (place, operand), count)

    def _host_node(self, char: str, tree: tuple, path: tuple, strict: bool = True) -> Host | None:
        """The node `path` leads to in `char`, cut into its operands, level by level: along KanjiVG's
        component groups when a cutter is set and it can (`kanjivg_cuts`), else by geometry."""
        return self._memo(self._hosts, (char, key(tree), path, strict), lambda: self._cut_host(char, tree, path, strict))

    def _cut_host(self, char: str, tree: tuple, path: tuple, strict: bool) -> Host | None:
        if self.kvg is not None:
            found = self.kvg.host_node(char, tree, path)
            node = tree
            for step in path:
                node = node[1 + step]
            if (found is not None and all(self._kept(p, n) for p, n in zip(found.pieces, node[1:]))
                    and not self._traded(found.pieces, node[1:])
                    and (not strict or all(self._like_fellows(p, slot(node[0], k), n) for k, (p, n) in enumerate(zip(found.pieces, node[1:]))
                                           if isinstance(n, str)))):
                return found
        part, node = self.font.glyph(char), tree
        for step in path:
            cut = self._cut(part, node, strict)
            if cut is None:
                return None
            part, node = cut[0][step], node[1 + step]
        cut = self._cut(part, node, strict)
        if cut is None or self._traded(cut[0], node[1:]):
            return None
        return Host(char, cut[0], part.box, cut[1], whole=not path)

    def _traded(self, pieces: list[Part], operands: list[Node]) -> bool:
        """Whether pieces the variable font draws traded a stroke: one has fewer outlines than its
        operand is drawn with while another has more (囗's bottom stroke cut into ⺀㐅 in 図)."""
        if not all(p.contours and p.contours[0].width is None for p in pieces):
            return False
        expected = [self._own_outlines(n) for n in operands]
        if not all(expected):
            return False
        short = any(len(p.contours) < e for p, e in zip(pieces, expected))
        over = any(len(p.contours) > e for p, e in zip(pieces, expected))
        return short and over

    def alternatives(self, node: Node, place: str) -> list[str]:
        """What an operand may be drawn as in `place`: itself, then its positional forms there
        (王 on the left as 𤣩, 水 on the left as 氵)."""
        out = [key(node)]
        if isinstance(node, tuple) and key(node) in self.by_sequence:
            # A sequence that describes a drawn character may be found as that character (⿰生生 as 甡).
            node = self.by_sequence[key(node)]
            out.append(node)
        if isinstance(node, str):
            # The operand's own positional forms, then those of the character it is a variant of (王 of
            # 玉), as Japanese characters write them there: the table also lists Chinese simplified
            # forms (讠 beside 訁), which a Japanese font does not draw in these places.
            forms = []
            for base in (node, *self.bases.get(node, ())):
                forms.extend(form for form, where in self.forms.get(base, []) if where == place and form not in out + forms)
            used = sorted((f for f in forms if self.usage[(place, f)] >= JAPANESE_USE), key=lambda f: -self.usage[(place, f)])
            out.extend(used)
        return out

    @cached_property
    def japanese(self) -> set[str]:
        """The characters with a Japanese sequence (`japanese_characters`)."""
        return japanese_characters()

    @cached_property
    def usage(self) -> Counter:
        """(position, operand) → how many characters with a Japanese sequence write that operand there."""
        hosts, _ = self._index
        japanese = self.japanese
        return Counter({k: sum(1 for char, *_ in v if char in japanese) for k, v in hosts.items()})

    @cached_property
    def bases(self) -> dict[str, list[str]]:
        """variant → the characters the table gives it as a radical variant of: 王 → [玉]."""
        out: dict[str, list[str]] = {}
        for char, forms in self.forms.items():
            for form, _ in forms:
                out.setdefault(form, []).append(char)
        return out

    def _host(self, op: str, index: int, node: Node, siblings: list[Node], box: Box,
              placed: bool = False) -> tuple[Host, int] | None:
        """The drawn part closest to what `node` needs at `index` of `op` inside `box`: written as the
        operand or a positional form of it, beside siblings that hold about as much ink, at about
        the size and proportions of `box`. With `placed`, `box` is in the em, and a part a character
        draws at its top level close to that very box is preferred: it needs the least scaling."""
        ranked = self._ranked(op, index, node, siblings, box, placed)
        if not ranked:
            return None
        if placed and index == 1:
            self._root_ranks = [float(score[1]) for score, _, _ in ranked[:RERANK + 1]]
            if 0 < self._rank_pick < len(ranked):
                return ranked[self._rank_pick][1], ranked[self._rank_pick][2]
        return ranked[0][1], ranked[0][2]

    def _ranked(self, op: str, index: int, node: Node, siblings: list[Node], box: Box,
                placed: bool = False) -> list[tuple[tuple, Host, int]]:
        """Every host `_host` weighs, best first, for the first form of the operand that has any."""
        if not self.hosted:
            return []
        hosts, _ = self._index
        want = sum(self.ink(s) for s in siblings)
        aspect = (box[2] - box[0]) / max(box[3] - box[1], 1)
        # The hand 𠂇 of 右 is not that of 左: where KanjiVG tells which this one is, it comes only
        # from hosts KanjiVG shows writing the same (布's from 右 or 有, never 友 or the unlisted 㔫).
        hand = None
        if node == "𠂇":
            drawn = (op, *siblings[:index], node, *siblings[index:])
            # Never from the record of a character being redrawn to test: it would choose by itself.
            char = self.by_sequence.get(key(drawn), "")
            hand = self.hands.get(char) if char not in self.exclude else None
        def weighed(candidates: list, facing: bool = False) -> list[tuple[tuple, Host, int]]:
            scored = []
            for (char, tree, path, i), alien in candidates:
                if char in self.exclude:
                    continue
                here = tree
                for step in path:
                    here = here[1 + step]
                if hand is not None and self.hands.get(self.by_sequence.get(key(here), char if not path else "")) != hand:
                    continue
                others = [n for k, n in enumerate(here[1:]) if k != i]
                exact = here[0] == op and [key(n) for n in others] == [key(s) for s in siblings]
                # A host beside the very same parts is first only if Japan writes it: the simplified
                # 摇 holds 䍃 beside 扌 as 搖 does, drawn to the Chinese design.
                exact = exact and char in self.japanese
                ratio = abs(math.log(max(sum(self.ink(s) for s in others), 1) / max(want, 1)))
                scored.append((not exact, alien, ratio, len(path), char, tree, path, i))
            found_all = []
            # As many hosts the variable font draws as others: where most hosts of a part are
            # characters only a fallback font draws (辶 round heavy parts), `FOREIGN_COST` still
            # weighs the font's own against them.
            ordered = sorted(scored, key=lambda r: r[:4])
            limit = 32 if placed else 16
            own = [r for r in ordered if self.font.own(r[4])][:limit]
            foreign = [r for r in ordered if not self.font.own(r[4])][:limit]
            for exact, alien, ratio, depth, char, tree, path, i in sorted(own + foreign, key=lambda r: r[:4]):
                found = self._host_node(char, tree, path)
                if found is None:
                    continue
                if alien and len(found.pieces[i].contours) != self._outlines(node):
                    continue
                piece = found.pieces[i].box
                shape = abs(math.log(((piece[2] - piece[0]) / max(piece[3] - piece[1], 1)) / aspect))
                size = abs(math.log(max(piece[2] - piece[0], 1) * max(piece[3] - piece[1], 1)
                                    / max((box[2] - box[0]) * (box[3] - box[1]), 1)))
                near = 0.0
                if placed:
                    # A piece from the facing side stands across the em from its box wherever it is drawn.
                    near = (float(np.mean(np.abs(np.array(piece) - np.array(box)))) / PLACED_UNITS if found.whole and not facing
                            else PLACED_NESTED)
                found_all.append(((exact, ratio + shape + 0.5 * size + 0.1 * depth + near + KIN_COST * alien
                                  + FOREIGN_COST * (not self.font.own(found.char))
                                  + UNJAPANESE_COST * (found.char not in self.japanese)), found, i))
            return found_all

        for written in self.alternatives(node, slot(op, index)):
            kin = KIN_PLACES.get(slot(op, index))
            candidates = [(entry, False) for entry in hosts.get((slot(op, index), written), [])]
            if kin:
                # Few characters hold a part inside a half-enclosure; many write it whole where it
                # stands the same way (頁 on the right for 題's lower right).
                candidates += [(entry, True) for entry in hosts.get((kin, written), [])[:KIN_HOSTS]]
            found_all = weighed(candidates)
            facing = FACING_PLACES.get(slot(op, index))
            if facing and found_all and not any(self.font.own(f.char) for _, f, _ in found_all):
                found_all += weighed([(entry, True) for entry in hosts.get((facing, written), [])
                                      if self.font.own(entry[0])][:KIN_HOSTS], facing=True)
                local = [row for row in found_all if self.font.own(row[1].char) and row[1].char in self.japanese]
                found_all = local or found_all
            if (op in ENCLOSE and isinstance(node, str) and self.font.own(node) and found_all
                    and not any(self.font.own(f.char) for _, f, _ in found_all)):
                # In or round an enclosure only fallback glyphs hold it: the font's own glyph keeps
                # its design, where theirs draws another (人 in 𱎠 for 囚, 井 in 𡈇 for 囲).
                return []
            if found_all:
                return self._native_shapes(sorted(found_all, key=lambda r: r[0]))
        return []

    def _native_shapes(self, ranked: list[tuple[tuple, Host, int]]) -> list[tuple[tuple, Host, int]]:
        """Reject a fallback cut with an extra detached bar absent from accepted native cuts.
        A finer mask catches the horizontal taken from 鬲 into 羔 in 𩱋."""
        native = [_square(host.pieces[i], 64) for _, host, i in ranked if self.font.own(host.char)]
        if not native or all(self.font.own(host.char) for _, host, _ in ranked):
            return ranked
        references = [(mask, _grown_mask(mask, 2)) for mask in native]
        kept = []
        for row in ranked:
            _, host, i = row
            if self.font.own(host.char):
                kept.append(row)
                continue
            piece = host.pieces[i]
            mask = _square(piece, 64)
            grown = _grown_mask(mask, 2)
            agrees = any((mask & ~expanded).sum() <= TYPICAL_EXTRA * mask.sum()
                         and (reference & ~grown).sum() <= TYPICAL_GLYPH * reference.sum()
                         for reference, expanded in references)
            if agrees or not _extra_bar(piece, mask, [expanded for _, expanded in references]):
                kept.append(row)
        return kept

    def _template(self, op: str, children: list[Node], region: Box, absolute: bool = False) -> tuple[Host, list[bool]] | None:
        """A drawn character with a node of `op` whose operands are most like `children`, cut into
        them: its layout is a type designer's balance for operands like these. Each flag says
        whether that operand is written there as the target writes it, so its piece is used as is."""
        if not self.hosted:
            return None
        _, templates = self._index
        places = [slot(op, i) for i in range(len(children))]
        wanted = [set(self.alternatives(c, p)) for c, p in zip(children, places)]
        inks = [max(self.ink(c), 1) for c in children]
        aspects = [self.aspect(c) for c in children]
        aspect = (region[2] - region[0]) / max(region[3] - region[1], 1)
        scored = []
        for char, tree, path in templates.get(op, []):
            if char in self.exclude:
                continue
            here = tree
            for step in path:
                here = here[1 + step]
            if len(here) != len(children) + 1:
                continue
            same = [key(t) in w for t, w in zip(here[1:], wanted)]
            if len(children) > 2 and not any(same):
                # Three operands all unlike the teacher's are better shared as `SHARES` has it.
                continue
            gaps = [(abs(math.log(max(self.ink(t), 1) / i)), abs(math.log(self.aspect(t) / a)))
                    for t, i, a in zip(here[1:], inks, aspects)]
            if any(not s and max(g) > math.log(UNLIKE) for s, g in zip(same, gaps)):
                continue
            unlike = sum(0 if s else 1 + g[0] + g[1] for s, g in zip(same, gaps))
            scored.append((unlike, len(path), char, tree, path, same))
        found_all = []
        for unlike, depth, char, tree, path, same in sorted(scored, key=lambda r: r[:2])[:24]:
            found = self._host_node(char, tree, path)
            if found is None:
                continue
            frame = found.frame
            shape = abs(math.log(((frame[2] - frame[0]) / max(frame[3] - frame[1], 1)) / aspect))
            found_all.append((unlike + shape + 0.1 * depth, found, same))
        if not found_all:
            return None
        found_all.sort(key=lambda r: r[0])
        rank, best, same = found_all[0]
        # The layout is the teachers' consensus: each operand's box, as a share of its teacher's
        # frame, averaged over the closest teachers, the closer weighing more.
        chosen = found_all[:self.teachers]
        weights = np.array([math.exp(rank - r) for r, _, _ in chosen])
        if absolute:
            # A whole character: boxes in the em as its teachers' designers placed them, a teacher
            # node within a character carried into the full character's box.
            em = (0.0, ASCENT - EM, EM, ASCENT)
            shares = np.array([[_share(p.box if f.whole else mapped(p.box, f.frame, region), em) for p in f.pieces]
                               for _, f, _ in chosen])
        else:
            shares = np.array([[_share(p.box, f.frame) for p in f.pieces] for _, f, _ in chosen])
        layout = [tuple(float(v) for v in row) for row in np.tensordot(weights / weights.sum(), shares, axes=1)]
        return replace(best, layout=layout), same

    def _requested_enclosure(self, node: Node) -> Node:
        """The four literal insertion conventions, without changing other enclosure policies."""
        if isinstance(node, tuple) and len(node) == 3:
            op, outer, inner = node
            if op == "⿹" and key(outer) in ("須", "⿰彡頁"):
                return ("⿰", ("⿱", "彡", inner), "頁")
            if op == "⿸" and key(outer) in ("攸", "⿲亻丨攵"):
                return ("⿲", "亻", "丨", ("⿱", "攵", inner))
            if op == "⿸" and key(outer) in ("𪧇", "⿱宀爿"):
                return ("⿱", "宀", ("⿰", "爿", inner))
            if op == "⿸" and key(outer) in ("朕", "⿰月关"):
                return ("⿰", "月", ("⿱", "关", inner))
        return node

    def _normalize_requested_enclosures(self, node: Node) -> Node:
        """Use the expanded form for lookup and parent geometry, including nested requests."""
        if isinstance(node, str):
            return node
        rebuilt = (node[0], *(self._normalize_requested_enclosures(child) for child in node[1:]))
        return self._requested_enclosure(rebuilt)

    def _respelled(self, node: Node) -> Node:
        """Rendering layout for a part under a character that is itself drawn under a corner (原 in
        愿, 庚 in 賡): the character's inner part stacked above the new one, both under its corner
        (⿸厂⿱泉心), since a whole character leaves no room inside it: on the 17 audited, 0.491 →
        0.523 (9 better, 5 worse: 魔 摩 贋 lose the corner part their hosts drew). The source
        sequence and encoded identity remain unchanged."""
        requested = self._requested_enclosure(node)
        if requested != node:
            return requested
        for part in "口火又水屮":
            if key(node) == f"⿰⿱{part}{part}⿱{part}{part}":
                return ("⿱", ("⿰", part, part), ("⿰", part, part))
        # Explicit insertion layouts; the original two-part IDS keeps its identity.
        if isinstance(node, tuple) and len(node) == 3:
            op, outer, inner = node
            if op == "⿵" and key(outer) == "⿲彳⿱山一攵":
                return ("⿲", "彳", ("⿱", ("⿱", "山", "一"), inner), "攵")
            if op == "⿴" and (outer == "林" or key(outer) == "⿰木木"):
                return ("⿲", "木", inner, "木")
            if op == "⿴" and key(outer) == "⿰彳亍":
                return ('⿲', '彳', inner, '亍')
            if op == "⿴" and key(outer) == "⿰弓弓":
                return ('⿲', '弓', inner, '弓')
            if op == "⿴" and key(outer) == "⿰𤣩王":
                return ('⿲', '𤣩', inner, '王')
            if op == "⿴" and key(outer) == "⿰辛辛":
                return ('⿲', '辛', inner, '辛')
            if op == "⿴" and key(outer) == "⿰隹隹":
                return ('⿲', '隹', inner, '隹')
            if op == "⿴" and key(outer) == "⿱亠𧘇":
                return ('⿳', '亠', inner, '𧘇')
            if op == "⿸" and key(outer) == "⿰方𠂉":
                return ('⿰', '方', ('⿱', '𠂉', inner))
            if op == "⿹" and key(outer) == "⿰匕頁":
                return ('⿰', ('⿱', '匕', inner), '頁')
            if op == "⿸" and key(outer) == "⿰𠦝𠆢":
                return ('⿰', '𠦝', ('⿱', '𠆢', inner))
            if op == "⿶" and key(outer) == "⿱⿰弓弓鬲":
                return ('⿱', ('⿲', '弓', inner, '弓'), '鬲')
            if op == "⿹" and key(outer) == "⿰⿳士冖一殳":
                return ('⿰', ('⿱', ('⿳', '士', '冖', '一'), inner), '殳')
            sides = {"行": ("彳", "亍"), "弜": ("弓", "弓"), "玨": ("𤣩", "王"),
                     "辡": ("辛", "辛"), "雔": ("隹", "隹")}
            if op == "⿴" and isinstance(outer, str) and outer in sides:
                left, right = sides[outer]
                return ("⿲", left, inner, right)
            if (op, outer) == ("⿴", "衣"):
                return ("⿳", "亠", inner, "𧘇")
            if (op, outer) == ("⿸", "𭤨"):
                return ("⿰", "方", ("⿱", "𠂉", inner))
            if op == "⿴" and (outer == "𨺅" or key(outer) == "⿰𨸏⿾𨸏"):
                return ("⿲", "𨸏", inner, ("⿾", "𨸏"))
            if (op, outer) == ("⿹", "頃"):
                return ("⿰", ("⿱", "匕", inner), "頁")
            if op == "⿴" and key(outer) in ("⿰⿱口口⿱口口", "⿱⿰口口⿰口口"):
                return ("⿳", ("⿰", "口", "口"), inner, ("⿰", "口", "口"))
            if (op, outer) == ("⿴", "㗊"):
                return ("⿳", "吅", inner, "吅")
            if (op, outer) == ("⿸", "倝"):
                return ("⿰", "𠦝", ("⿱", "𠆢", inner))
            if (op, outer) == ("⿶", "𩰲"):
                return ("⿱", ("⿲", "弓", inner, "弓"), "鬲")
            if (op, outer) == ("⿹", "𣪊"):
                return ("⿰", ("⿱", ("⿳", "士", "冖", "一"), inner), "殳")
        if not isinstance(node, tuple) or node[0] != "⿸" or len(node) != 3 or not isinstance(node[1], str):
            return node
        try:
            outer = parse(self.sequences.get(node[1], ""))
        except ValueError:
            return node
        # One level only: a corner that is itself spelled as a corner (甲 ⿸乙口, 乙 ⿸甲木) is a cycle.
        if isinstance(outer, tuple) and outer[0] == "⿸" and len(outer) == 3 and not (
                isinstance(outer[1], str) and self.sequences.get(outer[1], "").startswith("⿸")):
            return ("⿸", outer[1], ("⿱", outer[2], node[2]))
        return node

    def _normalize_repeated_grids(self, node: Node) -> Node:
        """Use one grid spelling for glyph/host lookup without changing the source IDS."""
        if isinstance(node, str):
            return node
        for part in "口火又水屮":
            if key(node) == f"⿰⿱{part}{part}⿱{part}{part}":
                return ("⿱", ("⿰", part, part), ("⿰", part, part))
        return (node[0], *(self._normalize_repeated_grids(child) for child in node[1:]))

    def _cancel_transforms(self, node: Node) -> Node:
        """Cancel paired mirrors and half-turns before glyph lookup and layout."""
        if isinstance(node, str):
            return node
        kids = tuple(self._cancel_transforms(child) for child in node[1:])
        if node[0] in ("⿾", "⿿") and isinstance(kids[0], tuple) and kids[0][0] == node[0]:
            return kids[0][1]
        return (node[0], *kids)

    def _standalone_expanded_overlay(self, node: Node) -> Node:
        """Use an attested whole glyph for an expanded overlays; keep missing or excluded glyphs decomposed."""
        self._reference_context()
        equivalents = {'⿻大⿰人人': '夾', '⿻工⿰人人': '巫', '⿻⿰人人土': '坐'}
        char = equivalents.get(key(node))
        return char if char and char not in self.exclude and self.font.has(char) else node

    def _standalone_pyramid(self, node: Node) -> Node:
        """Use an attested whole glyph for an expanded pyramid-glyphs; keep missing or excluded glyphs decomposed."""
        self._reference_context()
        char = _PYRAMID_GLYPHS.get(key(node))
        return char if char and char not in self.exclude and self.font.has(char) else node

    def _standalone_repeated_grid(self, node: Node) -> Node:
        """Use the designed glyph for a complete attested four-part grid."""
        self._reference_context()
        for part, char in {"口": "㗊", "火": "燚", "又": "叕", "水": "㵘", "屮": "茻"}.items():
            if (key(node) in {f"⿰⿱{part}{part}⿱{part}{part}", f"⿱⿰{part}{part}⿰{part}{part}"}
                    and char not in self.exclude and self.font.has(char)):
                return char
        return node

    def compose(self, sequence: str) -> list[Placed]:
        """The parts that draw `sequence`; LookupError when an operand can be drawn no way."""
        tree = self._standalone_expanded_overlay(self._standalone_pyramid(
            self._standalone_repeated_grid(self._normalize_repeated_grids(
                self._normalize_requested_enclosures(self._cancel_transforms(parse(sequence)))))))
        placed = self._node(tree, self.face, at_root=True)
        if self.rerank:
            options = self._reranked(tree, placed)
            if options:
                placed = max(options, key=lambda o: o[0])[1]
        encoded = self.by_sequence.get(key(tree)) if isinstance(tree, tuple) else None
        if self.reuse and encoded in self.exclude and not all(p.origin.startswith(("learned", "alone", "kin")) for p in placed):
            # A character redrawn without its glyph whose parts could not all be placed by the
            # learned layout from hosts: whole, from another character that draws it, if one does
            # (戒 from 誡); an enclosing part drawn from kin keeps the composition. Measured on the
            # jōyō kanji, this helps where the composer fell back on
            # teachers, bare glyphs or instances, and hurts where the learned layout placed every part.
            # A character composed of parts stands for itself better than a form it takes round
            # or beside another part (茂 wrapped round 占 in 蒧).
            if not isinstance(placed, _FittedEnclosure):
                held = self._instances(encoded, forms=False) if self.standalone is not None and self.hosted else []
                alone = self._alone(encoded, fallback=self._unhosted(tree), found=held)
                if alone is not None:
                    placed = [alone]
        elif self.reuse and encoded in self.exclude and self.standalone is not None and self.hosted:
            # Where the learned layout placed every part, a character many others draw whole still
            # comes from them when it and they disagree: they hold a layout its sequence does not
            # tell (包's 己 hanging below 勹, as in 泡 抱 砲; 有's short 丿).
            found = self._instances(encoded, forms=False)
            if sum(self.font.own(h) for *_, h in found) >= HELD_OFTEN:
                alone = self._alone(encoded, found=found)
                if alone is not None:
                    composed, whole = raster(placed, 96), raster([alone], 96)
                    if (composed & whole).sum() < HELD_AGREE * max((composed | whole).sum(), 1):
                        placed = [alone]
        if self.weighted:
            self._balance(placed)
        if self.guide is not None:
            placed = self.guide.fit(self, key(tree), placed)
        return placed

    def _reranked(self, tree: Node, placed: list[Placed]) -> list[tuple[float, list[Placed], list[float]]]:
        """A two-part ⿰ or ⿱ character drawn by the learned layout from two hosts, and drawn again
        with its second part from each of the next `RERANK` hosts: each drawing with its expected
        gain in overlap (`RERANK_WEIGHTS` over its ranking score and its agreement with the others,
        both against the first's) and those features. Empty when the character is not so drawn."""
        learned = lambda p: len(p) == 2 and all(q.origin.startswith("learned") for q in p)
        if not (isinstance(tree, tuple) and tree[0] in ("⿰", "⿱") and len(tree) == 3 and learned(placed)):
            return []
        ranks = list(self._root_ranks)
        drawings = [(0, placed)]
        for pick in range(1, min(RERANK + 1, len(ranks))):
            self._rank_pick = pick
            try:
                other = self._node(tree, self.face, at_root=True)
            except LookupError:
                continue
            finally:
                self._rank_pick = 0
            if learned(other):
                drawings.append((pick, other))
        self._root_ranks = ranks
        if len(drawings) < 2:
            return []
        masks = [raster(p, 96) for _, p in drawings]
        overlap = lambda a, b: float((a & b).sum()) / max(float((a | b).sum()), 1.0)
        agree = [sum(overlap(m, o) for k, o in enumerate(masks) if k != n) / (len(masks) - 1) for n, m in enumerate(masks)]
        out = []
        for n, (pick, drawing) in enumerate(drawings):
            features = [ranks[pick] - ranks[0], agree[n] - agree[0], float(pick)]
            gain = 0.0 if pick == 0 else float(np.dot(RERANK_WEIGHTS, [*features, 1.0]))
            out.append((gain, drawing, features))
        return out

    def _balance(self, placed: list[Placed]) -> None:
        """Each part's strokes brought to the width the whole character's density calls for: a part
        drawn in a sparser glyph is thinned, one squeezed along an axis is thickened along it. A
        part no thicker than a stroke along an axis keeps its weight there."""
        density = sum(self.ink("", p.part) * (p.scale[0] + p.scale[1]) / 2 for p in placed)
        ratio = [self.font.stem[axis][1] / self.font.stem[axis][0] - 1 for axis in (0, 1)]
        for p in placed:
            weight, target = [], list(p.target)
            for axis, s in enumerate(p.scale):
                extent = p.source[axis + 2] - p.source[axis]
                if extent <= 2 * self.font.stem[axis][0]:
                    # A lone stroke across this axis: drawn at the width the density calls for, not scaled.
                    width = extent * self.font.width(density, axis) / self.font.width(p.native, axis)
                    middle = (target[axis] + target[axis + 2]) / 2
                    target[axis], target[axis + 2] = middle - width / 2, middle + width / 2
                    weight.append(0.0)
                    continue
                measured = p.part.contours[0].width
                own = measured[axis] if measured is not None else self.font.width(p.native, axis)
                weight.append(float(np.clip((self.font.width(density, axis) / (s * own) - 1) / ratio[axis], -0.6, 1.0)))
            p.target = tuple(target)
            p.weight = (weight[0], weight[1])

    def _node(self, node: Node, region: Box, at_root: bool = False) -> list[Placed]:
        """`node` drawn into `region`; at the root, the whole character, laid out in the em."""
        encoded = node if isinstance(node, str) else None if key(node) in self.spelled else self.by_sequence.get(key(node))
        if at_root and not isinstance(node, str):
            # Characters sharing a sequence (申 由 甲 are all ⿻日丨): the one redrawn is the one
            # excluded, never another that happens to have the same sequence.
            redrawn = [ch for ch in self.exclude if self.sequences.get(ch) == key(node)]
            if redrawn:
                encoded = redrawn[0]
        if at_root and encoded in self.atomic and encoded in self.exclude:
            # An atomic character redrawn without its glyph (日, not ⿴囗一): whole, from another
            # character that draws it, where it stands alone.
            alone = self._alone(encoded)
            if alone is not None:
                return [alone]
        if encoded is not None and encoded not in self._expanding and (isinstance(node, str) or encoded not in self.exclude):
            glyph = self.font.glyph(encoded)
            tree = node if isinstance(node, tuple) else None
            if tree is None and encoded in self.sequences and encoded not in self.exclude:
                try:
                    tree = parse(self.sequences[encoded])
                except ValueError as error:
                    if glyph is None:
                        raise LookupError(f"{encoded} has no glyph, and its sequence is malformed: {error}") from error
            # A glyph that would be squeezed out of shape is drawn from its sequence instead, whose
            # parts come from characters that draw them in such a box (鮮 flat on top as ⿰魚羊).
            squeezed = glyph is not None and self.hosted and self._stretch(glyph.box, region) > STRETCH
            # A sequence of bare strokes (𠂊 as ⿱𠂆㇇) names no designed parts, and an atomic
            # character (日 as ⿴囗一) is a part in its own right: the glyph stays.
            if tree is not None and (self.stroked(tree) or encoded in self.atomic):
                squeezed = False
            if glyph is not None and not (squeezed and tree is not None):
                return [self._place(glyph, region, self.ink(encoded), f"glyph {encoded}")]
            if tree is None:
                raise LookupError(f"No glyph or sequence draws {encoded}.")
            # A character whose sequence leads back to itself is not expanded again.
            self._expanding.add(encoded)
            try:
                return self._node(tree, region, at_root)
            except LookupError:
                if glyph is None:
                    raise
                return [self._place(glyph, region, self.ink(encoded), f"glyph {encoded}")]
            finally:
                self._expanding.discard(encoded)
        if isinstance(node, str):
            glyph = self.font.glyph(node)
            if glyph is None:
                raise LookupError(f"No glyph or sequence draws {node}.")
            return [self._place(glyph, region, self.ink(node), f"glyph {node}")]
        instance = None if key(node) in self.spelled else self._instance(node, region)
        if instance is not None:
            return [instance]
        # Resolve each node's original identity before changing its rendering layout.
        node = self._respelled(node)
        op, children = node[0], list(node[1:])
        if op in ("⿾", "⿿"):
            # Reflect both masters in each part's frame, then move the part's target
            # within the node's region. A half-turn reflects both axes.
            child = children[0]
            if at_root:
                # A transformed whole character gets the same standalone drawing as
                # its untransformed operand before its outlines are turned.
                child = self._standalone_expanded_overlay(self._standalone_pyramid(
                    self._standalone_repeated_grid(child)))
            out = self._node(child, region, at_root)
            for item in out:
                axes = (0,) if op == "⿾" else (0, 1)
                def reflect(points):
                    reflected = points.copy()
                    for axis in axes:
                        reflected[:, axis] = item.source[axis] + item.source[axis + 2] - reflected[:, axis]
                    return reflected
                item.part = Part([replace(c, light=reflect(c.light), heavy=reflect(c.heavy)) for c in item.part.contours])
                target = list(item.target)
                for axis in axes:
                    target[axis], target[axis + 2] = (region[axis] + region[axis + 2] - target[axis + 2],
                                                       region[axis] + region[axis + 2] - target[axis])
                item.target = tuple(target)
            return out
        if op not in AXIS and op not in ENCLOSE and op != OVERLAY:
            raise LookupError(f"{op} is not laid out.")
        if op == OVERLAY:
            return self._overlay(children, region)
        if self.hosted and self.layout is not None and len(children) == 2 and (
                op in self.layout.ops if at_root else op in ("⿰", "⿱")):
            learned = self._learned(op, children, None if at_root else region)
            if learned is not None:
                return learned
        if at_root and op in AXIS and self.hosted:
            transplanted = self._transplant(op, children)
            if transplanted is not None:
                return transplanted
        found = self._template(op, children, region, absolute=at_root)
        if found is None:
            return self._shares(op, children, region)
        host, same = found
        groups: list[list[Placed]] = []
        for i, (child, piece) in enumerate(zip(children, host.pieces)):
            if host.layout:
                box = mapped(host.layout[i], (0, 0, 1, 1), (0.0, ASCENT - EM, EM, ASCENT) if at_root else region)
            else:
                box = mapped(piece.box, host.frame, region)
            if op in ENCLOSE and i == 1 and not same[0]:
                # The teacher's room was left by another enclosing part: the room is found in this one.
                box = self._room(op, groups[0], region) or box
            if same[i]:
                groups.append([Placed(piece, piece.box, box, native=self.ink(host.char), origin=f"teacher {host.char}")])
                continue
            part = self._host(op, i, child, children[:i] + children[i + 1:], box)
            if part is None:
                group = self._row(child, box, len(children))
                if op in AXIS and len(group) == 1 and group[0].origin.startswith("glyph "):
                    across = 1 - AXIS[op]
                    target = group[0].target
                    if target[across + 2] - target[across] < box[across + 2] - box[across]:
                        # The teacher leaves too little axial room for this bare glyph to retain
                        # its cross-axis extent within STRETCH. Allocate both operands together.
                        return self._shares(op, children, region)
                groups.append(group)
                continue
            drawn, k = part
            source = drawn.pieces[k]
            if op in AXIS:
                # Along the axis the teacher's share; across it, the extent the part's own host gave
                # it: where that host drew it in the em, for a whole character drawn from a whole one.
                axis = AXIS[op]
                frame, target = drawn.frame, list(box)
                if at_root and drawn.whole:
                    target[1 - axis], target[3 - axis] = source.box[1 - axis], source.box[3 - axis]
                else:
                    lo, span = region[1 - axis], region[3 - axis] - region[1 - axis]
                    width = frame[3 - axis] - frame[1 - axis]
                    target[1 - axis] = lo + (source.box[1 - axis] - frame[1 - axis]) / width * span
                    target[3 - axis] = lo + (source.box[3 - axis] - frame[1 - axis]) / width * span
                target = tuple(target)
            else:
                target = fitted(source.box, box)
            groups.append([Placed(source, source.box, target, native=self.ink(drawn.char), origin=f"host {drawn.char}")])
        if op in AXIS:
            self._space(AXIS[op], groups)
        elif not same[0]:
            _fit_inside(groups[0], groups[1], region, self.font.stem[0][0])
        return [p for group in groups for p in group]

    def _learned(self, op: str, children: list[Node], region: Box | None = None) -> list[Placed] | None:
        """Two operands in the boxes the learned layout gives them, each cut from the host that fits
        its box best, or drawn into it. A whole character's boxes stand in the em; a nested node's
        are those of a whole character laid out alike, carried into its region. An enclosed part cut
        from a host stays in its predicted box: fitting it into the opening afterwards scored worse
        (0.562 against 0.601 on 238 jōyō enclosures). One drawn on its own is drawn into the room
        its enclosing part leaves and fitted there, since nothing placed it beside that part.
        None when a linear layout would deform a hosted operand beyond STRETCH, or when the network
        gives an operand no extent (a thin 丨 beside a tall ⿳工臣口 came out −5 units wide)."""
        tested = next(iter(self.exclude)) if len(self.exclude) == 1 else None
        boxes = self.layout.predict(self, op, [key(c) for c in children], tested)
        if region is not None:
            frame = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
            boxes = [mapped(b, frame, region) for b in boxes]
        if op in ENCLOSE and region is None and _area(boxes[0]) < ENCLOSING_LEAST * _area(self.face):
            # An enclosing part spans most of a character; a smaller box is the network guessing at
            # a shape it was never shown (⿷ around ⿱甶儿 in 鬼).
            boxes[0] = self.face
        if op in COVERING:
            # An enclosing part closed on three sides holds the part it encloses: a network box for
            # 乃 that stops above 子 is 乃 squeezed atop another part (盈), not wrapped round one
            # (孕). Under a corner (君's 口 below 尹) the enclosed part may reach past it.
            boxes[0] = (min(boxes[0][0], boxes[1][0]), min(boxes[0][1], boxes[1][1]),
                        max(boxes[0][2], boxes[1][2]), max(boxes[0][3], boxes[1][3]))
        if any(b[2] <= b[0] or b[3] <= b[1] for b in boxes):
            return None
        groups = []
        outer_hosted = False
        inner_fitted = False
        for i, (child, box) in enumerate(zip(children, boxes)):
            part = self._host(op, i, child, children[:i] + children[i + 1:], box, placed=region is None)
            if (part is not None and op in ENCLOSE and i == 0 and isinstance(child, str) and self.font.own(child)
                    and self._stretch(part[0].pieces[part[1]].box, box) > ENCLOSING_STRETCH):
                # An enclosing part every host draws squeezed (夂 atop 口 in 咎, for 処) is drawn
                # from its own glyph, which keeps the sweep its full height.
                part = None
            if part is None:
                if op in ENCLOSE and i == 1:
                    # Drawn into its learned box, then kept clear of the enclosing strokes (面
                    # beside 麦's sweep in 麺), growing up to the opening where that is larger
                    # (目 fills the room under 龵 in 看).
                    groups.append(self._node(child, box))
                    opening = self._room(op, groups[0], region or self.face)
                    # The opening already includes stroke clearance from _room.
                    limit = box if opening is None or _area(opening) <= _area(box) else opening
                    feasible = _fit_inside(groups[0], groups[1], region or self.face, self.font.stem[0][0], room=limit)
                    inner_fitted = (feasible and region is None and outer_hosted and self.reuse and self.standalone is not None
                                    and isinstance(child, str) and child not in self.exclude and len(groups[1]) == 1
                                    and groups[1][0].part is self.font.glyph(child))
                else:
                    kin = self._kin_outer(op, child, children[1], box, boxes[1]) if op in ENCLOSE and i == 0 else None
                    groups.append(kin or self._node(child, box))
                continue
            drawn, k = part
            source = drawn.pieces[k]
            if op == "⿺" and i == 1 and len(groups[0]) == 1 and groups[0][0].origin.startswith("glyph"):
                swept = _swept(groups[0][0], box[0] - FACING[0])
                if swept is not None:
                    # The part fills the room the sweep leaves, within its learned box's right and top.
                    groups[0] = swept
                    opening = self._room(op, groups[0], region or self.face)
                    if opening is not None:
                        box = (opening[0], opening[1], min(opening[2], box[2]), min(opening[3], box[3]))
                else:
                    # A part drawn alone that does not sweep under the other (瓜, whose last stroke
                    # falls short of 交 in 㼎) stands beside it.
                    return self._node(("⿰", *children), region or self.face)
            if op in ENCLOSE and i == 1 and all(p.origin.startswith("glyph") for p in groups[0]):
                # The enclosing part is a bare glyph, drawn for standing alone: the opening its
                # strokes leave is far smaller than a designer's (龵's sweep over 目 in 看). The
                # part keeps its learned box, kept clear of those strokes.
                groups.append([Placed(source, source.box, fitted(source.box, box), native=self.ink(drawn.char), origin=f"learned {drawn.char}")])
                _fit_inside(groups[0], groups[1], region or self.face, self.font.stem[0][0], room=box)
                continue
            if op in ENCLOSE and i == 1:
                room = self._room(op, groups[0], region or self.face)
                room = room and _shrunk(room, OPENING_SHARE)
                if room is not None and (_within(box, room) < ROOM_TRUST or self._stretch(source.box, box) > STRETCH):
                    # The box reaches well into the enclosing part's ink, or would pull the part out
                    # of shape, as for an operator seldom cut (⿴口口): the part goes into the
                    # opening, from the host that best fits the opening, its proportions kept
                    # within `STRETCH`.
                    drawn, k = self._host(op, i, child, children[:1], room) or (drawn, k)
                    source = drawn.pieces[k]
                    anchor = None
                    if self._stretch(source.box, room) > STRETCH:
                        # No host draws it in a shape the opening takes (a flat 口 for 回's square one).
                        groups.append(self._node(child, room))
                        inner_fitted = (region is None and outer_hosted and self.reuse and self.standalone is not None
                                        and isinstance(child, str) and child not in self.exclude and len(groups[1]) == 1
                                        and groups[1][0].part is self.font.glyph(child))
                        anchor = ((box[0] + box[2]) / 2, (box[1] + box[3]) / 2)
                    else:
                        groups.append([self._place(source, room, self.ink(drawn.char), f"learned {drawn.char}")])
                    feasible = _fit_inside(groups[0], groups[1], region or self.face, self.font.stem[0][0], room=room, anchor=anchor)
                    inner_fitted = inner_fitted and feasible
                    continue
            if region is None and op in AXIS and drawn.whole and not HOST_SNAP < self._stretch(source.box, box) <= HOST_EXTENT:
                across = 1 - AXIS[op]
                box = tuple(source.box[k] if k % 2 == across else box[k] for k in range(4))
            if op in AXIS and self._stretch(source.box, box) > STRETCH:
                return None
            groups.append([Placed(source, source.box, box, native=self.ink(drawn.char), origin=f"learned {drawn.char}")])
            if i == 0:
                outer_hosted = True
            if (op == "⿸" and isinstance(children[0], tuple) and i == 1
                    and _collision(groups[0], groups[1], region or self.face, size=256) > COLLIDE):
                _fit_inside(groups[0], groups[1], region or self.face, self.font.stem[0][0],
                            size=256, room=box)
            if op in CLEARED and i == 1 and _collision(groups[0], groups[1], region or self.face) > COLLIDE:
                # Its box runs into the enclosing strokes (帀 over 走's 土 in 䞙): it is fitted
                # clear of them, within that box or the opening where that is larger (子 under 乃's
                # fold in 孕).
                opening = self._room(op, groups[0], region or self.face)
                limit = box if opening is None or _area(opening) <= _area(box) else _shrunk(opening, OPENING_SHARE)
                _fit_inside(groups[0], groups[1], region or self.face, self.font.stem[0][0], room=limit)
        if op in AXIS:
            self._space(AXIS[op], groups)
        placed = [p for group in groups for p in group]
        if (region is None and op in ENCLOSE and outer_hosted and inner_fitted
                and _visible_inside(groups[1], self.face)
                and _collision(groups[0], groups[1], self.face, size=256) <= COLLIDE):
            return _FittedEnclosure(placed)
        return placed

    def _transplant(self, op: str, children: list[Node]) -> list[Placed] | None:
        """A whole character's operands each taken unscaled, where a designer put them in the em, from
        characters that hold them in the same place: chosen together so that each pair of
        neighbours stands as far apart as their own characters keep their parts. Nothing is
        stretched, so every stroke keeps its drawn shape; None when no choice fits within
        `TRANSPLANT_TOLERANCE`."""
        axis = AXIS[op]
        hosts, _ = self._index
        options = []
        for i, child in enumerate(children):
            siblings = children[:i] + children[i + 1:]
            want = sum(self.ink(s) for s in siblings)
            found = []
            for written in self.alternatives(child, slot(op, i)):
                for char, tree, path, k in hosts.get((slot(op, i), written), [])[:TRANSPLANT_HOSTS]:
                    if path or char in self.exclude or tree[0] != op or len(tree) != len(children) + 1:
                        continue
                    others = [n for j, n in enumerate(tree[1:]) if j != k]
                    ratio = abs(math.log(max(sum(self.ink(n) for n in others), 1) / max(want, 1)))
                    found.append((ratio, char, tree, k))
            found.sort(key=lambda r: r[0])
            pieces = []
            for ratio, char, tree, k in found:
                cut = self._host_node(char, tree, ())
                if cut is not None:
                    pieces.append((ratio, char, cut.pieces[k], cut.gap))
                if len(pieces) >= TRANSPLANT_CANDIDATES:
                    break
            if not pieces:
                return None
            options.append(pieces)

        def misfit(a, b) -> float:
            # a stands before b along the axis: left of it, or above it (y is up).
            gap = b[2].box[0] - a[2].box[2] if axis == 0 else a[2].box[1] - b[2].box[3]
            return abs(gap - (a[3] + b[3]) / 2) + 40 * (a[0] + b[0])

        # The best chain of choices, operand by operand.
        best = [(0.0, [p]) for p in options[0]]
        for row in options[1:]:
            best = [min(((cost + misfit(chain[-1], p), chain + [p]) for cost, chain in best), key=lambda r: r[0]) for p in row]
        cost, chain = min(best, key=lambda r: r[0])
        if cost > TRANSPLANT_TOLERANCE * (len(children) - 1):
            return None
        return [Placed(piece, piece.box, piece.box, native=self.ink(char), origin=f"transplant {char}")
                for _, char, piece, _ in chain]

    def stroked(self, node: Node) -> bool:
        """Whether a sequence names a bare stroke among its operands: a CJK Strokes character, or an
        ideograph drawn as one outline (丿, 丶, 𠃌)."""
        if isinstance(node, str):
            return 0x31C0 <= ord(node[0]) <= 0x31EF or self._outlines(node) == 1
        return any(self.stroked(n) for n in node[1:])

    def _own_outlines(self, node: Node, depth: int = 0, seen: frozenset[str] = frozenset()) -> int | None:
        """Native outline count, estimated from permitted operands for excluded or fallback glyphs;
        None when any operand's count is unknown."""
        self._reference_context()
        if isinstance(node, tuple):
            counts = [self._own_outlines(n, depth + 1, seen) for n in node[1:]]
            return None if any(n is None for n in counts) else sum(counts)
        if node not in self.exclude and self.font.own(node):
            if node not in self._own_counts:
                glyph = self.font.glyph(node)
                self._own_counts[node] = len(glyph.contours) if glyph is not None else None
            return self._own_counts[node]
        if depth <= 4 and node in self.sequences and node not in seen:
            try:
                tree = parse(self.sequences[node])
            except ValueError:
                return None
            return self._own_outlines(tree, depth, seen | {node})
        return None

    def _outlines(self, node: Node, seen: frozenset[str] = frozenset()) -> int:
        """Total permitted outline count; zero means that at least one operand is unknown."""
        self._reference_context()
        if isinstance(node, str):
            if node not in self.exclude:
                glyph = self.font.glyph(node)
                return len(glyph.contours) if glyph else 0
            if node in self.sequences and node not in seen:
                try:
                    return self._outlines(parse(self.sequences[node]), seen | {node})
                except ValueError:
                    pass
            return 0
        counts = [self._outlines(n, seen) for n in node[1:]]
        return sum(counts) if all(counts) else 0

    def _overlay(self, children: list[Node], region: Box) -> list[Placed]:
        """Operands drawn across each other (⿻), where characters that overlay like operands put
        them: each operand's box as a share of the node's, averaged over up to `TEACHERS_OVERLAY`
        teachers, taken from those overlaying the same first operand, else the same second one,
        else any overlay the font draws. An operand a teacher draws is taken from it; another is
        drawn into its box."""
        if self.hosted and self.kvg is not None and key((OVERLAY, *children)) not in self.spelled:
            # The overlay drawn whole in another character, where KanjiVG groups its components.
            from .kanjivg_cuts import groups_like

            found = sorted(((self._stretch(p.box, region), char, p) for char, p in groups_like(self.kvg, (OVERLAY, *children), self.exclude)),
                           key=lambda r: r[0])
            if found and found[0][0] <= STRETCH:
                _, char, piece = found[0]
                return [Placed(piece, piece.box, region, native=self.ink(char), origin=f"instance {char}")]
        keys = [key(c) for c in children]
        teachers = []
        if self.hosted:
            # A teacher sharing one operand speaks for the other only when that is about as large
            # (求 overlays 一 on 氺; 様 overlays 兰, five times its ink).
            teachers = [t for t in self._overlays(0, keys[0]) + self._overlays(1, keys[1])
                        if all(w == k or 1 / OVERLAY_INK <= self.ink(k) / max(self.ink(w), 1) <= OVERLAY_INK
                               for k, w in zip(keys, t[2]))]
            if not teachers and len(children) == 2:
                # No overlay to follow. A first operand whose glyph is open above or below holds
                # the other in that opening (山 around 𢆶 in 幽, as ⿶); otherwise they are stacked,
                # as overlaid parts mostly are (羊 over 氺 in 様).
                outer = self._node(children[0], region)
                rooms = {op: self._room(op, outer, region) for op in ("⿶", "⿵")}
                share = {op: _area(r) / _area(region) if r is not None else 0.0 for op, r in rooms.items()}
                for op, other in (("⿶", "⿵"), ("⿵", "⿶")):
                    # Open on that side only: a closed shape (口 of 中) holds nothing across it.
                    if share[op] >= OPEN_ROOM and share[op] >= OPEN_ONE_SIDE * share[other]:
                        cells = self._cells(op, outer, region, children[1])
                        if cells is not None:
                            return outer + cells
                        # Laid out as that enclosure, the parts drawn across each other as an
                        # overlay is, not fitted around each other's strokes.
                        if self.layout is not None and op in self.layout.ops:
                            boxes = self.layout.predict(self, op, [key(c) for c in children])
                            frame = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
                            return [p for child, b in zip(children, boxes) for p in self._node(child, mapped(b, frame, region))]
                        return self._node((op, *children), region)
                return self._node((AXIS_STACK, *children), region)
        if not teachers:
            em = (0.0, ASCENT - EM, EM, ASCENT)
            out = []
            for child in children:
                glyph = self.font.glyph(child) if isinstance(child, str) else None
                out.extend(self._node(child, mapped(glyph.box, em, region) if glyph is not None else region))
            return out
        # Teachers sharing more of the operands first.
        teachers = sorted(teachers, key=lambda t: -sum(k == w for k, w in zip(keys, t[2])))[:TEACHERS_OVERLAY]
        shares = np.mean([[_share(p.box, h.frame) for p in h.pieces] for _, h, _ in teachers], axis=0)
        out = []
        for i, child in enumerate(children):
            box = mapped(tuple(shares[i]), (0, 0, 1, 1), region)
            donor = next(((c, h) for c, h, written in teachers if written[i] == keys[i]), None)
            if donor is not None:
                char, host = donor
                piece = host.pieces[i]
                out.append(Placed(piece, piece.box, box, native=self.ink(char), origin=f"overlay {char}"))
            else:
                out.extend(self._node(child, box))
        return out

    def _overlays(self, index: int | None, operand: str | None) -> list[tuple[str, Host, list[str]]]:
        """Two-operand overlays the font draws, cut into their operands: with `operand` at `index`,
        or any when `index` is None (the first `OVERLAY_ANY` found, cached)."""
        self._reference_context()
        hosts, _ = self._index
        if index is None:
            keys = [k for k in hosts if k[0] == slot(OVERLAY, 0)]
            found = self._memo(self._any_overlays, None, lambda: [r for k in keys for r in self._overlays(0, k[1])][:OVERLAY_ANY])
            return [r for r in found if r[0] not in self.exclude]
        found = []
        for char, tree, path, i in hosts.get((slot(OVERLAY, index), operand), [])[:OVERLAY_HOSTS]:
            if char in self.exclude:
                continue
            node = tree
            for step in path:
                node = node[1 + step]
            if not isinstance(node, tuple) or node[0] != OVERLAY or len(node) != 3:
                continue
            host = self._host_node(char, tree, path)
            if host is not None:
                found.append((char, host, [key(n) for n in node[1:]]))
            if len(found) >= OVERLAY_HOSTS:
                break
        return found

    def _instance(self, node: tuple, region: Box) -> Placed | None:
        """A sequence drawn whole somewhere in the font, in any place: 爫 (⿱㇒𭕄) over 采, 丘 in 岳.
        A designer drew it as one shape, which a composition of its strokes cannot match. The
        instance closest to the region's proportions is used, if it needs no more than `STRETCH`."""
        if not self.hosted:
            return None
        names = {key(node)} | ({self.by_sequence[key(node)]} if key(node) in self.by_sequence else set())
        if names & self.exclude and not self.stroked(node):
            # A character redrawn to test is not taken from where another character draws it whole,
            # unless its sequence names bare strokes (失 as ⿰㇒夫): no layout of parts makes that
            # shape, and drawn inside another character (鉄) is the only way to have it.
            return None
        best = None
        for place, written in (k for name in names for k in self._places.get(name, ())):
            if place in SIDED_PLACES:
                # A part written on the left or on top takes a positional form (皿's last stroke
                # rising on the left of 鹽): it does not stand for the sequence elsewhere.
                continue
            for char, tree, path, i in self._index[0][(place, written)][:INSTANCE_HOSTS]:
                if char in self.exclude:
                    continue
                host = self._host_node(char, tree, path)
                if host is None:
                    continue
                piece = host.pieces[i]
                if self.stroked(node) and len(piece.contours) != self._outlines(node):
                    # A sequence of strokes says how many it has: 刀 (⿹𠃌丿) is two, not 𠃌 alone.
                    continue
                if len(piece.contours) < INSTANCE_KEPT * self._outlines(node):
                    # A piece short of a quarter of its parts' outlines lost a part (⿱田月 cut
                    # from 䬑 as 田 alone).
                    continue
                stretch = self._stretch(piece.box, region)
                if stretch <= STRETCH and (best is None or stretch < best[0]):
                    best = (stretch, piece, char)
        if best is None:
            return None
        _, piece, char = best
        return Placed(piece, piece.box, region, native=self.ink(char), origin=f"instance {char}")

    def _unhosted(self, tree: Node) -> bool:
        """Whether an operand of `tree` that is not held inside another (the frame of 看, not the 井 of
        囲) is drawn in its place by no character of the main font but the one redrawn: such a
        character is better taken whole from the fallback font than built around a bare glyph."""
        if not isinstance(tree, tuple):
            return False
        hosts, _ = self._index
        op = tree[0]
        for i, child in enumerate(tree[1:]):
            if op in ENCLOSE and i == 1:
                continue
            place = slot(op, i)
            if not any(char not in self.exclude and self.font.own(char)
                       for written in self.alternatives(child, place) for char, *_ in hosts.get((place, written), [])):
                return True
        return False

    def _instances(self, char: str, forms: bool = True) -> list[tuple[Part, Box, str]]:
        """Where other characters hold `char` whole, on the right, below or inside: each piece, the
        box the standalone model gives it, and its host. Positional and enclosing forms count only
        when no other place yields one the variable font draws, and never without `forms`."""
        hosts, _ = self._index
        tree = parse(self.sequences[char]) if char in self.sequences else None
        found = []
        # A positional or enclosing form only when no other place yields one (片 is cut only from
        # the left of 版 and 牌): it is still the character's own design, not strokes.
        for sided in (False, True) if forms else (False,):
            for place, written in self._places.get(char, ()):
                if (place in SIDED_PLACES or place in ENCLOSING_PLACES) != sided:
                    continue
                if place in COMBINING_PLACES:
                    # Round another part it takes a combining form (走 sweeping under 召 in 超); a
                    # character held nowhere else is built from its own parts (⿱土龰).
                    continue
                for host_char, tree_, path, i in hosts[(place, written)][:INSTANCE_HOSTS]:
                    if host_char in self.exclude:
                        continue
                    host = self._host_node(host_char, tree_, path)
                    if host is None:
                        continue
                    piece = host.pieces[i]
                    if tree is not None and not isinstance(tree, str) and not self._kept(piece, tree):
                        continue
                    box = self.standalone.nearest(place, piece.box, leave=char)
                    if box is not None:
                        found.append((piece, box, host_char))
            if any(self.font.own(f[2]) for f in found):
                break
        return found

    def _alone(self, char: str, fallback: bool = False, found: list | None = None) -> Placed | None:
        """`char` taken whole from another character that holds it, on the right, below or inside
        (on the left or on top it takes a positional form, `SIDED_PLACES`). Of its instances, those with
        the stroke count most of them have, and of these the one whose shape is closest to their
        average: a positional form (工 on the left, its last stroke rising) loses to the shape most
        places keep. It goes in the median of the boxes the standalone model gives all its
        instances, its proportions kept within `STRETCH`. `found` is `_instances(char)`, when already gathered."""
        if self.standalone is None or not self.hosted:
            return None
        if found is None:
            found = self._instances(char)
        # Every instance says where the character stands alone; only the variable font's are drawn,
        # unless `fallback`: a fallback glyph's strokes, enlarged, come out heavier than weighting
        # brings back (囲 from Plangothic's 𡈇).
        boxes = [b for _, b, _ in found]
        found = [f for f in found if self.font.own(f[2])] or (found if fallback else [])
        # Japanese characters write it in the form Japan does (免 in 勉, not the stroke-short 免 of 睌).
        found = [f for f in found if f[2] in self.japanese] or found
        if not found:
            return None
        counts = Counter(len(p.contours) for p, _, _ in found)
        most = max(counts.values())
        found = [f for f in found if counts[len(f[0].contours)] == most]
        shapes = [_shape(p, 24).astype(float) for p, _, _ in found]
        mean = np.mean(shapes, axis=0)
        box = tuple(float(v) for v in np.median(np.array(boxes), axis=0))
        # Unlike the average shape, or drawn small (下 inside 門, whose strokes, enlarged, are too
        # thick for any weight to bring back): each counts against an instance.
        unlike = np.array([np.abs(s - mean).mean() for s in shapes])
        grown = np.array([math.log(max(_area(box) / max(_area(p.box), 1), 1)) for p, _, _ in found])
        # Stretched to stand alone (上 cut from atop 𠀝): its proportions were drawn for elsewhere.
        stretched = np.array([math.log(self._stretch(p.box, box)) for p, _, _ in found])
        k = int(np.argmin(unlike / max(float(np.median(unlike)), 1e-6) + GROWN * grown + STRETCHED * stretched))
        piece, _, host_char = found[k]
        return Placed(piece, piece.box, fitted(piece.box, box, ALONE_STRETCH), native=self.ink(host_char), origin=f"alone {host_char}")

    def _cells(self, op: str, outer: list[Placed], region: Box, inner: Node) -> list[Placed] | None:
        """A side-by-side pair (⿰幺幺, written 𢆶) in the two cells a stroke down the middle of the
        enclosing part's opening makes (山's in 幽): each half in the room left of that stroke and
        right of it. None when the inner part is no such pair or the opening is not divided."""
        tree = inner if isinstance(inner, tuple) else (parse(self.sequences[inner]) if inner in self.sequences else None)
        if not isinstance(tree, tuple) or tree[0] != "⿰" or len(tree) != 3:
            return None
        middle = (region[0] + region[2]) / 2
        halves = [(region[0], region[1], middle, region[3]), (middle, region[1], region[2], region[3])]
        rooms = [self._room(op, outer, half) for half in halves]
        if any(r is None or _area(r) < CELL_ROOM * _area(region) for r in rooms):
            return None
        out = []
        grow = ROOM_MARGIN * self.font.stem[0][0]
        for i, (child, room) in enumerate(zip(tree[1:], rooms)):
            # Filling its cell as in a side-by-side pair, up to the strokes around it (the room
            # keeps a margin clear of them): narrow, from a host writing it in that place.
            room = (room[0] - grow, room[1], room[2] + grow, room[3])
            found = self._host("⿰", i, child, [tree[2 - i]], room)
            if found is None:
                out.extend(self._node(child, room))
                continue
            drawn, k = found
            piece = drawn.pieces[k]
            out.append(Placed(piece, piece.box, fitted(piece.box, room, CELL_STRETCH), native=self.ink(drawn.char), origin=f"host {drawn.char}"))
        return out

    def _room(self, op: str, outer: list[Placed], region: Box, size: int = 48) -> Box | None:
        """The largest empty box inside `region` that the placed enclosing part closes on its
        closed sides (`ENCLOSE`), at least `ROOM_MARGIN` stroke widths clear of its ink."""
        rings = [ring for p in outer for ring in _rings(p.part.contours, p.contours())]
        ink = fill(rings, size, region)
        margin = max(1, round(ROOM_MARGIN * self.font.stem[0][0] / ((region[2] - region[0]) / size)))
        grown = ink.copy()
        for _ in range(margin):
            step = grown.copy()
            step[1:] |= grown[:-1]
            step[:-1] |= grown[1:]
            step[:, 1:] |= grown[:, :-1]
            step[:, :-1] |= grown[:, 1:]
            grown = step
        free = ~grown
        best, heights = None, np.zeros(size, int)
        for row in range(size):
            heights = np.where(free[row], heights + 1, 0)
            stack: list[int] = []
            for col in range(size + 1):
                h = heights[col] if col < size else 0
                while stack and heights[stack[-1]] >= h:
                    top = stack.pop()
                    height, left = heights[top], (stack[-1] + 1 if stack else 0)
                    width = col - left
                    if not height or not width:
                        continue
                    r0, r1, c0, c1 = row - height + 1, row + 1, left, col
                    # Each closed side must have ink between the room and the region's edge.
                    sides = {"L": ink[r0:r1, :c0], "R": ink[r0:r1, c1:], "T": ink[:r0, c0:c1], "B": ink[r1:, c0:c1]}
                    if all(sides[side].any() for side in ENCLOSE[op]) and (best is None or height * width > best[0]):
                        best = (height * width, r0, r1, c0, c1)
                stack.append(col)
        if best is None:
            return None
        _, r0, r1, c0, c1 = best
        w, h = (region[2] - region[0]) / size, (region[3] - region[1]) / size
        return (region[0] + c0 * w, region[3] - r1 * h, region[0] + c1 * w, region[3] - r0 * h)

    def _space(self, axis: int, groups: list[list[Placed]]) -> None:
        """Neighbouring parts moved apart where they face each other closer than `FACING`, the gap
        nineteen in twenty drawn characters keep: each gives up half the shortfall on its facing side."""
        for a, b in pairwise(groups):
            gap = _facing(a, b, axis)
            if gap is None or gap >= FACING[axis]:
                continue
            half = (FACING[axis] - gap) / 2
            first, second = (a, b) if axis == 0 else (b, a)  # lower x first; y is up, so the stacked lower part first
            # No part gives up more than `SQUEEZE` of its length: parts drawn into each other are a
            # layout fault this pass does not mend.
            limit = lambda group: SQUEEZE * (max(p.target[axis + 2] for p in group) - min(p.target[axis] for p in group))
            _squeeze(first, axis, 0.0, -min(half, limit(first)))
            _squeeze(second, axis, min(half, limit(second)), 0.0)

    @staticmethod
    def _stretch(source: Box, target: Box) -> float:
        """How much a part from `source` changes its proportions in `target`."""
        sx = (target[2] - target[0]) / max(source[2] - source[0], 1)
        sy = (target[3] - target[1]) / max(source[3] - source[1], 1)
        return max(sx / sy, sy / sx)

    def _place(self, part: Part, target: Box, native: float, origin: str) -> Placed:
        """A whole glyph drawn into `target`, its proportions changed by at most `STRETCH`."""
        return Placed(part, part.box, fitted(part.box, target), native=native, origin=origin)

    def _row(self, child: Node, box: Box, count: int) -> list[Placed]:
        """`child` drawn into `box` as one of `count` aligned operands; a whole glyph in a row of
        three may change its proportions by up to `ROW_STRETCH`."""
        group = self._node(child, box)
        if count == 3 and len(group) == 1 and group[0].origin.startswith("glyph "):
            group[0].target = fitted(group[0].source, box, ROW_STRETCH)
        return group

    def _shares(self, op: str, children: list[Node], region: Box) -> list[Placed]:
        """With no drawn character to follow, operands share the region along an aligned operator by
        `SHARES` (fitted on the drawn characters of each operator), each part still cut from a host
        in its place where one exists; an enclosed operand takes the room its enclosing part leaves."""
        if op in ENCLOSE:
            outer = self._node(children[0], region)
            room = self._room(op, outer, region)
            if room is None:
                x0, y0, x1, y1 = INSIDE[op]
                w, h = region[2] - region[0], region[3] - region[1]
                room = (region[0] + x0 * w, region[1] + y0 * h, region[0] + x1 * w, region[1] + y1 * h)
            inner = self._node(children[1], room)
            _fit_inside(outer, inner, region, self.font.stem[0][0])
            return outer + inner
        axis = AXIS[op]
        power, middle = SHARES.get((op, len(children)), (0.5, 1.0))
        weights = [self.ink(c) ** power * (middle if 0 < k < len(children) - 1 else 1.0) for k, c in enumerate(children)]
        gap = 0.04
        fit = (1 - gap * (len(children) - 1)) / sum(weights)
        lo, span = region[axis], region[axis + 2] - region[axis]
        groups, at = [], 0.0
        for i, (child, share) in enumerate(zip(children, weights)):
            a, b = at, at + share * fit
            at = b + gap
            if axis == 1:
                a, b = 1 - b, 1 - a
            box = list(region)
            box[axis], box[axis + 2] = lo + a * span, lo + b * span
            box = tuple(box)
            part = self._host(op, i, child, children[:i] + children[i + 1:], box)
            if part is not None:
                drawn, k = part
                source = drawn.pieces[k]
                groups.append([Placed(source, source.box, fitted(source.box, box), native=self.ink(drawn.char), origin=f"host {drawn.char}")])
            else:
                groups.append(self._row(child, box, len(children)))
        self._space(axis, groups)
        return [p for group in groups for p in group]


def _shrunk(box: Box, share: float) -> Box:
    """`box` scaled by `share` about its centre."""
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    hw, hh = (box[2] - box[0]) * share / 2, (box[3] - box[1]) * share / 2
    return (cx - hw, cy - hh, cx + hw, cy + hh)


def _area(box: Box) -> float:
    return max(box[2] - box[0], 0) * max(box[3] - box[1], 0)


def _within(box: Box, room: Box) -> float:
    """The share of `box` lying inside `room`."""
    w = max(0.0, min(box[2], room[2]) - max(box[0], room[0]))
    h = max(0.0, min(box[3], room[3]) - max(box[1], room[1]))
    return w * h / max((box[2] - box[0]) * (box[3] - box[1]), 1)


def _replaced(tree: Node, path: tuple, node: Node) -> Node:
    """`tree` with the node at `path` (operand positions from the root) replaced by `node`."""
    if not path:
        return node
    kids = list(tree[1:])
    kids[path[0]] = _replaced(kids[path[0]], path[1:], node)
    return (tree[0], *kids)


def _swept(placed: Placed, edge: float) -> list[Placed] | None:
    """A glyph drawn round the lower left of another part as a designer draws it there: its strokes
    pressed left of `edge`, where the other part starts, and the stroke that sweeps along its foot
    to the right (毛's, 尢's) drawn out under that part to where the glyph ended (毛 in 毺). None
    when it has no such stroke or already ends left of `edge`."""
    contours = placed.contours()
    boxes = [(c[:, 0].min(), c[:, 1].min(), c[:, 0].max(), c[:, 1].max()) for c in contours]
    x0, y0, x1, y1 = min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)
    reach, foot = SWEEP_REACH
    # It rises from its foot by its stem (乚), unlike a flat stroke along the foot (土's).
    sweeps = [k for k, b in enumerate(boxes) if b[2] >= x1 - reach * (x1 - x0) and b[1] <= y0 + foot * (y1 - y0)
              and b[3] - b[1] >= SWEEP_RISE * (y1 - y0)]
    if len(sweeps) != 1 or len(contours) < 2:
        return None
    sweep = sweeps[0]
    low = contours[sweep][contours[sweep][:, 1] <= y0 + 0.2 * (y1 - y0)]
    if not len(low) or low[:, 0].max() - low[:, 0].min() < SWEEP_FOOT * (x1 - x0):
        return None
    head = max(b[2] for k, b in enumerate(boxes) if k != sweep)
    if head <= edge or edge <= x0 + (x1 - x0) / 4:
        return None
    edge = max(edge, x0 + SWEEP_PRESSED * (head - x0))
    pressed = (edge - x0) / (head - x0)
    # The sweep's stem moves with the pressed strokes, keeping its width; past the turn along its
    # foot it is drawn out to its hook, which keeps its shape.
    left = boxes[sweep][0]
    turn, end = left + STEM_SPAN, x1 - SWEEP_END * (x1 - x0)
    shift = (left - x0) * pressed - (left - x0)
    if end <= turn + shift:
        return None

    def drawn_out(points: np.ndarray) -> np.ndarray:
        x = points[:, 0]
        out = points.copy()
        start = turn + shift
        out[:, 0] = np.select([x <= turn, x <= end], [x + shift, start + (x - turn) * (end - start) / (end - turn)], x)
        return out

    scale = np.array(placed.scale)
    centre = np.array([(placed.source[0] + placed.source[2]) / 2, (placed.source[1] + placed.source[3]) / 2])
    goal = np.array([(placed.target[0] + placed.target[2]) / 2, (placed.target[1] + placed.target[3]) / 2])

    def at(c: Contour, move) -> Contour:
        return Contour(c.ops, move((c.light - centre) * scale + goal), move((c.heavy - centre) * scale + goal), c.width)

    # The other strokes pressed by their target box, so that weighting thickens their stems back.
    strokes = Part([at(c, lambda p: p) for k, c in enumerate(placed.part.contours) if k != sweep])
    box = strokes.box
    pressed_box = (x0 + (box[0] - x0) * pressed, box[1], x0 + (box[2] - x0) * pressed, box[3])
    drawn = Part([at(placed.part.contours[sweep], drawn_out)])
    return [Placed(strokes, strokes.box, pressed_box, placed.weight, placed.native, f"swept {placed.origin}"),
            Placed(drawn, drawn.box, drawn.box, placed.weight, placed.native, f"swept {placed.origin}")]


def _collision(outer: list[Placed], inner: list[Placed], region: Box, size: int = 64) -> float:
    """The share of the inner parts' ink lying on the enclosing part's."""
    a = fill([r for p in outer for r in _rings(p.part.contours, p.contours())], size, region)
    b = fill([r for p in inner for r in _rings(p.part.contours, p.contours())], size, region)
    return float((a & b).sum()) / max(float(b.sum()), 1.0)


def _visible_inside(group: list[Placed], region: Box, size: int = 256) -> bool:
    """Every part has finite, positive bounds and visible ink wholly inside the region.

    Control-point bounds conservatively include curved outlines.
    """
    if not group or not np.isfinite(region).all() or region[2] <= region[0] or region[3] <= region[1]:
        return False
    for p in group:
        for box in (p.source, p.target):
            if not np.isfinite(box).all() or box[2] <= box[0] or box[3] <= box[1]:
                return False
        points = p.contours()
        if not points or not any(len(q) for q in points):
            return False
        all_points = np.concatenate(points)
        if not np.isfinite(all_points).all():
            return False
        low, high = all_points.min(axis=0), all_points.max(axis=0)
        if np.any(low < np.asarray(region[:2]) - 1e-7) or np.any(high > np.asarray(region[2:]) + 1e-7):
            return False
        if not fill(_rings(p.part.contours, points), size, region).any():
            return False
    return True


def _fit_inside(outer: list[Placed], inner: list[Placed], region: Box, stem: float, size: int = 64,
                room: Box | None = None, anchor: tuple[float, float] | None = None) -> bool:
    """The enclosed parts moved and scaled, together and in proportion, to the largest size at which
    their ink fits the enclosing part's opening, clear of its ink by `ROOM_MARGIN` stems, at the
    place nearest where they stand. Their own outline is fitted, not their box, so a part may tuck
    under a roof or into a corner its box would overlap. Given a `room`, they grow no larger than it.
    An `anchor` sets the preferred centre without changing the scale search.
    Return True when the raster search selects and applies a free placement; False
    means no placement was found. Full-ink visibility and bounds require a separate check."""
    w = (region[2] - region[0]) / size
    h = (region[3] - region[1]) / size
    ink = fill([r for p in outer for r in _rings(p.part.contours, p.contours())], size, region)
    margin = max(1, round(ROOM_MARGIN * stem / max(w, h) / 2))
    for _ in range(margin):
        grown = ink.copy()
        grown[1:] |= ink[:-1]
        grown[:-1] |= ink[1:]
        grown[:, 1:] |= ink[:, :-1]
        grown[:, :-1] |= ink[:, 1:]
        ink = grown
    x0 = min(p.target[0] for p in inner)
    y0 = min(p.target[1] for p in inner)
    x1 = max(p.target[2] for p in inner)
    y1 = max(p.target[3] for p in inner)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    blocked = np.fft.rfft2(ink.astype(float), s=(2 * size, 2 * size))
    top = 1.6 if room is None else min(1.6, (room[2] - room[0]) / max(x1 - x0, 1), (room[3] - room[1]) / max(y1 - y0, 1))
    for scale in np.arange(top, 0.45, -0.05):
        hw, hh = (x1 - x0) * scale / 2, (y1 - y0) * scale / 2
        box = (cx - hw, cy - hh, cx + hw, cy + hh)
        # The inner ink, scaled about its centre, rasterised in the region's grid.
        rings = []
        for p in inner:
            t = p.target
            moved = Placed(p.part, p.source, (cx + (t[0] - cx) * scale, cy + (t[1] - cy) * scale,
                                              cx + (t[2] - cx) * scale, cy + (t[3] - cy) * scale), p.weight)
            rings += _rings(p.part.contours, moved.contours())
        # A window of the region's pixel size whose top-left corner is the scaled box's.
        mask = fill(rings, size, (box[0], box[3] - size * h, box[0] + size * w, box[3]))
        rows, cols = np.nonzero(mask)
        if not len(rows):
            return False
        r0, c0 = rows.min(), cols.min()
        mask = mask[r0: rows.max() + 1, c0: cols.max() + 1]
        mh, mw = mask.shape
        if mh > size or mw > size:
            continue
        kernel = np.fft.rfft2(mask[::-1, ::-1].astype(float), s=(2 * size, 2 * size))
        overlap = np.fft.irfft2(blocked * kernel, s=(2 * size, 2 * size))[mh - 1:size, mw - 1:size]
        free = overlap < 0.5
        if not free.any():
            continue
        # The free top-left corners nearest the preferred centre, in grid coordinates.
        ax, ay = anchor if anchor is not None else (cx, cy)
        want_row = (region[3] - (ay + hh)) / h + r0
        want_col = (ax - hw - region[0]) / w + c0
        rr, cc = np.nonzero(free)
        k = int(np.argmin((rr - want_row) ** 2 + (cc - want_col) ** 2))
        top, left = region[3] - (rr[k] - r0) * h, region[0] + (cc[k] - c0) * w
        dx, dy = left - (cx - hw), top - (cy + hh)
        for p in inner:
            t = p.target
            p.target = (cx + (t[0] - cx) * scale + dx, cy + (t[1] - cy) * scale + dy,
                        cx + (t[2] - cx) * scale + dx, cy + (t[3] - cy) * scale + dy)
        return True
    return False


def _squeeze(group: list[Placed], axis: int, low: float, high: float) -> None:
    """A group of placed parts moved in from its low and high edges along `axis`, together."""
    lo = min(p.target[axis] for p in group)
    hi = max(p.target[axis + 2] for p in group)
    new_lo, new_hi = lo + low, hi + high
    scale = (new_hi - new_lo) / max(hi - lo, 1)
    for p in group:
        t = list(p.target)
        t[axis], t[axis + 2] = new_lo + (t[axis] - lo) * scale, new_lo + (t[axis + 2] - lo) * scale
        p.target = tuple(t)


def _facing(a: list[Placed], b: list[Placed], axis: int, size: int = 250) -> float | None:
    """The median gap between two groups along their facing edges, in font units: per row (side by
    side) or column (stacked) where both have ink, from the end of the first to the start of the
    second. `a` is the left or upper group."""
    box = (0.0, ASCENT - EM, EM, ASCENT)
    ma = fill([r for p in a for r in _rings(p.part.contours, p.contours())], size, box)
    mb = fill([r for p in b for r in _rings(p.part.contours, p.contours())], size, box)
    if axis == 0:
        ma, mb = ma.T, mb.T
    gaps = []
    for line in range(size):
        ra, rb = np.nonzero(ma[:, line])[0], np.nonzero(mb[:, line])[0]
        if len(ra) and len(rb):
            gaps.append(rb.min() - ra.max())
    return float(np.median(gaps)) * EM / size if len(gaps) >= 5 else None


# ------------------------------------------------------------------ output
def _segments(ops: list[tuple[str, int, bool]], points: np.ndarray) -> list[tuple[str, list[np.ndarray]]]:
    """A contour as ('M' | 'L' | 'Q', points) segments, with TrueType's implied on-curve points made explicit."""
    at, out = 0, []
    for op, n, implied in ops:
        pts = [np.asarray(p) for p in points[at:at + n]]
        at += n
        if op == "moveTo":
            out.append(("M", [pts[0]]))
        elif op == "lineTo":
            out.append(("L", [pts[0]]))
        elif op == "qCurveTo":
            if implied:
                # Only off-curve points: the contour starts midway between the last and the first.
                start = (pts[-1] + pts[0]) / 2
                out.append(("M", [start]))
                pts = pts + [start]
            *offs, end = pts
            for k, off in enumerate(offs):
                out.append(("Q", [off, (off + offs[k + 1]) / 2 if k + 1 < len(offs) else end]))
        else:
            raise ValueError(f"{op} outlines are not read.")
    return out


def svg_path(placed: list[Placed]) -> str:
    """The composed outlines as one SVG path, in a 1000 × 1000 box with y down from the em's top.
    Fill it with the nonzero rule: strokes and parts overlap."""
    flip = lambda p: f"{p[0]:.1f} {ASCENT - p[1]:.1f}"
    out = []
    for item in placed:
        for contour, points in zip(item.part.contours, item.contours()):
            out.extend(kind + " ".join(map(flip, pts)) for kind, pts in _segments(contour.ops, points))
            out.append("Z")
    return "".join(out)


@cache
def _steps(steps: int) -> np.ndarray:
    """The positions along a quadratic segment at which `_rings` samples it, the start left out."""
    return np.linspace(0, 1, steps + 1)[1:, None]


def _rings(contours: list[Contour], points: list[np.ndarray], steps: int = 6) -> list[np.ndarray]:
    rings = []
    for contour, pts in zip(contours, points):
        ring, last = [], None
        for kind, seg in _segments(contour.ops, pts):
            if kind in "ML":
                last = seg[0]
                ring.append(last)
            else:
                off, on = seg
                t = _steps(steps)
                ring.extend((1 - t) ** 2 * last + 2 * (1 - t) * t * off + t ** 2 * on)
                last = on
        if len(ring) >= 3:
            rings.append(np.array(ring))
    return rings


def fill(rings: list[np.ndarray], size: int, box: Box) -> np.ndarray:
    """A size × size mask of `box` (x0, y0, x1, y1, y up), filled by the nonzero rule at pixel centres."""
    x0, y0, x1, y1 = box
    xs = x0 + (np.arange(size) + 0.5) * (x1 - x0) / size
    ys = y1 - (np.arange(size) + 0.5) * (y1 - y0) / size
    if not rings:
        return np.zeros((size, size), bool)
    a = np.concatenate(rings)
    b = np.concatenate([np.roll(r, -1, axis=0) for r in rings])
    # Every row's crossings at once: an edge crossing row r at x adds its direction to the winding
    # of every pixel centre right of x, which a running sum along the row spreads from x on.
    y = ys[:, None]
    up = (a[None, :, 1] <= y) & (b[None, :, 1] > y)
    rows, edges = np.nonzero(up | ((a[None, :, 1] > y) & (b[None, :, 1] <= y)))
    if not len(rows):
        return np.zeros((size, size), bool)
    p, q = a[edges], b[edges]
    x = p[:, 0] + (ys[rows] - p[:, 1]) * (q[:, 0] - p[:, 0]) / (q[:, 1] - p[:, 1])
    delta = np.zeros((size, size + 1), np.int32)
    np.add.at(delta, (rows, np.searchsorted(xs, x, side="right")), np.where(up[rows, edges], 1, -1))
    return np.cumsum(delta[:, :size], axis=1) != 0


def raster(placed: list[Placed], size: int = 128) -> np.ndarray:
    """A size × size mask of the em, the parts filled and joined."""
    box = (0.0, ASCENT - EM, EM, ASCENT)
    mask = np.zeros((size, size), bool)
    for item in placed:
        mask |= fill(_rings(item.part.contours, item.contours()), size, box)
    return mask


def _square(part: Part, size: int = TYPICAL_SIZE) -> np.ndarray:
    """A part's ink stretched to fill a size × size square."""
    return fill(_rings(part.contours, [c.light for c in part.contours], steps=2), size, part.box)


def _extra_bar(part: Part, mask: np.ndarray, references: list[np.ndarray]) -> bool:
    """A detached four-point horizontal spanning half the part, with over a quarter of its ink
    unsupported by every expanded reference. Counters contain no ink and are ignored."""
    width, height = part.box[2] - part.box[0], part.box[3] - part.box[1]
    for contour in part.contours:
        points = contour.light
        if len(points) != 4 or np.ptp(points[:, 0]) < .5 * width or np.ptp(points[:, 1]) > .15 * height:
            continue
        bar = fill(_rings([contour], [points], steps=2), mask.shape[0], part.box) & mask
        if not bar.any() or not references:
            continue
        others = [c for c in part.contours if c is not contour]
        rest = fill(_rings(others, [c.light for c in others], steps=2), mask.shape[0], part.box) & mask
        if (_grown_mask(bar, 1) & rest).any():
            continue
        if all((bar & ~ref).sum() > .25 * bar.sum() for ref in references):
            return True
    return False


def _grown_mask(mask: np.ndarray, by: int) -> np.ndarray:
    """A mask grown by `by` pixels along rows and columns."""
    for _ in range(by):
        grown = mask.copy()
        grown[1:] |= mask[:-1]
        grown[:-1] |= mask[1:]
        grown[:, 1:] |= mask[:, :-1]
        grown[:, :-1] |= mask[:, 1:]
        mask = grown
    return mask


def _shape(part: Part, size: int = 40) -> np.ndarray:
    """A part's ink stretched to fill a size × size square, thickened by a pixel so that a narrowed
    copy of a stroke still meets the stroke it copies."""
    mask = fill(_rings(part.contours, [c.light for c in part.contours], steps=2), size, part.box)
    grown = mask.copy()
    grown[1:] |= mask[:-1]
    grown[:-1] |= mask[1:]
    grown[:, 1:] |= grown[:, :-1].copy()
    grown[:, :-1] |= grown[:, 1:].copy()
    return grown


def stems(mask: np.ndarray, unit: float) -> tuple[float, float]:
    """The usual stroke width in a mask, in font units (`unit` per pixel): across x (the stems that
    run along y) and across y. Each is the most common length of the short ink runs along rows or
    columns, refined by its neighbours; long runs are strokes seen lengthwise."""
    out = []
    for lines in (mask, mask.T):
        edges = np.diff(np.pad(lines.astype(np.int8), ((0, 0), (1, 1))), axis=1)
        lengths = (np.nonzero(edges == -1)[1] - np.nonzero(edges == 1)[1])
        lengths = lengths[(lengths >= 2) & (lengths <= 40)]
        if not len(lengths):
            out.append(float("nan"))
            continue
        counts = np.bincount(lengths)
        mode = int(np.argmax(counts))
        near = np.arange(max(mode - 2, 0), min(mode + 3, len(counts)))
        out.append(float((near * counts[near]).sum() / counts[near].sum()) * unit)
    return out[0], out[1]
