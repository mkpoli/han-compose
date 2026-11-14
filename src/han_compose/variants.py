"""Every form of a character the fonts on hand draw, each with where it comes from.

`forms` collects four kinds, in this order:

1. `regional`: the character in each regional face of the style's Noto CJK collection (JP, KR, SC,
   TC, HK). These are Noto's own regional designs. They are not the IRG source glyphs of the code
   charts, and a face's region is not an IRG source.
2. `ivs`: each sequence the Ideographic Variation Database registers for the character, drawn from
   the first font that maps it in its `cmap` format 14 subtable: the collection's faces, IPAmj
   Mincho, then Jigmo. A sequence no font maps is listed without an outline.
3. `svs`: each standardized variation sequence of `StandardizedVariants.txt`, drawn the same way.
4. `compatibility`: each CJK compatibility ideograph Unihan's `kCompatibilityVariant` gives the
   character, drawn from the first of those fonts that maps its code point.

A form whose outline an earlier form already has names that form in `same_as`. Outlines are compared
as drawn: scaled to a 1000-unit em and rounded to a tenth of a unit, whatever order their contours
come in. Two fonts' drawings of one shape differ, so they are never the same form.

Every label is read from a font's `name` table or from a pinned data file. `sheet` lays the forms
out as one SVG.

`composed` does the same for a sequence: one drawing by the composer for each way to write its
components with the variation sequences the style's font draws (`spellings`).
"""

from __future__ import annotations

import hashlib
import io
import math
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from functools import cached_property
from itertools import islice, product
from pathlib import Path
from xml.sax.saxutils import escape

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTCollection, TTFont

from .compose import (
    _JIGMO,
    EM,
    OFL,
    STYLES,
    Composer,
    Font,
    Node,
    Source,
    _fetched,
    _selector,
    parse,
    svg_path,
)
from .vocab import cache_root


@dataclass(frozen=True)
class Table:
    """A data file fetched once into `<cache>/<file>` and checked against its SHA-256 on every read."""

    file: str
    url: str
    sha256: str
    licence: str
    #: The edition the file states for itself.
    edition: str

    def path(self, cache: Path | None = None) -> Path:
        return (cache or cache_root()) / self.file

    def read(self, cache: Path | None = None) -> bytes:
        import httpx

        path = self.path(cache)
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(httpx.get(self.url, follow_redirects=True, timeout=300).content)
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != self.sha256:
            raise ValueError(f"{path} does not match its pinned SHA-256.")
        return data


UNICODE_LICENCE = "Unicode License v3"
#: The Ideographic Variation Database's sequences, in the edition of 2026-08-03. Its header names
#: Unicode's terms of use and no licence of its own.
IVD = Table("ivd/IVD_Sequences-2026-08-03.txt", "https://www.unicode.org/ivd/data/2026-08-03/IVD_Sequences.txt",
            "2b466659c2bfde1c52e60bd9fc883ab14dfa5c583df024b80352420265d2cd87",
            "Unicode terms of use (https://www.unicode.org/copyright.html)", "2026-08-03")
#: Unicode 16.0.0, the version the Unihan archive is pinned at.
STANDARDIZED = Table("ucd/StandardizedVariants-16.0.0.txt", "https://www.unicode.org/Public/16.0.0/ucd/StandardizedVariants.txt",
                     "36e799b2c5d902af094b4dd2cb60622bffc079824bfd0bf62e3a636d698b3fb5", UNICODE_LICENCE, "16.0.0")
UNIHAN = Table("ucd/unihan/Unihan-16.0.0.zip", "https://www.unicode.org/Public/16.0.0/ucd/Unihan.zip",
               "b8f000df69de7828d21326a2ffea462b04bc7560022989f7cc704f10521ef3e0", UNICODE_LICENCE, "16.0.0")


@dataclass(frozen=True)
class Collection:
    """A Noto CJK collection, whose faces draw one design for each region. It is read from
    `<cache>/fonts/<file>`, else from where Debian's `fonts-noto-cjk` installs it, and is never
    fetched: the digest is that of the packaged file."""

    file: str
    sha256: str
    licence: str
    #: Each regional face's family name (`name` ID 1), in the order the forms are listed.
    families: tuple[str, ...]

    def path(self, cache: Path | None = None) -> Path | None:
        for folder in ((cache or cache_root()) / "fonts", SYSTEM_FONTS):
            if (folder / self.file).exists():
                return folder / self.file
        return None


