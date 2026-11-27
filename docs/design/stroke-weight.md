# Stroke weight

A composed character takes its parts from glyphs of different densities and sets them at different
sizes. A part cut from a sparse glyph has thicker strokes than one cut from a dense glyph, and a
part scaled to half its size has strokes half as wide. The composer brings every part to the stroke
width the font gives a part of that scale in its own characters, across x and across y separately.

## What the font gives

A style (`Style` in `compose.py`) is a variable font with a `wght` axis and static fonts for what it
lacks. Four things are read or fitted once per style.

| | Where | What it is |
|---|---|---|
| Two masters | `Font.light`, `Font.heavy` | Every glyph's points at weight 400 and at `Style.heavy` (900). The two outlines have the same points in the same order, so a contour at any weight between is a point-wise mix. |
| `stem` | `Font._stem`, `_across` | The width of 丨 across x and of 一 across y, at each master: the median extent of the ink on nine lines across the middle two fifths of the stroke, clear of serifs and end triangles. |
| `stem_curve` | `calibrate` in `scripts/compose_ids.py` | A line per axis, stroke width at 400 against density: `width(density) = intercept + slope × density / 1000`. |
| `part_stems` | `calibrate-parts` in `scripts/compose_ids.py` | A power per axis: a part drawn at scale s of its glyph keeps s to that power of its glyph's stroke width. |

Density is a glyph's outline length (`Composer.ink`). `calibrate` samples 1,500 of the font's own
ideographs, rasters each at 400 px, reads the usual stroke width from the mask (`stems`: the most
common length of the short ink runs along rows, then along columns) and fits the two lines.

| Style | Across x | Across y | |
|---|---|---|---|
| Sans | 85.34 − 1.324 d | 86.93 − 1.914 d | Both thin as a character fills up, the horizontals more. |
| Serif | 67.77 − 0.463 d | 22.31 + 0.164 d | The verticals thin a little, the horizontals not at all. |

`d` is density in thousands of units. In Sans a 聞 is drawn with thinner strokes than a 二, and the
curve says by how much.

## The stem law

`calibrate-parts` cuts characters of the font cleanly in two (side by side, stacked, and
enclosures), and compares each part's stroke width with its own glyph's against the part's scale
along the same axis. The fit is a power through the origin, on parts between 0.2 and 1.2 of their
glyph: a part at its glyph's size keeps its glyph's stem.

| Style | Parts | Across x | Across y | Verticals kept at half size | Horizontals kept at half size |
|---|---|---|---|---|---|
| Sans | 1,990 | 0.233 | 0.350 | 85% | 78% |
| Serif | 1,989 | 0.147 | 0.013 | 90% | 99% |
| Woodblock | 1,983 | 0.259 | 0.171 | 84% | 89% |
| Fangsong | 1,540 | 0.204 | 0.144 | 87% | 91% |
| Regular Kai | 1,936 | 0.314 | 0.303 | 80% | 81% |
| Wen Kai | 2,012 | 0.209 | 0.256 | 87% | 84% |

Plain scaling would leave 50%. In every style and on both axes the law predicts a part's stroke
width with a lower error than the density curve, than keeping the glyph's stem, and than plain
scaling (rms log error across x in Sans: 0.117, 0.125, 0.152, 0.339; in Wen Kai: 0.087, 0.405,
0.116, 0.305). A second power for the scale along the other axis lowers the error by 0.001 to
0.006 and is left out. Dense parts thin a little more than sparse ones in Sans, Fangsong and Wen
Kai, and a term for it lowers the error by at most 0.008; it is left out too.

## Balancing

`Composer._balance` (`balance` in `js/src/compose.js`) runs once on the placed parts.

```
s            = max(scale[axis], PART_SCALE_LEAST)
lift         = width(native) / own[axis] for a glyph of another design, else 1
ratio[axis]  = stem_heavy / stem_light − 1, or (stem_heavy − stem_light) / own[axis] for a static face's own glyph
weight[axis] = (lift × s ^ (part_stems[axis] − 1) − 1) / ratio
```

`scale` is the part's target box over its source box. The weight says how far each point moves
from the light master toward the heavy one, and a part is drawn as `light + (heavy − light) ×
weight` before it is scaled into place. A stroke of width `own` at weight `w` is `own × (1 + w ×
ratio)` wide, and the formula solves that for `own × s ^ part_stems` on a part drawn at `s`. A part
at its source's size keeps its weight, so a frame is left as drawn.

A static face's heavy master is its outline grown by one amount on every side, whatever the stroke.
The ratio is then counted against the stroke width measured on the part's glyph (`Contour.width`):
a thin part borrowed from a crowded host moves less far for the same change. Noto Serif's
horizontals are grown by one amount too (`synthetic_y`), and are counted against `width(native)`.
A fallback's outline is grown in proportion to its stem, so it takes the plain ratio. Contours set
at the size they are drawn at (a swept enclosure) state that scale (`Contour.scaled`), and it
counts with the placement's.
Below `PART_SCALE_LEAST` (0.2, the smallest scale the law is fitted on) a part is weighted as one
at that scale. A glyph of a fallback of another design starts from the width the main font draws
at its density (`width(native)`), over its own.

