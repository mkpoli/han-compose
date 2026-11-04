# The browser composer's home

The browser composer was forked from this composer on 2026-10-25 and maintained in ids-input beside
it. The two drifted: this repository writes export format 6 (`web_export.py`, `FORMAT`) and draws
kaisho from Kureedo Full, while the fork read both format 5 and 6 and drew in one style. The rules
for ⿾ ⿿ 〾 ㇯, empty slots, pyramids and repeated grids existed in both languages, and only the Python
copy was tested. The fork has moved back here, as `js/`, and ids-input imports it.

## Division

| Concern | Owner |
|---|---|
| Drawing a sequence: hosts, cuts, layout, weight, guide | this repository, `src/han_compose/compose.py` |
| Rewriting a sequence before drawing (enclosures, transforms, repeated grids, coverage, pyramids, constructs) | this repository, `Composer.compose` |
| The drawing data and its packing | this repository, `src/han_compose/web_export.py` |
| Reading that data, drawing in a Worker, caching | this repository, `js/` (`@han-compose/composer`) |
| Text and tree, empty slots (⬚), Emoji, tokens | `js/`, beside the rules they serve |
| ASCII operator names, editor keys | ids-input, `src/core/aliases.js` and its key handling |
| The outline files drawn without an export | this repository, `data/` |
| The preview component, badges, focus, document layers, export as a file | ids-input, `src/svelte/` and `src/document/` |

- Only `web_export.py` shapes the export. The package reads the one format the export writes; an
  earlier format is a failed load, not a fallback.
- A sequence is the contract between the two. The package parses it with its own `parseDescription`
  into `{ op, parts }` trees. The editor's tree reaches the package only as text, or as the document
  `documentView` reads for a layered preview.
- `⬚` (U+2B1A) is an empty slot, a leaf of the tree rather than an operator: a draft from the editor
  is a sequence this repository parses, and its empty-slot layout is `Composer`'s.
- ids-input reads the package as it is: `src/index.js` for the preview and the drawing files, and its
  own entry points for the rest. Its declarations come from `js/tsconfig.json` (`bun run types`), so
  both packages are checked against the same types.

## Tests here

- The package's own (`js/tests`): loader over a small export, worker protocol, caching, one full
  drawing, Emoji, tokens, documents, and the bundled outlines.
- Parity (`js/tests/parity`): the package draws the sequences `web_export.py` writes with its
  reference drawings, and must agree with them, which keeps the two engines one method.
- Types: `bun run check` in `js/` type-checks the sources the declarations are made from.

ids-input keeps the preview component, the editor's layers and the demo.