SYSTEM_FONTS = Path("/usr/share/fonts/opentype/noto")
#: The regions Noto CJK draws, as its family names end.
REGIONS = ("JP", "KR", "SC", "TC", "HK")
#: The static Regular collections of Noto Sans CJK 2.004 and Noto Serif CJK 2.002, as Debian's
#: fonts-noto-cjk 1:20230817+repack1-3 ships them.
COLLECTIONS = {
    "sans": Collection("NotoSansCJK-Regular.ttc", "b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a", OFL,
                       tuple(f"Noto Sans CJK {region}" for region in REGIONS)),
    "serif": Collection("NotoSerifCJK-Regular.ttc", "93069d8e9e45d515cc421c971a79e6a5777704b348e36a9ef86578bf58adef77", OFL,
                        tuple(f"Noto Serif CJK {region}" for region in REGIONS)),
}
#: IPAmj Mincho 006.01, whose glyphs are named by their MJ numbers.
IPAMJ = Source("ipamj/ipamjm.ttf", "https://dforest.watch.impress.co.jp/library/i/ipamjfont/10750/ipamjm00601.zip",
               "a3e84f495f3c388db7a1473bf1985c1c076d0c814100f10a027ca6853eb1e8cb", "IPA Font License v1.0",
               member="ipamjm.ttf", archive_sha256="35494e0f2896f38b3f7369a8421a895cea6440a42c0a66ac95eab47d6ed25b68")
#: Jigmo's BMP font first, then the supplementary planes.
JIGMO = (_JIGMO[2], _JIGMO[0], _JIGMO[1])

KINDS = ("regional", "ivs", "svs", "compatibility", "composed")
#: The most ways `spellings` writes one sequence.
COMBINATIONS = 24


def missing(style: str, cache: Path | None = None) -> list[str]:
    """The files `forms` reads for `style` that are not on disk: it would fetch them, except the
    collection, which it cannot."""
    root = cache or cache_root()
    out = [] if COLLECTIONS[style].path(cache) else [COLLECTIONS[style].file]
    out += [source.file for source in (IPAMJ, *JIGMO) if not (root / "fonts" / source.file).exists()]
    return out + [table.file for table in (IVD, STANDARDIZED, UNIHAN) if not table.path(cache).exists()]


# ------------------------------------------------------------------ fonts
def outline(commands: list[tuple[str, tuple]], scale: float, ascent: float) -> str:
    """Pen commands as an SVG path in a 1000 × 1000 box, y down from the em's top, to a tenth of a unit."""
    def at(point: tuple[float, float]) -> str:
        return f"{round(point[0] * scale, 1):g} {round((ascent - point[1]) * scale, 1):g}"

    out = []
    for op, points in commands:
        if op in ("closePath", "endPath"):
            out.append("Z")
        elif op == "moveTo":
            out.append("M" + at(points[0]))
        elif op == "lineTo":
            out.append("L" + at(points[0]))
        elif op == "curveTo":
            out.append("C" + " ".join(map(at, points)))
        elif op == "qCurveTo":
            *offs, end = points
            if end is None:
                # Only off-curve points: the contour starts midway between the last and the first.
                end = ((offs[-1][0] + offs[0][0]) / 2, (offs[-1][1] + offs[0][1]) / 2)
                out.append("M" + at(end))
            for k, off in enumerate(offs):
                on = ((off[0] + offs[k + 1][0]) / 2, (off[1] + offs[k + 1][1]) / 2) if k + 1 < len(offs) else end
                out.append(f"Q{at(off)} {at(on)}")
        else:
            raise ValueError(f"{op} outlines are not read.")
    return "".join(out)


def same(path: str) -> str:
    """What two outlines of one form share: the path's contours in a fixed order."""
    return "".join(sorted(contour for contour in path.split("Z") if contour))