A font without a style, or a style without `part_stems`, is balanced by density: every part is
brought to `width(density)` of the whole drawing, `weight = (width(density) / (scale × own) − 1) /
ratio`, with `own` the part's measured width or `width(native)`.

Three limits apply.

- The weight is clipped at −0.6 below. Above, Python lets a part squeezed into a narrow box grow
  past the heavy master, up to `WEIGHT_GROWTH` (3.0), and so does the JavaScript engine under the
  stem law, short of a part's `weightLimit`; balancing by density it stops at the heavy master (1).
- A part whose source box is no wider than two stems along an axis is a lone stroke across it (丨,
  一, a bar). It is not weighted there: its box is set to the width its length's scale calls
  for, `extent × scale_along ^ part_stems`, about its middle (by density: `extent × width(density)
  / width(native)`).
- In the JavaScript engine a part marked `fixed` (a bundled component form, a tone mark) keeps the
  weight it has.

## Fonts without two masters

| Case | How its heavy master and width come about |
|---|---|
| A fallback in the variable font's design (`kindred`: Plangothic for Sans) | The stroke width is measured on each glyph (`Font._measured`). The heavy outline is the light one grown outward (`_grown`) by as much as the main font's stems of that width grow at heavy. |
| A fallback of another design (Jigmo for Serif) | The width is the family's ratio to the main font, measured once on its 丨 and 一 (`Font.family`), times the main font's `width(density)`. A Mincho's thin horizontals are lost among the short runs between them, so measuring each glyph misreads them. The heavy outline is grown as above. |
| A variable font whose horizontals do not grow (`synthetic_y`: Noto Serif CJK keeps them about 30 units from 200 to 900) | The heavy master's y coordinates are the light ones grown in the proportion the verticals grow in. |
| A static font as the style's own (TW-Kai, Kureedo, Zhuque Fangsong, Nôm Na Tống) | The heavy outline is the light one grown by `STATIC_GROW` (20 units a side), outward whichever way the face winds its contours (`_ink_on_left`), and the width is measured. A part's weight is counted against its own measured stem. |

A part with a measured width carries it on its contours (`Contour.width`), and `_balance` reads it
in place of the curve.

## In the export

`export-web` writes what the browser engine needs to balance the same way.

| Field | |
|---|---|
| `manifest.heavy`, `manifest.weighted` | The heavy master's weight, and whether parts are balanced. An export without `weighted` is balanced unless `heavy` is 400. |
| `manifest.constants.STEM_CURVE`, `.stem` | The two lines and the stems at each master. |
| `manifest.constants.PART_STEMS`, `.STATIC` | The two powers, and whether the style's font has one weight. An export without `PART_STEMS` is balanced by density; one of a static face written before the law (`weighted` false) has its thin parts lifted to the stroke of the parts at their own size (`staticBalance`). |
| A record's `G.p` | Per contour: the pen commands, the points at 400 and their move to the heavy master, int16 in quarter units. |
| A record's `G.w` | The measured stroke width, on a glyph a fallback or a static font draws. |
| A record's `G.f`, `G.k` | 1 on a glyph a fallback draws: `f` of another design than the style's font, `k` of the same. |

A drawing reports the widths it was brought to as `stroke`.

## A new font

1. Give the style a variable font with a `wght` axis and name the weight of its heavy master. Check
   that the two masters have the same contours and points: a glyph whose outline changes topology
   between them cannot be mixed.
2. Run `uv run scripts/compose_ids.py calibrate --style <name>` and put the two lines in the
   style's `stem_curve`; run `calibrate-parts --style <name>` and put the two powers in its
   `part_stems`.
3. Measure 丨 and 一 at several weights. If the horizontals do not grow, set `synthetic_y`. No style
   has needed the same across x, and there is no switch for it.
4. Choose fallbacks for the characters it lacks. Mark them `kindred` only when they share the
   design; a fallback of another design takes the family ratio.
5. A static font can be a style, with `heavy=400`: its heavy master is grown from its one weight,
   and `part_stems` weights its parts as a variable font's.
6. Run `bench`. It reports the ratio of the composed drawings' stroke widths to the real glyphs',
   which should stay near 1 across the sets.

## Code that moves contours

`_balance` reads a part's stroke width through its scale. Two conventions keep that true.

- A part is placed by its `source` and `target` boxes, and its contours stay in the glyph's own
  units. Code that changes where a part stands changes `target`.
- Code that rewrites the contours themselves (`_swept` and `sweptPart`, which map a glyph into its
  cell and return parts at scale 1) scales the `width` they carry by the same factors. Left at the
  glyph's own width, a foot swept in a half-size cell was read as already thick enough and came out
  lighter than the strokes beside it.
