# Stroke weight

A composed character takes its parts from glyphs of different densities and sets them at different
sizes. A part cut from a sparse glyph has thicker strokes than one cut from a dense glyph, and a
part scaled to half its size has strokes half as wide. The composer brings every part to the stroke
width a real character of the result's density has, across x and across y separately.

## What the font gives

A style (`Style` in `compose.py`) is a variable font with a `wght` axis and static fonts for what it
lacks. Three things are read or fitted once per style.

| | Where | What it is |
|---|---|---|
| Two masters | `Font.light`, `Font.heavy` | Every glyph's points at weight 400 and at `Style.heavy` (900). The two outlines have the same points in the same order, so a contour at any weight between is a point-wise mix. |
| `stem` | `Font._stem`, `_across` | The width of 丨 across x and of 一 across y, at each master: the median extent of the ink on nine lines across the middle two fifths of the stroke, clear of serifs and end triangles. |
| `stem_curve` | `calibrate` in `scripts/compose_ids.py` | A line per axis, stroke width at 400 against density: `width(density) = intercept + slope × density / 1000`. |

Density is a glyph's outline length (`Composer.ink`). `calibrate` samples 1,500 of the font's own
ideographs, rasters each at 400 px, reads the usual stroke width from the mask (`stems`: the most
common length of the short ink runs along rows, then along columns) and fits the two lines.

| Style | Across x | Across y | |
|---|---|---|---|
| Sans | 85.34 − 1.324 d | 86.93 − 1.914 d | Both thin as a character fills up, the horizontals more. |
| Serif | 67.77 − 0.463 d | 22.31 + 0.164 d | The verticals thin a little, the horizontals not at all. |

`d` is density in thousands of units. In Sans a 聞 is drawn with thinner strokes than a 二, and the
curve says by how much.

## Balancing

`Composer._balance` (`balance` in `js/src/compose.js`) runs once on the placed parts.

```
density      = Σ part outline length × (sx + sy) / 2
target[axis] = width(density)
own[axis]    = the part's measured width, or width(native)
ratio[axis]  = stem_heavy / stem_light − 1
weight[axis] = (target / (scale[axis] × own) − 1) / ratio
```

`target` is the stroke width the result should have. `native` is the outline length of the glyph
the part was cut from, and `scale` is the part's target box over its source box. The weight says how far each point moves from the light master toward the
heavy one, and a part is drawn as `light + (heavy − light) × weight` before it is scaled into
place. A stroke of width `own` at weight `w` is `own × (1 + w × ratio)` wide, and the formula solves
that for the width the target asks of a part drawn at `scale`.

Three limits apply.

- The weight is clipped at −0.6 below. Above, Python lets a part squeezed into a narrow box grow
  past the heavy master, up to `WEIGHT_GROWTH` (3.0); the JavaScript engine stops at the heavy
  master (1), or at a part's `weightLimit`.
- A part whose source box is no wider than two stems along an axis is a lone stroke across it (丨,
  一, a bar). It is not weighted there: its box is set to the width the density calls for,
  `extent × width(density) / width(native)`, about its middle.
- In the JavaScript engine a part marked `fixed` (a bundled component form, a tone mark) keeps the
  weight it has.

## Fonts without two masters

| Case | How its heavy master and width come about |
|---|---|
| A fallback in the variable font's design (`kindred`: Plangothic for Sans) | The stroke width is measured on each glyph (`Font._measured`). The heavy outline is the light one grown outward (`_grown`) by as much as the main font's stems of that width grow at heavy. |
| A fallback of another design (Jigmo for Serif) | The width is the family's ratio to the main font, measured once on its 丨 and 一 (`Font.family`), times the main font's `width(density)`. A Mincho's thin horizontals are lost among the short runs between them, so measuring each glyph misreads them. The heavy outline is grown as above. |
| A variable font whose horizontals do not grow (`synthetic_y`: Noto Serif CJK keeps them about 30 units from 200 to 900) | The heavy master's y coordinates are the light ones grown in the proportion the verticals grow in. |
| A static font as the style's own (TW-Kai, Kureedo, Zhuque Fangsong, Nôm Na Tống) | The heavy outline is the light one grown by `STATIC_GROW` (20 units a side), outward whichever way the face winds its contours (`_ink_on_left`), and the width is measured. The three brush faces set `weighted=False`, so their parts keep the weight they have in the font; Nôm Na Tống's parts are balanced. |

A part with a measured width carries it on its contours (`Contour.width`), and `_balance` reads it
in place of the curve.

## In the export

`export-web` writes what the browser engine needs to balance the same way.

| Field | |
|---|---|
| `manifest.heavy`, `manifest.weighted` | The heavy master's weight, and whether parts are balanced. An export without `weighted` is balanced unless `heavy` is 400. |
| `manifest.constants.STEM_CURVE`, `.stem` | The two lines and the stems at each master. |
| A record's `G.p` | Per contour: the pen commands, the points at 400 and their move to the heavy master, int16 in quarter units. |
| A record's `G.w` | The measured stroke width, on a glyph a fallback or a static font draws. |

A drawing reports the widths it was brought to as `stroke`.

## A new font

1. Give the style a variable font with a `wght` axis and name the weight of its heavy master. Check
   that the two masters have the same contours and points: a glyph whose outline changes topology
   between them cannot be mixed.
2. Run `uv run scripts/compose_ids.py calibrate --style <name>` and put the two lines in the
   style's `stem_curve`.
3. Measure 丨 and 一 at several weights. If the horizontals do not grow, set `synthetic_y`. No style
   has needed the same across x, and there is no switch for it.
4. Choose fallbacks for the characters it lacks. Mark them `kindred` only when they share the
   design; a fallback of another design takes the family ratio.
5. A static font can be a style, with `heavy=400` and `weighted=False`: its drawings keep each
   part's own weight and are not balanced.
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