@dataclass
class Face:
    """One font, or one face of a collection, with what `forms` reads of it."""

    file: str
    font: TTFont
    licence: str
    sha256: str

    @cached_property
    def name(self) -> str:
        return self.font["name"].getDebugName(4)

    @cached_property
    def family(self) -> str:
        return self.font["name"].getDebugName(1)

    @cached_property
    def version(self) -> str:
        """The font's version as its `name` table states it, without the tools that built it."""
        return self.font["name"].getDebugName(5).split(";")[0].removeprefix("Version ")

    @cached_property
    def cmap(self) -> dict[int, str]:
        return self.font.getBestCmap()

    @cached_property
    def sequences(self) -> dict[tuple[int, int], str | None]:
        """(base, selector) → the glyph the font maps the sequence to, None for the base's own."""
        return {(base, selector): name for table in self.font["cmap"].tables if table.format == 14
                for selector, pairs in table.uvsDict.items() for base, name in pairs}

    def selected(self, base: int, selector: int) -> str | None:
        """The glyph the font draws a variation sequence with, None where it maps no such sequence."""
        if (base, selector) not in self.sequences:
            return None
        return self.sequences[(base, selector)] or self.cmap.get(base)

    def outline(self, glyph: str) -> str:
        glyphs = self.font.getGlyphSet()
        pen = DecomposingRecordingPen(glyphs)
        glyphs[glyph].draw(pen)
        # The em's top is the typographic ascender: 880 of 1,000 in Noto, 880 of 1,024 in Jigmo,
        # 1,802 of 2,048 in IPAmj.
        return outline(pen.value, EM / self.font["head"].unitsPerEm, self.font["OS/2"].sTypoAscender)


@dataclass
class Fonts:
    """The fonts a style's forms are drawn from: the collection's regional faces, then the fonts
    that map variation sequences the collection does not."""

    regional: list[Face]
    others: list[Face]

    @classmethod
    def of(cls, style: str, cache: Path | None = None) -> Fonts:
        collection = COLLECTIONS[style]
        path = collection.path(cache)
        if path is None:
            raise FileNotFoundError(f"{collection.file} is neither in {(cache or cache_root()) / 'fonts'} nor in {SYSTEM_FONTS}.")
        if hashlib.sha256(path.read_bytes()).hexdigest() != collection.sha256:
            raise ValueError(f"{path} does not match its pinned SHA-256.")
        faces = {face.family: face for face in (Face(collection.file, font, collection.licence, collection.sha256)
                                                for font in TTCollection(path, lazy=True).fonts)}
        others = [Face(source.file, TTFont(_fetched(source, cache), lazy=True), source.licence, source.sha256)
                  for source in (IPAMJ, *JIGMO)]
        return cls([faces[family] for family in collection.families], others)

    @property
    def all(self) -> list[Face]:
        return self.regional + self.others


# ------------------------------------------------------------------ data
def registered(base: int, cache: Path | None = None) -> dict[int, list[tuple[str, str]]]:
    """The character's sequences in the Ideographic Variation Database: selector → each collection
    that registers the sequence, with its identifier there (`845B E0100; Adobe-Japan1; CID+1481`)."""
    out: dict[int, list[tuple[str, str]]] = {}
    for line in IVD.read(cache).decode().splitlines():
        if line.startswith("#") or not line.strip():
            continue
        sequence, collection, identifier = (cell.strip() for cell in line.split(";")[:3])
        point, selector = (int(value, 16) for value in sequence.split())
        if point == base:
            out.setdefault(selector, []).append((collection, identifier))
    return dict(sorted(out.items()))


def standardized(base: int, cache: Path | None = None) -> dict[int, str]:
    """The character's standardized variation sequences: selector → the description
    `StandardizedVariants.txt` gives (`4FAE FE00; CJK COMPATIBILITY IDEOGRAPH-FA30;`)."""
    out = {}
    for line in STANDARDIZED.read(cache).decode().splitlines():
        if line.startswith("#") or not line.strip():
            continue
        sequence, description = (cell.strip() for cell in line.split(";")[:2])
        point, selector = (int(value, 16) for value in sequence.split())
        if point == base:
            out[selector] = description
    return dict(sorted(out.items()))


def unihan(base: int, cache: Path | None = None) -> tuple[list[int], dict[str, str]]:
    """The compatibility ideographs whose `kCompatibilityVariant` is the character, and the
    character's `kIRG_*Source` values, from `Unihan_IRGSources.txt`."""
    text = zipfile.ZipFile(io.BytesIO(UNIHAN.read(cache))).read("Unihan_IRGSources.txt").decode()
    own = f"U+{base:04X}"
    compatibility, sources = [], {}
    for line in text.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        point, prop, value = line.split("\t")
        if prop == "kCompatibilityVariant" and value == own:
            compatibility.append(int(point.removeprefix("U+"), 16))
        elif point == own and prop.startswith("kIRG_") and prop.endswith("Source"):
            sources[prop] = value
    return sorted(compatibility), sources


