# Split enclosure layouts

The composer rewrites a two-part enclosure whose enclosing part a character spells with other strokes (⿴行, ⿹頃, ⿸倝) into the arrangement those characters use, and lays the entered operand out inside it. Encoded glyphs and whole-component instances are resolved before a rule runs.

`X` denotes the enclosed operand: a component, a nested description, or an empty slot (⬚).

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
| ⿸攸X | ⿲亻丨⿱攵X | 翛: 羽; 絛: 糸 (HTJKP forms) |
| ⿸𪧇X | ⿱宀⿰爿X | 寎: 丙; 㝥: 米; 寱: 臬 |
| ⿸朕X | ⿰月⿱关X | Requested layout; 氺 is placed below 关 |

The BabelStone IDS table (`data/vocab/han-ids.tsv`) supplies the outer decompositions and the expanded example structures. The input forms are rendering conventions inferred from those structures, except where the table records an alternative: for example, 旗 has both `⿰方⿱𠂉其` and `⿸𭤨其`. The table holds 122 descriptions beginning with `⿸𭤨`.

`𭤨` is `⿰方𠂉`; `㫃` is `⿰方人`. They are distinct, so this rule does not alias them. Regional forms can differ: the 殼 rule follows the table's G decomposition, which includes 一.

`⿴⿰𨸏⿾𨸏X` uses the same layout as `⿴𨺅X`; a separated drawing keeps the two explicit outer leaves as written. The mirrored half is drawn by reflecting the glyph's contours. `⿸倝X` uses the 人 component's upper form 𠆢, as the recorded examples do.

The four hosts 須, 攸, 𪧇 and 朕 also accept their exact expanded spellings:
`⿰彡頁`, `⿲亻丨攵`, `⿱宀爿` and `⿰月关`. These rules preserve the entered
leaves. Their rendering trees are expanded before glyph lookup and before a parent's layout
features are computed, so `⿸攸羽` uses the same native 翛 glyph as its expanded
form when that glyph is available. A separated drawing keeps each source leaf's identity.
These rules do not replace 关 with 龹 or identify `⿸朕氺` with 滕. The table
describes 滕 as `⿰月𣳾`; the requested 朕 rule is a layout convention.

`⿶𤕰X` (鼎) remains a candidate requiring further geometry checks. Ordinary connected enclosures such as 門, 疒 and 戊 are not rewritten simply because they have decompositions.

Fully expanded 2×2 grids of 口, 火, 又, 水 and 屮 are normalized before glyph and host lookup, so both spellings draw alike. For example, `⿰⿱口口⿱口口` is laid out as `⿱⿰口口⿰口口`. Either spelling can be the outer operand of `⿴`; its middle operand is placed between the two rows. A separated drawing keeps the leaves in the order they were written. Other repeated components are unchanged. Pyramids extend the same reading: rows of 1, 2, 3… of one component are laid out as equal square cells, whether the rows and their components are grouped with `⿰`/`⿲` or `⿱`/`⿳`.

The literal host `⿲彳⿱山一攵` supports the requested bottom opening:
`⿵⿲彳⿱山一攵X` renders as `⿲彳⿱⿱山一X攵`. The inserted operand sits
below 一 and between 彳 and 攵. This is a manually specified composition
convention; the exact host has no occurrences in the IDS table. Other
operators and similar hosts do not use this rule.

## Sources

- BabelStone IDS, Andrew West (魏安), <https://www.babelstone.co.uk/CJK/IDS.TXT>, File Date 2025-06-27 (public domain): the records for the components and examples above. Regional labels describe the source forms; X labels alternative analyses.
- @zoenshiueh_lieu, report of 2026-10-26 on the 行 enclosure and the preferred forms `⿶𩰲米` and `⿹𣪊几` (X/Twitter).
