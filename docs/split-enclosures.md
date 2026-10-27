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
| ⿴𨺅X | ⿲𨸏X⿾𨸏 | 𨼱: 夬 |
| ⿹頃X | ⿰⿱匕X頁 | 穎: 禾; 潁: 水 |
| ⿴㗊X | ⿳吅X吅 | 器: 犬; 囂: 頁; 嚚: 臣 |
| ⿸倝X | ⿰𠦝⿱𠆢X | 翰: 羽; 斡: 斗; 榦: 木 |
| ⿹須X | ⿰⿱彡X頁 | 頿: 此 |
| ⿸攸X | ⿲亻丨⿱攵X | 翛: 羽; 絛: 糸 (H/T/J/K/P forms) |
| ⿸𪧇X | ⿱宀⿰爿X | 寎: 丙; 㝥: 米 |
| ⿸朕X | ⿰月⿱关X | Requested insertion layout; for example X = 氺 |

The bundled BabelStone IDS snapshot supplies the outer decompositions and the expanded example structures. The input forms are rendering conventions inferred from those structures, except where the snapshot explicitly records an alternative: for example, 旗 has both `⿰方⿱𠂉其` and `⿸𭤨其`. The snapshot contains 122 descriptions beginning with `⿸𭤨`.

`𭤨` is `⿰方𠂉`; `㫃` is `⿰方人`. They are distinct, so this rule does not alias them. Regional forms can differ: the 殼 rule follows the snapshot's G decomposition, which includes 一.

The four hosts 須, 攸, 𪧇 and 朕 also accept their literal spellings `⿰彡頁`, `⿲亻丨攵`, `⿱宀爿` and `⿰月关` under the same enclosure operators. The 朕 rule retains 月 and 关 as requested; it does not identify `⿰月⿱关氺` with an encoded character. The other three placements follow the expanded examples in the table.

`⿴⿰𨸏⿾𨸏X` uses the same layout as `⿴𨺅X`; an editor retains the two explicit outer leaves when that form is entered. The mirrored half is drawn by reflecting the glyph's contours. `⿸倝X` uses the 人 component's upper form 𠆢, as the recorded examples do.

`⿶𤕰X` (鼎) remains a candidate requiring further geometry checks. Ordinary connected enclosures such as 門, 疒 and 戊 are not rewritten simply because they have decompositions.

Fully expanded four-part grids of 口, 火, 又, 水 or 屮 are normalized before glyph/host lookup so both spellings choose the same rendering. For example, `⿰⿱口口⿱口口` is laid out as `⿱⿰口口⿰口口`. Either spelling can be the outer operand of `⿴`; its middle operand is placed between the two rows. An editor retains the original leaf order, including column-first selection for the column-first input. Other grids are unchanged.

## Sources

- `data/vocab/han-ids.tsv`: bundled BabelStone IDS data, records for the components and examples above. Regional labels describe the source forms; X labels alternative analyses.
- Report by @zoenshiueh_lieu, 2026-10-26, the 行 enclosure problem and the preferred forms `⿶𩰲米` and `⿹𣪊几`.
