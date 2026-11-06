import { expect, it } from 'bun:test'
import { bundledSource } from '../src/bundled.js'
import { componentDrawing, componentParts } from '../src/component-forms.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { onlyBundled } from '../src/local.js'
import { raster } from '../src/geometry.js'
import { groupParts } from '../src/group-parts.js'
import { files } from './fixtures/small-export.js'

const middle = '⿰丨⿴⿻冂一一', bottom = '⿹𠃌灬'
const full = `⿳宀${middle}${bottom}`, body = `⿱${middle}${bottom}`, binary = `⿱宀${body}`
const local = () => bundledSource({ load: async () => ({ records: {} }), matches: () => false })
const remote = () => createSource(async name => {
  const file = files[name]
  return file ? typeof file === 'string' ? new TextEncoder().encode(file).buffer : Uint8Array.from(file).buffer : null
})

function components(mask, size) {
  const remaining = mask.slice()
  let count = 0
  for (let start = 0; start < remaining.length; start++) {
    if (!remaining[start]) continue
    count++
    const queue = [start]
    remaining[start] = 0
    while (queue.length) {
      const i = queue.pop(), x = i % size
      for (const next of [x ? i - 1 : -1, x < size - 1 ? i + 1 : -1, i - size, i + size]) {
        if (next < 0 || next >= remaining.length || !remaining[next]) continue
        remaining[next] = 0
        queue.push(next)
      }
    }
  }
  return count
}

for (const fontStyle of ['sans', 'serif', 'kaisho']) {
  it(`draws JYN00003 and its connected body offline in ${fontStyle}`, async () => {
    for (const [text, leaves] of [[full, 7], [binary, 7], [body, 6]]) {
      expect(onlyBundled(text, false, false, fontStyle)).toBe(true)
      const drawn = await compose(local(), text, { fontStyle })
      expect(drawn.parts).toHaveLength(leaves)
      expect(drawn.origins.every(origin => origin.includes('JYN00003 editorial'))).toBe(true)
      expect(drawn.d).not.toMatch(/NaN|Infinity/)
      expect(drawn.d).toBe(componentDrawing(text, fontStyle).d)
      expect(drawn.cut).toBe('')
      const separated = await compose(local(), text, { fontStyle, separate: true })
      expect(separated.d).toBe(drawn.d)
      const boxes = await sketch(local(), text, { fontStyle })
      expect(groupParts(separated.parts, boxes)).toHaveLength(leaves)
    }
    expect(componentDrawing(full, fontStyle).d).toBe(componentDrawing(binary, fontStyle).d)
  })

  it(`connects the middle and hook while keeping four detached dots in ${fontStyle}`, () => {
    const parts = componentParts(body, undefined, fontStyle)
    expect(parts).toHaveLength(6)
    const dots = parts.at(-1)
    expect(dots.part.contours).toHaveLength(4)
    expect(components(raster([dots], 512), 512)).toBe(4)
    const frame = raster(parts.slice(0, -1), 512)
    expect(components(frame, 512)).toBe(1)
    // 冂 top, inner 一, closing 一 and 𠃌 crossbar are four distinct strokes.
    // Count ink runs through the counter centres, excluding dots and hook tip.
    for (const x of [580, 600, 620]) {
      let runs = 0, previous = 0, gap = 0
      const openings = []
      for (let row = Math.floor((880 - 680) * .512); row < (880 - 180) * .512; row++) {
        const ink = frame[row * 512 + Math.floor(x * .512)]
        if (ink && !previous) {
          if (runs) openings.push(gap)
          runs++
          gap = 0
        }
        if (!ink && runs) gap++
        previous = ink
      }
      expect(runs).toBe(4)
      expect(openings).toHaveLength(3)
      expect(Math.max(...openings) - Math.min(...openings)).toBeLessThanOrEqual(2)
    }
    expect(components(frame.map(pixel => pixel ? 0 : 1), 512)).toBe(4) // outside + three counters; both frame legs reach the hook
    expect(components(raster(parts, 512), 512)).toBe(5)
    // The hook turns left locally; it must never become a full-width bottom bar.
    const [stem, enclosure, baseline, middleBar, hook] = parts
    expect(enclosure.source[2] - stem.source[0]).toBeGreaterThan(440)
    if (fontStyle === 'kaisho') expect(components(raster([stem, hook], 512), 512)).toBe(1) // foot joins the hook
    expect(stem.source[2] - stem.source[0]).toBeLessThan(55)
    expect(baseline.source[3]).toBeLessThan(middleBar.source[1])
    expect(baseline.source[0]).toBeGreaterThan(stem.source[2]) // no bar across the left gap
    const lowerHookX = hook.part.contours.flatMap(contour => {
      const points = Array.from(contour.light), xs = []
      for (let i = 0; i < points.length; i += 2)
        if (points[i + 1] < (hook.source[1] + baseline.source[1]) / 2) xs.push(points[i])
      return xs
    })
    expect(lowerHookX.length).toBeGreaterThan(0)
    expect(Math.min(...lowerHookX)).toBeGreaterThan(stem.source[2])
    expect(hook.source[1]).toBeLessThan(baseline.source[1])
    expect(dots.source[3]).toBeLessThan(baseline.source[1])
  })

  it(`preserves contextual outlines under other components in ${fontStyle}`, async () => {
    for (const [text, part, leaves] of [[`⿰木${full}`, full, 7], [`⿱木${body}`, body, 6]]) {
      const drawn = await compose(remote(), text, { fontStyle })
      expect(drawn.origins.filter(origin => origin.includes(part))).toHaveLength(leaves)
      expect(drawn.d).not.toMatch(/NaN|Infinity/)
    }
  })
}

