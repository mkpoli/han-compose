// @ts-nocheck
import { derived, mapped, partInk, partOf, placed } from './geometry.js'
import { hexOf } from './sha256.js'

// Zhuque Fangsong 0.212 (TrionesType, OFL 1.1) has the operands but lacks the
// five measure characters. The encoded Beijing ZhongYi FangSong glyphs guide
// the relative placements. CWTeX Q Fangsong's 瓩 is a second comparison.
const forms = {
  千: { frame: [-8.59, -96.04, 996.43, 779], inner: [474, 12, 996, 794.62] },
  厘: { frame: [-8.14, -103.52, 1000.56, 744], inner: [419.6, 50.5, 929.6, 769.01] },
  十: { frame: [-11.15, -95.71, 993.75, 763], inner: [514, 4, 991, 795.82] },
  屯: { frame: [-12.16, -94.84, 980.70, 725], inner: [390, 19, 899, 795.16] },
  百: { frame: [-14.95, -86.92, 990.74, 774.73], inner: [493, 43.2, 949.8, 762.5] },
}

const em = [0, -120, 1000, 880]
const tileOutline = '16791b5addd333e64387ae6f95168245dd222cdad74afb50200f9dc006e285c8'

function tileForm(node, style) {
  return style === 'fangsong' && Array.isArray(node) && !node.note && node[0] === '⿺' &&
    node[1] === '瓦' && typeof node[2] === 'string' && Object.hasOwn(forms, node[2]) ? forms[node[2]] : null
}

function framePart(glyph) {
  const [left] = glyph.box
  const scale = 0.51
  // Points 77–111 traverse the low sweep and terminal of the connected
  // contour. Extend the sweep, then translate the terminal at its own width.
  const terminalStart = 848
  const extension = (terminalStart - left) * (1 - scale)
  const reshape = (points, contour) => {
    const result = points.slice()
    for (let i = 0; i < result.length; i += 2) {
      const x = points[i]
      result[i] = left + (x - left) * scale
      if (contour === 0 && i >= 2 * 77 && i <= 2 * 111) {
        const sweepStart = i < 2 * 100 ? 619 : 568
        const progress = Math.min(1, Math.max(0, (x - sweepStart) / (terminalStart - sweepStart)))
        result[i] += extension * progress + Math.max(0, x - terminalStart) * (1 - scale)
      }
    }
    return result
  }
  return derived(glyph, glyph.contours.map((contour, i) => ({
    ...contour, light: reshape(contour.light, i), heavy: reshape(contour.heavy, i),
  })))
}

export function tileParts(composer, node, region) {
  const form = tileForm(node, composer.fontStyle)
  if (!form) return null
  const [, outer, inner] = node
  if (composer.excluded(outer) || composer.excluded(inner)) return null
  const frame = composer.glyphRecord(outer), filling = composer.glyphRecord(inner)
  if (frame?.v !== 1 || filling?.v !== 1 || hexOf(JSON.stringify(frame.p)) !== tileOutline) return null
  const place = (part, box, char) => ({
    ...placed(part, part.box, mapped(box, em, region), partInk(part), `glyph ${char}`), fixed: true,
  })
  return [place(framePart(partOf(frame)), form.frame, outer), place(partOf(filling), form.inner, inner)]
}
