# Pyramid glyph catalog


`src/han_compose/pyramid-glyphs.json` contains all 146 one-over-two repeated-component
characters found in BabelStone IDS, 2025-06-27 (Unicode 16.0) (147 attested descriptions).
Run `python3 scripts/build_pyramid_glyphs.py --source path/to/babelstone-ids.tsv.gz` to regenerate it, or add `--check`
to verify it. The generator accepts an explicit lower pair or an encoded pair
such as 林 in 森 and 𱋁 in 麤. Only the positional equivalents 牜/牛 and 釒/金
are folded, retaining 犇 and 鑫. Approximate IDS are excluded.

Each entry records its character, repeated part, source description and lower
pair. The composer recognizes the source description, its expanded pair, and
its three equal full components. Missing or excluded glyphs retain component
composition. This catalog covers the pinned Unicode 16.0 source, rather than
claiming coverage of unencoded characters or later Unicode additions.

Source: https://www.babelstone.co.uk/CJK/IDS.TXT (public-domain IDS facts).
The input is a UTF-8 gzip TSV: character, tab, space-separated descriptions
with optional parenthesized regions. Its first comment records the source date
and SHA-256, retained in the generated catalog.