# ------------------------------------------------------------------ forms
@dataclass
class Form:
    """One form: what selects it, the font and glyph that draw it, and its outline."""

    kind: str
    label: str
    #: The text that selects the form. A regional form is selected by its face, not by its text.
    sequence: str
    face: Face | None = None
    glyph: str | None = None
    outline: str | None = None
    #: The label of the first form with this outline, when there is one.
    same_as: str | None = None
    #: An IVD sequence's collections and identifiers, or a standardized sequence's description.
    registered: list[dict[str, str]] = field(default_factory=list)
    description: str | None = None
    #: A composed form's components written with a variation selector, and where each part drawn came from.
    components: list[dict] = field(default_factory=list)
    parts: list[str] = field(default_factory=list)
    #: Why the form has no outline.
    note: str | None = None

    def record(self) -> dict:
        out: dict = {"kind": self.kind, "label": self.label, "sequence": self.sequence,
                     "codepoints": [f"U+{ord(char):04X}" for char in self.sequence],
                     "font": self.face.file if self.face else None,
                     "face": f"{self.face.name} {self.face.version}" if self.face else None,
                     "glyph": self.glyph}
        if self.registered:
            out["registered"] = self.registered
        if self.description:
            out["description"] = self.description
        if self.components:
            out["components"] = self.components
        if self.parts:
            out["parts"] = self.parts
        if self.same_as:
            out["same_as"] = self.same_as
        if self.note:
            out["note"] = self.note
        out["outline"] = self.outline
        return out


def forms(char: str, fonts: Fonts, cache: Path | None = None) -> tuple[list[Form], dict[str, str]]:
    """Every form of `char`, and the IRG sources Unihan lists for it. The sources are data about the
    character: no form here is a source's glyph."""
    if len(char) != 1:
        raise ValueError(f"{char!r} is not one character.")
    base = ord(char)
    out = []
    for face in fonts.regional:
        if base in face.cmap:
            out.append(Form("regional", face.family, char, face, face.cmap[base]))

    def drawn(form: Form, selector: int) -> Form:
        for face in fonts.all:
            glyph = face.selected(base, selector)
            if glyph is not None:
                form.face, form.glyph = face, glyph
                break
        return form

    for selector, entries in registered(base, cache).items():
        label = ", ".join(f"{collection} {identifier}" for collection, identifier in entries)
        out.append(drawn(Form("ivs", label, char + chr(selector),
                              registered=[{"collection": c, "identifier": i} for c, i in entries]), selector))
    for selector, description in standardized(base, cache).items():
        out.append(drawn(Form("svs", f"U+{base:04X} U+{selector:04X}", char + chr(selector), description=description), selector))
    compatibility, sources = unihan(base, cache)
    for point in compatibility:
        face = next((face for face in fonts.all if point in face.cmap), None)
        out.append(Form("compatibility", f"U+{point:04X}", chr(point), face, face.cmap[point] if face else None))

    first: dict[str, str] = {}
    for form in out:
        if form.face is None:
            form.note = "No font on disk maps this sequence."
            continue
        form.outline = form.face.outline(form.glyph)
        held = first.setdefault(same(form.outline), form.label)
        if held != form.label:
            form.same_as = held
    return out, sources


def document(char: str, style: str, found: list[Form], sources: dict[str, str], fonts: Fonts) -> dict:
    """`variants.json`: the forms, the IRG sources Unihan lists, and every input with its pin."""
    used = {id(form.face) for form in found if form.face}
    return {
        "character": char,
        "codepoint": f"U+{ord(char):04X}",
        "style": style,
        "forms": [form.record() for form in found],
        "irg_sources": {"note": "Unihan's kIRG_*Source values for the character. No form here is a source's glyph.", **sources},
        "fonts": [_font(face) for face in fonts.all if id(face) in used],
        "data": [_pin(table) for table in (IVD, STANDARDIZED, UNIHAN)],
    }


