# Variation registry

A **family** groups documented drawings for a character, a component or a specified position in a larger glyph. Each **form** has an exact IDS spelling. Each **axis** records one observable difference at a specified place in a reference drawing or IDS.

For independent choices inside nested components, see [Recursive variant expressions](variation-expressions.md).

## Choose a form

```js
import { createVariationRegistry } from 'han-compose/variation-registry'
import { rateVariationFamilies } from 'han-compose/rate-forms'
import { grassFamily } from 'han-compose/variants'

const registry = createVariationRegistry([...rateVariationFamilies, grassFamily])
const original = '⿰率率'
const choices = registry.at(original, [1]).find(hit => hit.family.id === 'rate/率')
const selected = choices.family.forms.find(form => form.text === '率󠄁')
const saved = registry.select(original, [1], choices.family.id, selected.id)
// ⿰率率󠄁
const reopened = registry.at(saved, [1])
```

The path starts at the root (`[]`), and each operand is numbered from zero. The example changes only the right 率. Save the returned string unchanged, including its selector or entity terminator.

For 率, the center construction and the direction of the flanking strokes give four reviewed combinations. Two have structural IDS spellings. The other two can be identified across sources by their Adobe glyph numbers.

| Spelling | Code points or IDS | IRG N2978, criterion 30 | Adobe-Japan1 registration |
| --- | --- | --- | --- |
| 率󠄀 | U+7387 U+E0100 | Position 1, `aj1-03952` | CID+3952 |
| 率󠄁 | U+7387 U+E0101 | Position 2, `aj1-14085` | CID+14085 |
| ⿱亠⿱⿲冫幺⿱丿丶十 | Structural IDS | — | — |
| ⿱亠⿱⿲𰀪幺⺀十 | Structural IDS | — | — |

The two identifiers in each of the first two rows name the same Adobe glyph. A source claim on that 率 component belongs to that occurrence. Enclosing it in `⿰虫…` produces a spelling for 蟀 without asserting a registration for the whole compound. [IRG, N2978, 2026-10-20](https://www.unicode.org/irg/docs/n2978-Complete.pdf) · [Unicode, IVD sequences, 2026-08-03](https://www.unicode.org/ivd/data/2026-08-03/IVD_Sequences.txt)

The grass radical catalogue retains the encoded radical forms, two compatibility ideographs, two standardized variants and six IVSes as distinct spellings. For example, `艹︀` and `艹` share the same contextual drawing, and reopening either one recovers the original text. Plain `艹` leaves the drawing unspecified. [Unicode, StandardizedVariants.txt, 16.0](https://www.unicode.org/Public/16.0.0/ucd/StandardizedVariants.txt)

## Describe another difference

| Field | Meaning |
| --- | --- |
| Family `id`, `subjects` | An identifier in the publisher's namespace and the spellings from which the family can be found. |
| `reference` | The exact IDS against which the feature locations are read. |
| Axis `id`, `property`, `values` | A key within the family, the feature under comparison and the documented values. |
| Axis `locus` | One or more operand paths. An optional `strokes` list numbers strokes from one in the cited witness. |
| Form `id`, `text`, `traits` | The source or local identity, an exact savable spelling, and the observed axis/value pairs. |
| Source and witness fields | Record the edition, catalogue or font, glyph identifier and relevant evidence. Preserve the version of the outline when measuring geometry. |

Use a feature consistently across families. An axis can carry a `unit`, a `witness` and an `examples` map from each value to a documented form ID. Both axes of 率 have paired examples that hold the other axis constant. For example, `count` can distinguish one dot from two, `continuity` can distinguish a joined horizontal from a divided one, and `direction` can distinguish the direction of a stroke. For a difference in a gap or angle, cite the glyph and face, identify the two strokes, and specify the unit, reference points and scale. A missing observation stays absent from `traits`. A query such as `registry.match(grassFamily.id, { crossbar: 'divided' })` returns witnessed spellings that meet the stated condition.

A spelling can be a registered sequence, an explicit IDS, or a component such as `&GW-u58ec-t;`. An independently catalogued drawing can use a stable entity in the publisher's own namespace with a host-supplied outline. This also represents a visible difference for which the stroke analysis is incomplete. To reproduce such a drawing elsewhere, carry its catalogue, outline and attribution with the text. [Host outlines](../../js/README.md#outlines-of-the-hosts-own)

## Import published sources

`ivdFamilies(text, edition)` reads `IVD_Sequences.txt`. Pass `ivdCollections(collectionsText)` as the third argument to include the published identifier pattern and URL for each collection. Each base and selector keeps **all** its collection and glyph identifiers. U+7387 U+E0102, for example, is registered as Hanyo-Denshi JA4608 and Moji_Joho MJ017116. Registration identifies the glyph collection's constraints and supplies no automatic decomposition. [Unicode, UTS #37](https://www.unicode.org/reports/tr37/) · [Unicode, IVD sequences, 2026-08-03](https://www.unicode.org/ivd/data/2026-08-03/IVD_Sequences.txt)

`ucvFamilies(catalogue)` preserves the ordered glyph witnesses, group, criteria, notes and exceptions for each UCV and NUCV entry. The imported criteria are evidence records. Applying an individual witness as a deliberate component replacement requires the explicit `asReplacement` option. A glyph name whose drawing cannot be written exactly as Unicode text becomes a GlyphWiki entity. Use the criterion to examine its stated context before applying it to a different character. [IRG, Working Document Series](https://www.unicode.org/irg/IWDS.html) · [IRG, N2978 source XML](https://github.com/yi-bai/iwds/blob/8302302d615ff1c1f60ae335b118b10060be0ed4/iwds.xml)

From the repository root, these commands import and check the pinned editions.

```sh
curl -fLO https://www.unicode.org/ivd/data/2026-08-03/IVD_Sequences.txt
curl -fLO https://www.unicode.org/ivd/data/2026-08-03/IVD_Collections.txt
curl -fLO https://raw.githubusercontent.com/yi-bai/iwds/8302302d615ff1c1f60ae335b118b10060be0ed4/iwds.xml
python3 scripts/import_iwds.py iwds.xml --edition N2978 > iwds.json
bun js/scripts/data.mjs
bun js/scripts/check-variation-catalogues.mjs IVD_Sequences.txt 2026-08-03 iwds.json IVD_Collections.txt
```

The check covers 39,509 registrations for 29,642 distinct IVSes and 1,663 source glyph positions in 599 UCV and 14 NUCV entries. These counts measure import coverage. Component-level analyses are curated separately.