it('matches native Kaisho upright weight and a restrained frame slant', () => {
  const [upright, frame, lower, upper] = componentParts(body, undefined, 'kaisho')
  const uprightMask = raster([upright], 1000), frameMask = raster([frame], 1000)
  const runsAt = (mask, y) => {
    const runs = []
    let start = -1
    for (let x = 0; x <= 1000; x++) {
      const ink = x < 1000 && mask[(880 - y) * 1000 + x]
      if (ink && start < 0) start = x
      if (!ink && start >= 0) { runs.push([start, x]); start = -1 }
    }
    return runs
  }
  for (const y of [400, 450, 550]) {
    const stems = runsAt(frameMask, y), [left] = runsAt(uprightMask, y)
    expect(stems).toHaveLength(2)
    const width = left[1] - left[0]
    for (const [a, b] of stems) {
      expect(b - a).toBeGreaterThanOrEqual(width * .85)
      expect(b - a).toBeLessThanOrEqual(width * 1.2)
    }
  }
  const low = runsAt(frameMask, 400)[1], high = runsAt(frameMask, 550)[1]
  expect(high[1] - low[1]).toBeGreaterThan(0)
  expect(high[1] - low[1]).toBeLessThanOrEqual(7)
  for (const bar of [lower, upper]) {
    const mask = raster([bar], 1000)
    let ink = 0
    for (let row = 0; row < 1000; row++) ink += mask[row * 1000 + 600]
    expect(ink).toBeGreaterThanOrEqual(35)
    expect(ink).toBeLessThanOrEqual(44)
  }
})

it('seats the Kaisho feet inside the hook bar and keeps native dot scale', () => {
  const [stem, frame, , , hook, dots] = componentParts(body, undefined, 'kaisho')
  const runsAt = (part, x) => {
    const mask = raster([part], 1000), runs = []
    let start = -1
    for (let y = 1000; y >= 0; y--) {
      const ink = mask[(880 - y) * 1000 + x]
      if (ink && start < 0) start = y
      if (!ink && start >= 0) { runs.push([start, y + 1]); start = -1 }
    }
    return runs
  }
  for (const [part, x] of [[stem, 290], [frame, 430], [frame, 700]]) {
    const foot = runsAt(part, x).at(-1), bar = runsAt(hook, x)[0]
    expect(foot[1]).toBeGreaterThanOrEqual(bar[1] - 2)
    expect(foot[1]).toBeLessThanOrEqual(bar[0] + 2)
  }
  const roof = componentParts(full, undefined, 'kaisho')[0]
  const roofBottom = runsAt(roof, 290)[0][1]
  expect(runsAt(stem, 290)[0][0]).toBeLessThanOrEqual(roofBottom - 10)
  expect(hook.source[1]).toBeLessThan(-60) // native 寫 depth, not the high cut
  const boxes = dots.part.contours.map(contour => {
    const xs = [], ys = []
    for (let i = 0; i < contour.light.length; i += 2) { xs.push(contour.light[i]); ys.push(contour.light[i + 1]) }
    return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
  })
  expect(boxes).toHaveLength(4)
  const targets = [[655, 125], [538.5, 105], [409.5, 85], [252, 65]]
  for (const [i, box] of boxes.entries()) {
    expect(Math.hypot(box.cx - targets[i][0], box.cy - targets[i][1])).toBeLessThan(3)
    expect(Math.min(box.w, box.h)).toBeGreaterThan(75)
  }
})

it('uses distinct font-derived faces', async () => {
  expect(new Set(['sans', 'serif', 'kaisho'].map(style => componentDrawing(full, style).d)).size).toBe(3)
})