def _font(face: Face) -> dict:
    return {"file": face.file, "face": f"{face.name} {face.version}", "sha256": face.sha256, "licence": face.licence}


def _pin(table: Table) -> dict:
    return {"file": Path(table.file).name, "edition": table.edition, "url": table.url, "sha256": table.sha256,
            "licence": table.licence}


# ------------------------------------------------------------------ sequences
def _leaves(node: Node) -> list[str]:
    return [node] if isinstance(node, str) else [leaf for kid in node[1:] for leaf in _leaves(kid)]


def spellings(sequence: str, font: Font) -> tuple[list[str], int]:
    """`sequence` written each way its components' variation sequences allow, as written first, and
    how many ways there are: at most `COMBINATIONS` are handed back. A component takes each sequence
    the style's font draws with a glyph of its own, one for each glyph (`web_export.variant_choices`).
    A component written with a selector keeps it."""
    from .web_export import variant_choices

    tree = parse(sequence)
    choices = variant_choices(font)
    options = [[leaf, *sorted(choice for choice in choices if choice[0] == leaf)] if len(leaf) == 1 else [leaf]
               for leaf in _leaves(tree)]

    def written(node: Node, leaves) -> str:
        return next(leaves) if isinstance(node, str) else node[0] + "".join(written(kid, leaves) for kid in node[1:])

    return ([written(tree, iter(chosen)) for chosen in islice(product(*options), COMBINATIONS)],
            math.prod(len(option) for option in options))


def _selected(component: str, position: int, cache: Path | None) -> dict:
    """A component written with a selector, its place among the sequence's components, and what
    registers or standardizes the sequence."""
    base, selector = ord(component[0]), ord(component[1])
    out: dict = {"component": component[0], "position": position, "sequence": component,
                 "codepoints": [f"U+{base:04X}", f"U+{selector:04X}"]}
    entries = registered(base, cache).get(selector)
    if entries:
        out["registered"] = [{"collection": c, "identifier": i} for c, i in entries]
    description = standardized(base, cache).get(selector)
    if description:
        out["description"] = description
    return out


def composed(sequence: str, composer: Composer, cache: Path | None = None) -> tuple[list[Form], int]:
    """One drawing by `composer` for each of `spellings`, and how many ways there are in all. A form
    is labelled by the components it writes with a selector, each with its collection and
    identifier; the sequence as written is labelled by itself. A component the sequence holds more
    than once is numbered by its place among the components (`者[5]`), so no two labels are alike."""
    source = composer.font.style.font
    face = Face(source.file, composer.font.font, source.licence, source.sha256)
    written, total = spellings(sequence, composer.font)
    out, first = [], {}
    for text in written:
        leaves = _leaves(parse(text))
        held = Counter(leaf[0] for leaf in leaves)
        components = [_selected(leaf, position, cache) for position, leaf in enumerate(leaves, 1)
                      if len(leaf) == 2 and _selector(leaf[1])]
        names = [c["component"] + (f"[{c['position']}]" if held[c["component"]] > 1 else "") + " "
                 + (", ".join(f"{r['collection']} {r['identifier']}" for r in c["registered"])
                    if "registered" in c else " ".join(c["codepoints"])) for c in components]
        form = Form("composed", "; ".join(names) or text, text, face, components=components)
        try:
            placed = composer.compose(text)
        except (LookupError, ValueError) as error:
            form.note = f"Not drawn: {error}"
        else:
            form.outline, form.parts = svg_path(placed), [item.origin for item in placed]
            held = first.setdefault(same(form.outline), form.label)
            if held != form.label:
                form.same_as = held
        out.append(form)
    return out, total


def sequence_document(sequence: str, style: str, found: list[Form], total: int) -> dict:
    """`variants.json` for a sequence: the drawings, how many ways there were to write it, and the
    fonts the style composes from."""
    main, fallbacks = STYLES[style].font, STYLES[style].fallbacks
    face = found[0].face
    return {
        "sequence": sequence,
        "codepoints": [f"U+{ord(char):04X}" for char in sequence],
        "style": style,
        "combinations": total,
        "cap": COMBINATIONS,
        "forms": [form.record() for form in found],
        "fonts": [{**_font(face), "url": main.url},
                  *({"file": source.file, "url": source.url, "sha256": source.sha256, "licence": source.licence,
                     "note": "Draws the parts the style's font lacks."} for source in fallbacks)],
        "data": [_pin(table) for table in (IVD, STANDARDIZED)],
    }


