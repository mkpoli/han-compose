# Recursive variant expressions

A variant expression identifies a base glyph, the decomposition used at each edited site, and the chosen form of each operand. A **space** assigns an ordered set of forms to each independent site. Both can be written as text or saved as versioned JSON.

## Two occurrences in 𦈁

U+26201 decomposes into ⿰𦃃率. On the left, 幺 occurs inside 糸 in 𦃃. On the right it occurs inside the middle of 率. The paths use zero-based operand indices relative to the specified decompositions. [Andrew West, BabelStone IDS, 2025-06-27](https://www.babelstone.co.uk/CJK/IDS.TXT)

```text
space 1 "𦈁"
expand / "𦈁" = "⿰𦃃率" from "BabelStone IDS 2025-06-27 U+26201 [GT]"
expand /0 "𦃃" = "⿱𠂹糸" from "BabelStone IDS 2025-06-27 U+260C3 [GT]"
expand /0/1 "糸" = "⿱幺小" from "BabelStone IDS 2025-06-27 U+7CF8 [GHT]"
expand /1 "率" = "⿳亠⿴{11}幺十" from "BabelStone IDS 2025-06-27 U+7387 [GHTJKP]"
vary /0/1/0 in "VR/5E7A"
vary /1/1/1 in "VR/5E7A"
```

Three upper-stroke designs of 幺 can occupy either site, giving **3 × 3 = 9** whole-character designs. Four GlyphWiki witnesses (G, H, T and var-002) map to the folded form. Import `yaoFamily` from `han-compose/yao-catalogue` for the input aliases, regional font witnesses and registered IVS. UCV 129 relates 么 and 幺 at the component level. [Glyph witnesses and source editions](../../js/src/yao-catalogue.js)

From the repository root, these commands count the designs, write design 5 as editable text, and recover its rank from the exact IDS.

```sh
bun js/scripts/variation.mjs count
bun js/scripts/variation.mjs at 5
bun js/scripts/variation.mjs ids 5
bun js/scripts/variation.mjs detect "$(bun js/scripts/variation.mjs ids 5)"
```

## Notation

| Line | Meaning |
| --- | --- |
| `variant 1 "字"` or `space 1 "字"` | An individual design or its space of choices. The base can itself be an IDS or a named component. |
| `expand PATH "subject" = "IDS" from "source"` | Cite the decomposition that makes descendants addressable. |
| `form PATH "subject" = "text" in "family" "id"` | Select a catalogue form. Preserve its identity and exact spelling. |
| `form PATH "subject" = "text" from "source"` | Supply a local design as an IVS, structural IDS or named component. |
| `vary PATH in "family"` | Vary one occurrence over the family's forms. An optional JSON array gives a subset in the specified order. |
| `vary PATH among ["family1","family2"]` | Include the forms of several families at one site. |
| `vary PATH options [...]` | Pin an ordered list of exact spellings. Use `{"family":"…","form":"…","text":"…"}` or `{"source":"…","text":"…"}` for each choice. |

Each directive occupies one line. Quoted text uses JSON string escapes. The root path is `/`. Blank lines and comment lines beginning with `#` are allowed.

Keep the expression for the source, occurrence paths and catalogue identities. Its ordinary IDS projection carries the chosen spellings and expands only the branches needed to write them. If a form itself has editable parts, add an expansion for that selected form at its path, then describe its children. Independent product dimensions occupy disjoint paths. When a parent's shape changes the available children, give each parent design its own product of child choices. Pass those products to `createVariationBranches([{id, product}, …])`. Its count is the sum of the branch sizes, and its indices preserve each branch identity even when two branches yield the same IDS.

## Render 𦈁

Pass the gallery’s copied IDS to the composer to draw the full character. The selected designs use newly drawn 幺 components in a Noto Serif CJK–style composition.

```js
import { compose, drawingSvg } from 'han-compose'
import { sourceFor } from 'han-compose/source'

const ids = '⿰⿱𠂹⿱幺󠄀小⿳亠⿴{11}&VR-5E7A-02;十'
const drawing = await compose(sourceFor(ids, { bundled: true }), ids)
const svg = drawingSvg(drawing)
```

## Save a catalogue with the design

A portable archive holds an expression or pinned space with the referenced families, their source metadata and any supplied outlines. Reopen it independently of later catalogue edits. A URL still requires the external resource when its drawing was supplied only by reference.

```sh
bun js/scripts/variation.mjs archive > u26201.json
bun js/scripts/variation.mjs --input u26201.json count
bun js/scripts/variation.mjs --input u26201.json at 5
```

## Query and detection

`createVariationProduct` orders sites by operand path. Its count is the product of their sizes. `at(index)` and `rank(expression)` use arbitrary-precision mixed-radix integers with the rightmost site changing fastest. `toJSON()` pins the form order and spellings for interchange. A newly registered form can extend an unpinned family without renumbering an archived space.

`detect(ids)` accepts canonical spellings and registered input aliases at each variable site. It recovers an exact position in the space, or returns the candidate identities when more than one spells the same IDS. An unqualified encoded character usually leaves the inner choices unknown. For an already located component outline, `recognizeVariationOutline` compares it against source outlines in a common coordinate frame and reports matching witnesses at an explicit tolerance. Whole-page segmentation and recognition of unfamiliar handwriting are outside this operation.

Registered IVSes retain their collection identities. Imported UCV and NUCV records retain their original criteria, exclusions and witnesses. A product of local component choices receives a Unicode or IRG reference only when evidence separately establishes the mapping. [Variation registry](variation-registry.md) · [Unicode, UTS #37](https://www.unicode.org/reports/tr37/) · [IRG, Working Document Series](https://www.unicode.org/irg/IWDS.html)
