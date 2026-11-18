# Grass-head comparison

The gallery compares 246 native TW-Kai glyphs with the composer's connected 艹. The five-face table shows both grass-head forms for 12 characters. Its SVG outlines are embedded, so the completed HTML opens offline.

Run these commands from the repository root with Bun, uv, and the font files listed below. The second command prepares the browser composer's bundled drawing data. The last command reads the pinned TW-Kai export over HTTPS.

```sh
uv run --script scripts/build_grass_comparison.py --fonts cache/fonts --output /tmp/grass-faces.json
(cd js && bun run data)
bun js/examples/grass-gallery/build.mjs /tmp/grass-faces.json grass-gallery.html
```

| Face | Font file |
| --- | --- |
| 黑体 | NotoSansCJKjp-VF-2.004.ttf |
| 宋体 | NotoSerifCJKjp-VF-2.003.ttf |
| 仿宋 | ZhuqueFangsong-v0.212-Regular.ttf |
| 文楷 | KureedoFull-Regular.ttf |

For Noto, the generator fits a pair of split strokes from a Taiwanese glyph into the connected head's space. Wen Kai supplies a split radical at U+2EBF. For Zhuque Fangsong, the generator opens the middle of the native crossbar, including in glyphs where the head shares an outline with the body.

Noto Sans, Noto Serif and Wen Kai Full supply native 茰. The Fangsong version uses its own 更 with the upper horizontal removed. The four fonts lack 𦴯, so each render uses the Taiwanese analysis ⿳艹宂友. Both versions of each character share the same lower drawing.