# ------------------------------------------------------------------ sheet
CELL = 184
GLYPH = 128
COLUMNS = 6
LINE = 15
MARGIN = 24


def headings(fonts: Fonts) -> dict[str, str]:
    """What a character's sheet writes above each kind."""
    face = fonts.regional[0]
    return {"regional": f"Regional designs of {face.family.rsplit(' ', 1)[0]} {face.version}",
            "ivs": f"Ideographic Variation Database {IVD.edition}",
            "svs": f"Standardized variation sequences, Unicode {STANDARDIZED.edition}",
            "compatibility": f"CJK compatibility ideographs, Unihan {UNIHAN.edition}"}


def sequence_headings(found: list[Form], total: int) -> dict[str, str]:
    """What a sequence's sheet writes above its drawings, with the cap where it cut them short."""
    face = found[0].face
    cut = f", {len(found)} of {total} combinations" if total > len(found) else ""
    return {"composed": f"Composed in {face.name} {face.version}{cut}"}


def _caption(form: Form, found: list[Form], every: bool) -> list[tuple[str, bool]]:
    """A cell's lines beneath its drawing, each with whether it is set lighter: the label, where the
    form is drawn from, and the forms that share its outline."""
    if form.kind == "composed":
        lines = [(part, False) for part in form.label.split("; ")]
        if form.outline is None:
            lines.append(("not drawn", True))
    else:
        lines = [(part, False) for part in form.label.split(", ")]
    if form.kind in ("ivs", "svs", "compatibility"):
        selector = f"U+{ord(form.sequence[-1]):04X}, " if form.kind == "ivs" else ""
        lines.append((selector + (form.face.name if form.face else "no font on disk"), True))
    if every and form.same_as:
        lines.append((f"= {form.same_as}", True))
    if not every:
        lines += [(f"= {part}", True) for other in found if other.same_as == form.label
                  for part in other.label.split("; " if other.kind == "composed" else ", ")]
    return lines


def sheet(title: str, found: list[Form], above: dict[str, str], every: bool = False) -> str:
    """The forms as one SVG under `title`, a row or more for each kind beneath its heading in
    `above`, each drawing above its labels. A form another already draws is named beneath that one,
    or drawn too when `every` is set. The ink is `currentColor`: dark on a light page, light on a
    dark one."""
    body, y, widest = [], MARGIN + 22, 2
    body.append(f'<text x="{MARGIN}" y="{y}" font-size="20">{escape(title)}</text>')
    y += 14
    for kind in KINDS:
        cells = [form for form in found if form.kind == kind and (every or not form.same_as)]
        if not cells:
            continue
        y += 26
        body.append(f'<text x="{MARGIN}" y="{y}" font-size="13" fill-opacity="0.7">{escape(above[kind])}</text>')
        y += 12
        widest = max(widest, min(len(cells), COLUMNS))
        for start in range(0, len(cells), COLUMNS):
            row = cells[start:start + COLUMNS]
            captions = [_caption(form, found, every) for form in row]
            for column, (form, lines) in enumerate(zip(row, captions)):
                x = MARGIN + column * CELL
                if form.outline:
                    body.append(f'<path transform="translate({x} {y}) scale({GLYPH / EM})" d="{form.outline}"/>')
                for k, (text, light) in enumerate(lines):
                    opacity = ' fill-opacity="0.65"' if light else ""
                    body.append(f'<text x="{x}" y="{y + GLYPH + 18 + k * LINE}" font-size="11"{opacity}>{escape(text)}</text>')
            y += GLYPH + 18 + max(len(lines) for lines in captions) * LINE + 6
    width, height = 2 * MARGIN + widest * CELL, y + MARGIN
    style = ".han-variants{color:#1a1a1a}@media (prefers-color-scheme:dark){.han-variants{color:#ececec}}"
    return (f'<svg xmlns="http://www.w3.org/2000/svg" class="han-variants" viewBox="0 0 {width} {height}" width="{width}" '
            f'height="{height}" fill="currentColor" font-family="system-ui, sans-serif"><style>{style}</style>'
            + "".join(body) + "</svg>\n")
