// @ts-nocheck
import { cutContours, derived, mapped, partInk, partOf, placed } from './geometry.js'
import { hexOf } from './sha256.js'

// Zhuque Fangsong 0.212 (TrionesType, OFL 1.1) has the operands but lacks the
// five measure characters. The encoded Beijing ZhongYi FangSong glyphs guide
// the horizontal placements. CWTeX Q Fangsong's 瓩 is a second comparison.
// The same 甅 frame encloses every filling. The hosts supply naturally tall
// right-hand forms; their contour labels separate the left and right operands.
const frameBox = [-8.14, -103.52, 1000.56, 744]
const forms = {
  千: { host: '仟', left: '亻', inner: [473, 27, 1000, 799] },
  厘: { host: '糎', left: '米', inner: [380, 48, 929, 784] },
  十: { host: '叶', left: '口', inner: [514, 13, 1000, 802] },
  屯: { host: '沌', left: '氵', inner: [384, 36, 924, 807] },
  百: { host: '栢', left: '木', inner: [450, 43, 969, 789] },
}

export function tileHost(inner) {
  return typeof inner === 'string' && Object.hasOwn(forms, inner) ? forms[inner].host : null
}

const em = [0, -120, 1000, 880]
const tileOutline = '16791b5addd333e64387ae6f95168245dd222cdad74afb50200f9dc006e285c8'

function tileForm(node, style) {
  return style === 'fangsong' && Array.isArray(node) && !node.note && node[0] === '⿺' &&
    node[1] === '瓦' && tileHost(node[2]) ? forms[node[2]] : null
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
      // Shorten the exposed roof and bring the inner upright toward the filling.
      // The two ends of the low sweep blend back into the stationary hook tip.
      if (contour === 0 && i >= 2 * 27 && i <= 2 * 45) {
        // Translate the terminal at its original width; shorten the shaft before it.
        result[i] -= 72 * Math.max(0, Math.min(1, (x - 504) / (777 - 504)))
      }
      if (contour === 0 && i >= 2 * 58 && i <= 2 * 118) {
        const shoulder = Math.max(0, Math.min(1, (x - 395) / (568 - 395)))
        const foot = Math.max(0, Math.min(1, (848 - x) / (848 - 640)))
        result[i] += 9 * shoulder * foot
      }
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

function contextualFilling(composer, form, inner) {
  if ([form.host, form.left].some(ch => composer.excluded(ch) || composer.forced?.(ch))) return null
  const host = composer.glyphRecord(form.host)
  if (host?.v !== 1 || host.f || host.k) return null
  const right = host.ls?.[inner], left = host.ls?.[form.left]
  if (!Array.isArray(right) || !Array.isArray(left) || !right.length || !left.length) return null
  const indices = [...left, ...right]
  if (indices.length !== host.p.length || new Set(indices).size !== indices.length ||
      !indices.every(i => Number.isInteger(i) && i >= 0 && i < host.p.length)) return null
  return cutContours(partOf(host), right)
}

export function tileParts(composer, node, region) {
  const form = tileForm(node, composer.fontStyle)
  if (!form) return null
  const [, outer, inner] = node
  if (composer.excluded(outer) || composer.excluded(inner)) return null
  const frame = composer.glyphRecord(outer), filling = composer.glyphRecord(inner)
  if (frame?.v !== 1 || filling?.v !== 1 || hexOf(JSON.stringify(frame.p)) !== tileOutline) return null
  const place = (part, box, origin) => ({
    ...placed(part, part.box, mapped(box, em, region), partInk(part), origin), fixed: true,
  })
  const contextual = contextualFilling(composer, form, inner)
  return [
    place(framePart(partOf(frame)), frameBox, 'glyph 瓦'),
    place(contextual ?? partOf(filling), form.inner, contextual ? `${inner} from ${form.host}` : `glyph ${inner}`),
  ]
}
