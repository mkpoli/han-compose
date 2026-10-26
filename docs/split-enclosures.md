# Split enclosure layouts

These rules retain the entered two-part IDS and use the expanded structure only for rendering. Encoded glyphs and existing whole-component instances are resolved before a rule runs.

`X` denotes the enclosed operand, including a nested description or an editor placeholder.

| Input | Rendering layout | Example |
| --- | --- | --- |
| ⿴行X | ⿲彳X亍 | 衍: 氵; 衎: 干; 衒: 玄 |
| ⿶𩰲X | ⿱⿲弓X弓鬲 | 鬻: 米 |
| ⿹𣪊X | ⿰⿱⿳士冖一X殳 | 殼: 几 |
| ⿸𭤨X | ⿰方⿱𠂉X | 旗: 其; 族: 矢; 旃: 丹 |
| ⿴衣X | ⿳亠X𧘇 | 裹: 果; 褒: 保; 袤: 矛 |
| ⿴弜X | ⿲弓X弓 | 粥: 米 |
| ⿴玨X | ⿲𤣩X王 | 斑: 文 |
| ⿴辡X | ⿲辛X辛 | 辯: 言; 辮: 糸 |
| ⿴雔X | ⿲隹X隹 | 讎: 言 |

The bundled BabelStone IDS snapshot supplies the outer decompositions and the expanded example structures. The input forms are rendering conventions inferred from those structures, except where the snapshot explicitly records an alternative: for example, 旗 has both `⿰方⿱𠂉其` and `⿸𭤨其`. The snapshot contains 122 descriptions beginning with `⿸𭤨`.

`𭤨` is `⿰方𠂉`; `㫃` is `⿰方人`. They are distinct, so this rule does not alias them. Regional forms can differ: the 殼 rule follows the snapshot's G decomposition, which includes 一.

Candidates requiring further geometry checks include `⿴𨺅X` (mirrored 阜 components) and `⿶𤕰X` (鼎). Ordinary connected enclosures such as 門, 疒 and 戊 are not rewritten simply because they have decompositions.

## Sources

- `data/vocab/han-ids.tsv`: bundled BabelStone IDS data, records for the components and examples above. Regional labels describe the source forms; X labels alternative analyses.
- Report by @zoenshiueh_lieu, 2026-10-26, the 行 enclosure problem and the preferred forms `⿶𩰲米` and `⿹𣪊几`.
