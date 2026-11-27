// @ts-nocheck
import { derived, fitted, mapped, partInk, partOf, placed, union } from './geometry.js'
import { hexOf } from './sha256.js'

import { tileHost, tileParts } from './fangsong-tile.js'
import { hookParts } from './fangsong-hook-forms.js'

const pairs = { 巴: ['三'], 竜: ['内'], 克: ['千'] }

export function brushSweepRoom(node, style) {
  if (!Array.isArray(node) || node.note || node[0] !== '⿺' || typeof node[1] !== 'string') return false
  if (style === 'pen-writing') return node[1] === '竜' && node[2] === '内'
  if (style !== 'fangsong') return false
  if (node[1] === '瓦') return !!tileHost(node[2])
  return Object.hasOwn(pairs, node[1]) && pairs[node[1]].includes(node[2])
}

// The Pen donor has a single returning contour. Its terminal retains its reach
// when the upper strokes of 竜 are brought to the left of 内.
const penDragon = { digest: '2dd4122d824db3a01264bc18fb72c348ef21aca24744ff214eb19a6764f7a8ce',
  scale: 0.48, left: 53, pivot: 485, tip: 947, contour: 3, range: [41, 75] }

// Keep the main drawing's visible dimensions at the same em after fitting the native hook.
const footprints = {
  'fang-巴': [-0.087361, -0.041941, 1.055552, 1.150514],
  'fang-竜': [-0.105986, -0.009536, 1.029277, 1.095477],
  'fang-克': [-0.074327, 0.006784, 1.065468, 1.106296],
  'pen-竜': [-0.097864, -0.044699, 1.101731, 1.074982],
}

export function brushSweepParts(composer, node, region, nested = false) {
  const parts = drawSweep(composer, node, region)
  if (nested && parts) {
    const bounds = union([region, ...parts.map(part => part.target)])
    for (const part of parts) part.target = mapped(part.target, bounds, region)
  }
  if (parts && node[1] === '瓦') {
    const body = parts[1]
    body.target = fitted(body.source, body.target, 1)
  }
  return parts
}

function drawSweep(composer, node, region) {
  if (!brushSweepRoom(node, composer.fontStyle)) return null
  const [, outer, inner] = node
  if (composer.excluded(outer) || composer.excluded(inner)) return null
  if (outer === '瓦') return tileParts(composer, node, region)
  const fang = composer.fontStyle === 'fangsong'
  const bounds = footprints[(fang ? 'fang-' : 'pen-') + outer]
  region = mapped(bounds, [0, 0, 1, 1], region)
  if (fang) return hookParts(composer, node, region)
  const spec = penDragon, source = composer.glyphRecord(outer)
  const filling = composer.glyph(inner)
  if (!source || !filling || hexOf(JSON.stringify(source.p)) !== spec.digest) return null
  const glyph = partOf(source), [lo, , hi] = glyph.box
  const extra = spec.tip - (spec.left + spec.scale * (hi - lo))
  const narrow = (points, contour) => {
    const dest = points.slice()
    for (let j = 0; j < dest.length; j += 2) {
      const x = points[j], i = j / 2
      dest[j] = spec.left + spec.scale * (x - lo)
      if (contour === spec.contour && i >= spec.range[0] && i <= spec.range[1]) {
        dest[j] += extra * Math.max(0, (x - spec.pivot) / (hi - spec.pivot))
      }
    }
    return dest
  }
  const frame = derived(glyph, glyph.contours.map((c, i) => ({
    ...c, light: narrow(c.light, i), heavy: narrow(c.heavy, i),
  })))
  const place = (part, box, name) => ({ ...placed(part, part.box,
    mapped(box, [0, -120, 1000, 880], region), partInk(part), `glyph ${name}`), fixed: true })
  return [place(frame, frame.box, outer), place(filling, [539, 178, 846, 766], inner)]
}
