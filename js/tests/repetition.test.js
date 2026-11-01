import { expect, it } from 'bun:test'
import { REPETITION, REPETITION_MIRRORED, repetitionDrawing, repetitionParts } from '../src/repetition.js'
import { bundledSource } from '../src/bundled.js'
import { onlyBundled } from '../src/local.js'
import { compose, createSource, sketch } from '../src/loader.js'
import { groupParts } from '../src/group-parts.js'
import { constants, files } from './fixtures/small-export.js'

const local = () => bundledSource({ load: async () => ({ records: {} }), matches: () => false })
const remote = () => createSource(async name => {
  const file = files[name]
  return file ? typeof file === 'string' ? new TextEncoder().encode(file).buffer : Uint8Array.from(file).buffer : null
})

it('draws both spellings as the same four detached strokes without a Han export', async () => {
  const first = await compose(local(), REPETITION)
  const other = await compose(local(), REPETITION_MIRRORED)
  expect(first.d).toBe(other.d)
  expect(first.d).toBe(repetitionDrawing(REPETITION).d)
  expect(first.d.match(/M/g)).toHaveLength(4)
  expect(first.d).not.toMatch(/NaN|Infinity/)
  expect(first.cut).toBe('')
  expect(first.approximate).toEqual([])
  expect(other.approximate).toEqual([])
  expect(first.origins.every(origin => origin === 'four-dot repetition')).toBe(true)
  const parts = repetitionParts(REPETITION)
  expect(parts[0].target[2]).toBeLessThan(parts[1].target[0])
  expect(parts[2].target[3]).toBeLessThan(parts[1].target[1])
})

it('preserves each spelling’s editable leaves and sketch boxes', async () => {
  for (const [text, count] of [[REPETITION, 3], [REPETITION_MIRRORED, 2]]) {
    const source = local()
    const drawn = await compose(source, text, { separate: true })
    const boxes = await sketch(source, text)
    expect(drawn.parts).toHaveLength(count)
    expect(boxes).toHaveLength(count)
    expect(groupParts(drawn.parts, boxes)?.length).toBe(count)
    expect(drawn.parts.map(part => part.box)).toEqual(boxes.map(part => part.box))
  }
})

it('keeps the specialized form in larger descriptions, including under 口', async () => {
  const source = remote()
  for (const wrap of [text => `⿱口${text}`, text => `⿱⿱口${text}木`, text => `⿰木${text}`]) {
    const first = await compose(source, wrap(REPETITION))
    const other = await compose(source, wrap(REPETITION_MIRRORED))
    expect(first.d).toBe(other.d)
    expect(first.origins).toContain('four-dot repetition')
    expect(first.origins).toContain(wrap(REPETITION).includes('口') ? 'glyph 口' : 'glyph 木')
  }
})

it('recognizes only complete specialized subtrees for local rendering', () => {
  expect(onlyBundled(REPETITION)).toBe(true)
  expect(onlyBundled(REPETITION_MIRRORED)).toBe(true)
  expect(onlyBundled(`⿱⬚${REPETITION}`)).toBe(true)
  expect(onlyBundled(`⿱口${REPETITION}`)).toBe(false)
  expect(onlyBundled('⿰⬚⬚')).toBe(false)
  expect(repetitionParts('⿰冫⿱丿⬚')).toBeNull()
  expect(repetitionParts('⿰冫⿱丿')).toBeNull()
})

it('uses distinct native styles without losing alias equivalence', async () => {
  for (const fontStyle of ['sans', 'serif']) {
    const a = await compose(local(), REPETITION, { fontStyle })
    const b = await compose(local(), REPETITION_MIRRORED, { fontStyle })
    expect(a.d).toBe(b.d)
    expect(a.d.match(/M/g)).toHaveLength(4)
    expect(a.d).toBe(repetitionDrawing(REPETITION, fontStyle).d)
  }
  expect(repetitionDrawing(REPETITION, 'sans').d).not.toBe(repetitionDrawing(REPETITION, 'serif').d)
})

it('uses native complete glyphs for the recorded 塁 and 疂 descriptions', async () => {
  for (const bottom of ['土', '冝']) for (const fontStyle of ['sans', 'serif']) {
    const text = `⿳田${REPETITION}${bottom}`
    expect(onlyBundled(text)).toBe(true)
    const a = await compose(local(), text, { fontStyle })
    const b = await compose(local(), `⿳田${REPETITION_MIRRORED}${bottom}`, { fontStyle })
    expect(a.d).toBe(b.d)
    expect(a.parts).toHaveLength(1)
    expect(a.approximate).toEqual([])
  }
})

it('keeps native atomic forms from becoming a single adjustable operand', async () => {
  for (const text of ['⿱宀儿', '⿻三丨', '⿻者丶', `⿳田${REPETITION}土`]) {
    const source = local()
    const drawn = await compose(source, text, { separate: true })
    const boxes = await sketch(source, text)
    expect(boxes.length).toBeGreaterThan(drawn.parts.length)
    expect(groupParts(drawn.parts, boxes)).toBeNull()
  }
})

it('retains three designed groups for the six-stroke component in either style', async () => {
  for (const fontStyle of ['sans', 'serif']) {
    const source = local()
    const drawn = await compose(source, '⿳士冖一', { separate: true, fontStyle })
    const boxes = await sketch(source, '⿳士冖一', { fontStyle })
    expect(drawn.parts).toHaveLength(3)
    expect(groupParts(drawn.parts, boxes)).toHaveLength(3)
    expect(drawn.parts[2].box[2] - drawn.parts[2].box[0]).toBeLessThan(drawn.parts[1].box[2] - drawn.parts[1].box[0])
  }
})


it('keeps designed component strokes at native thickness', async () => {
  const { componentParts } = await import('../src/component-forms.js')
  for (const style of ['sans', 'serif']) {
    const parts = componentParts('⿳士冖一', undefined, style)
    for (const part of parts) {
      expect(part.target).toEqual(part.source)
      expect(part.target[2] - part.target[0]).toBeCloseTo(part.source[2] - part.source[0], 6)
      expect(part.target[3] - part.target[1]).toBeCloseTo(part.source[3] - part.source[1], 6)
    }
    const root = await compose(local(), '⿳士冖一', { fontStyle: style })
    expect(root.parts[2].box[2]).toBeCloseTo(parts[2].source[2] - parts[2].source[0], 1)
  }
})


it('combines the intact 士冖 crown above 一 in both equivalent descriptions', async () => {
  const { componentParts } = await import('../src/component-forms.js')
  for (const fontStyle of ['sans', 'serif']) {
    const crown = componentParts('⿱士冖', undefined, fontStyle)
    const whole = componentParts('⿳士冖一', undefined, fontStyle)
    expect(whole.slice(0, 2).map(p => p.target)).toEqual(crown.map(p => p.target))
    expect(whole[2].target[3]).toBeLessThan(whole[1].target[1])
    const a = await compose(local(), '⿳士冖一', { fontStyle, separate: true })
    const b = await compose(local(), '⿱⿱士冖一', { fontStyle, separate: true })
    expect(a.d).toBe(b.d)
    expect(groupParts(b.parts, await sketch(local(), '⿱⿱士冖一', { fontStyle }))).toHaveLength(3)
  }
})

it('draws the upper component of 興 locally with two editable operands in both styles', async () => {
  for (const fontStyle of ['sans', 'serif']) {
    const source = local()
    expect(onlyBundled('⿴𦥑同')).toBe(true)
    const { componentParts } = await import('../src/component-forms.js')
    if (fontStyle === 'serif') expect(componentParts('⿴𦥑同', undefined, fontStyle)[0].source[2]).toBeLessThanOrEqual(900)
    const drawn = await compose(source, '⿴𦥑同', { fontStyle, separate: true })
    const leaves = await sketch(source, '⿴𦥑同', { fontStyle })
    expect(drawn.parts).toHaveLength(2)
    expect(groupParts(drawn.parts, leaves)).toHaveLength(2)
    expect(drawn.approximate).toEqual([])
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
    const nested = await compose(remote(), '⿱⿴𦥑同木', { fontStyle })
    expect(nested.origins.some(origin => origin.includes('⿴𦥑同'))).toBe(true)
  }
})

it('keeps the four-bar component separated into two adjustable columns', async () => {
  const { componentParts } = await import('../src/component-forms.js')
  for (const fontStyle of ['sans', 'serif']) {
    const parts = componentParts('⿰二二', undefined, fontStyle)
    expect(parts[1].target[0] - parts[0].target[2]).toBeGreaterThan(100)
    const source = local()
    const drawn = await compose(source, '⿰二二', { fontStyle, separate: true })
    expect(drawn.d.match(/M/g)).toHaveLength(4)
    expect(groupParts(drawn.parts, await sketch(source, '⿰二二', { fontStyle }))).toHaveLength(2)
  }
})

it('renders the connected-stroke upper part of 卑 without its bottom 十', async () => {
  const { componentParts, componentDrawing } = await import('../src/component-forms.js')
  for (const fontStyle of ['sans', 'serif']) {
    const source = local(), text = '⿱㇒⿻日丿'
    expect(onlyBundled(text)).toBe(true)
    const parts = componentParts(text, undefined, fontStyle)
    expect(parts).toHaveLength(1)
    expect(parts[0].source[1]).toBeGreaterThanOrEqual(170)
    expect(parts[0].source[0]).toBeGreaterThan(100)
    expect(parts[0].target).toEqual(parts[0].source)
    const drawn = await compose(source, text, { fontStyle, separate: true })
    expect(drawn.d).toBe(componentDrawing(text, fontStyle).d)
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
    expect(groupParts(drawn.parts, await sketch(source, text, { fontStyle }))).toBeNull()
  }
})

it('preserves both yan enclosures as distinct native forms without requiring a remote font', async () => {
  const { componentParts, componentDrawing } = await import('../src/component-forms.js')
  for (const fontStyle of ['sans', 'serif']) {
    expect(componentDrawing('⿳亠㐅厂', fontStyle).d).toBe(componentDrawing('⿱文厂', fontStyle).d)
    expect(componentDrawing('⿳亠㐅厂', fontStyle).d).not.toBe(componentDrawing('⿳亠丷厂', fontStyle).d)
    for (const text of ['⿳亠㐅厂', '⿳亠丷厂']) {
      expect(onlyBundled(text)).toBe(true)
      const part = componentParts(text, undefined, fontStyle)[0]
      expect(part.source[1]).toBeLessThan(0) // retain 厂's full descender
      expect(part.target).toEqual(part.source)
      const drawn = await compose(local(), text, { fontStyle, separate: true })
      expect(drawn.d).toBe(componentDrawing(text, fontStyle).d)
      const nested = await compose(remote(), `⿸${text}木`, { fontStyle })
      expect(nested.origins.some(origin => origin.includes(text))).toBe(true)
      expect(nested.d).not.toMatch(/NaN|Infinity/)
    }
  }
})

it('fits native compound enclosures without extrapolating learned whole-glyph boxes', async () => {
  const { collision, Composer } = await import('../src/compose.js')
  const { constants } = await import('./fixtures/small-export.js')
  const predicted = JSON.parse(files['layout.json'])
  // A valid learned prediction for ordinary glyphs, but unsuitable for this
  // compound enclosure: both operands fill the entire em.
  predicted.seeds[0][1] = Buffer.from(new Float32Array([0, 0, 1, 1, 0, 0, 1, 1]).buffer).toString('base64')
  const source = createSource(async name => {
    const file = name === 'layout.json' ? JSON.stringify(predicted) : files[name]
    return file ? typeof file === 'string' ? new TextEncoder().encode(file).buffer : Uint8Array.from(file).buffer : null
  })
  for (const fontStyle of ['sans', 'serif']) {
    const preview = await compose(source, '⿸⿳亠丷厂木', { fontStyle })
    expect(preview.d).toBe((await compose(remote(), '⿸⿳亠丷厂木', { fontStyle })).d)
    const drawn = new Composer(source.store(), { fontStyle }).compose('⿸⿳亠丷厂木')
    expect(collision(drawn.slice(0, 1), drawn.slice(1), constants.face, 256)).toBeLessThan(0.005)
  }
})

it('uses the native traditional whole glyphs, including the 文 alias', async () => {
  const { componentDrawing } = await import('../src/component-forms.js')
  for (const fontStyle of ['sans', 'serif']) for (const inner of ['彡', '生']) {
    const text = `⿸⿳亠㐅厂${inner}`, alias = `⿸⿱文厂${inner}`
    expect(onlyBundled(text)).toBe(true)
    const drawing = await compose(local(), text, { fontStyle })
    expect(drawing.d).toBe(componentDrawing(text, fontStyle).d)
    expect(drawing.d).toBe((await compose(local(), alias, { fontStyle })).d)
    expect(drawing.parts).toHaveLength(1)
    const nested = await compose(remote(), `⿰木${text}`, { fontStyle })
    expect(nested.origins.some(origin => origin.includes(text))).toBe(true)
    const source = remote()
    await compose(source, '木')
    const store = source.store
    source.store = () => {
      const data = store(), rec = data.rec
      return { ...data, rec: key => rec([inner, '亠', '㐅', '厂', '文'].includes(key) ? '木' : key) }
    }
    const excluded = await compose(source, text, { fontStyle, exclude: [inner === '生' ? '產' : '彥'] })
    expect(excluded.origins.some(origin => origin.includes(text))).toBe(false)
    expect(excluded.parts.length).toBeGreaterThan(1)
    if (inner === '生') expect(excluded.origins.some(origin => origin.includes('Noto'))).toBe(false)
    expect(onlyBundled(text, false, false, 'kaisho')).toBe(false)
    expect(onlyBundled(alias, false, true, 'kaisho')).toBe(false)
  }
})

it('keeps a native enclosure at its em placement when filling it with other components', async () => {
  const { componentParts } = await import('../src/component-forms.js')
  const { Composer, collision } = await import('../src/compose.js')
  const { constants } = await import('./fixtures/small-export.js')
  for (const fontStyle of ['sans', 'serif']) for (const outer of ['⿳亠㐅厂', '⿳亠丷厂']) {
    const source = remote()
    await compose(source, `⿸${outer}木`, { fontStyle })
    const drawn = new Composer(source.store(), { fontStyle }).compose(`⿸${outer}木`)
    expect(drawn[0].target).toEqual(componentParts(outer, constants.face, fontStyle, true)[0].target)
    expect(collision(drawn.slice(0, 1), drawn.slice(1), constants.face, 256)).toBeLessThan(0.005)
  }
})

it('maps the opening and native outline from the same frame with a custom export face', async () => {
  const { Composer } = await import('../src/compose.js')
  const { mapped } = await import('../src/geometry.js')
  const source = remote()
  await source.ready()
  const data = source.store(), face = [0, -120, 1000, 900]
  data.manifest = { ...data.manifest, constants: { ...data.manifest.constants, face } }
  const drawn = new Composer(data, { fontStyle: 'sans' }).compose('⿸⿳亠丷厂⬚')
  expect(drawn[1].target).toEqual(mapped([227, -59, 944, 335], constants.face, face))
})

it('keeps 朱 full height and joins 儿 to the enclosure bar in both faces', async () => {
  const { Composer, collision } = await import('../src/compose.js')
  const { constants } = await import('./fixtures/small-export.js')
  for (const fontStyle of ['sans', 'serif']) for (const outer of ['⿳亠㐅厂', '⿳亠丷厂']) {
    const source = remote()
    await compose(source, '木')
    const store = source.store
    source.store = () => {
      const data = store(), rec = data.rec
      return { ...data, rec: key => {
        const record = rec(['朱', '丅'].includes(key) ? '木' : key)
        return key === '木' && record ? { ...record, ink: 8000 } : record
      } }
    }
    const text = `⿰朱⿸${outer}⿱儿丅`
    await compose(source, text, { fontStyle })
    const parts = new Composer(source.store(), { fontStyle }).compose(text)
    const [zhu, enclosure, legs, lower] = parts
    expect(zhu.origin).toBe(`Noto ${fontStyle} 朱:L`)
    expect(legs.origin).toBe(`Noto ${fontStyle} 儿:under-bar`)
    expect(zhu.target[3] - zhu.target[1]).toBeGreaterThan((enclosure.target[3] - enclosure.target[1]) * 0.95)
    const gap = enclosure.target[0] - zhu.target[2]
    expect(gap).toBeLessThan(0)
    expect(collision([zhu], [enclosure], constants.face, 1024)).toBe(0)
    expect(collision([enclosure], [legs], constants.face, 1024)).toBeGreaterThan(0)
    if (!text.endsWith('木')) expect(legs.target[1]).toBeGreaterThan(lower.target[3])
    const complex = `⿰朱⿸${outer}⿱儿⿱木木`
    await compose(source, complex, { fontStyle })
    const complexParts = new Composer(source.store(), { fontStyle }).compose(complex)
    const complexLegs = complexParts.find(part => part.origin === `Noto ${fontStyle} 儿:under-bar`)
    expect(complexLegs.target[1]).toBeGreaterThan(legs.target[1])
    expect(collision([complexParts[1]], [complexLegs], constants.face, 1024)).toBeGreaterThan(0)
    expect(collision([complexParts[0]], complexParts.slice(1), constants.face, 1024)).toBe(0)
    expect(complexParts.slice(3).every(part => part.weight[1] <= 0)).toBe(true)
  }
})

it('uses matching native stacked 日 proportions for 昌 and ⿱日日 below 儿', async () => {
  const { Composer } = await import('../src/compose.js')
  const { fill, groupRings } = await import('../src/geometry.js')
  for (const fontStyle of ['sans', 'serif']) for (const outer of ['⿳亠㐅厂', '⿳亠丷厂']) {
    const source = remote()
    const a = await compose(source, `⿸${outer}⿱儿昌`, { fontStyle })
    const b = await compose(source, `⿸${outer}⿱儿⿱日日`, { fontStyle })
    expect(a.d).toBe(b.d)
    const stack = a.parts.find(part => part.origin === `Noto ${fontStyle} 昌:stack`)
    expect(stack).toBeDefined()
    expect(stack.box[2]).toBeGreaterThan(500)
    expect(stack.box[3]).toBeGreaterThan(300)
    const placed = new Composer(source.store(), { fontStyle }).compose(`⿸${outer}⿱儿⿱日日`)
      .find(part => part.origin === `Noto ${fontStyle} 昌:stack`)
    // 菖's shorter native 昌 needs substantially less vertical compression
    // than a full-size 昌, keeping its horizontal strokes visible.
    expect((placed.target[3] - placed.target[1]) / (placed.source[3] - placed.source[1])).toBeGreaterThan(0.45)
    const size = 512, mask = fill(groupRings([placed]), size, placed.target)
    const column = Math.floor(size / 2), runs = []
    let start = 0, value = mask[column]
    for (let row = 1; row <= size; row++) {
      const next = row < size ? mask[row * size + column] : 1 - value
      if (next !== value) { runs.push([value, row - start]); start = row; value = next }
    }
    const bars = runs.filter(([ink]) => ink).map(([, height]) => height * (placed.target[3] - placed.target[1]) / size)
    expect(bars).toHaveLength(6)
    expect(runs.filter(([ink]) => !ink).length).toBeGreaterThanOrEqual(5)
    expect(Math.min(...bars)).toBeGreaterThan(fontStyle === 'sans' ? 26 : 15)
    for (const wrap of [text => `⿰朱${text}`, text => `⿰木${text}`, text => `⿱木⿰朱${text}`]) {
      const nestedA = await compose(source, wrap(`⿸${outer}⿱儿昌`), { fontStyle })
      const nestedB = await compose(source, wrap(`⿸${outer}⿱儿⿱日日`), { fontStyle })
      expect(nestedA.d).toBe(nestedB.d)
    }
  }
})

it('falls back to 日 operands when the source 昌 is excluded', async () => {
  const source = remote()
  await compose(source, '木')
  const store = source.store
  source.store = () => {
    const data = store(), rec = data.rec
    return { ...data, rec: key => rec(key === '日' ? '木' : key) }
  }
  for (const fontStyle of ['sans', 'serif']) for (const exclude of ['昌', '菖']) {
    const result = await compose(source, '⿸⿳亠㐅厂⿱儿⿱日日', { fontStyle, exclude: [exclude] })
    expect(result.origins).not.toContain(`Noto ${fontStyle} 昌:stack`)
    expect(result.parts.length).toBeGreaterThan(3)
  }
})

it('keeps the compact 朱 spacing clear of native whole-glyph enclosures', async () => {
  const { Composer, collision } = await import('../src/compose.js')
  const { constants } = await import('./fixtures/small-export.js')
  for (const fontStyle of ['sans', 'serif']) for (const inner of ['彡', '生']) {
    const source = remote(), text = `⿰朱⿸⿳亠㐅厂${inner}`
    await compose(source, text, { fontStyle })
    const parts = new Composer(source.store(), { fontStyle }).compose(text)
    expect(collision([parts[0]], parts.slice(1), constants.face, 1024)).toBe(0)
  }
})

it('keeps the compressed 儿 hook visible without weight jumps between sizes', async () => {
  const { componentPosition, componentPositionBox } = await import('../src/component-forms.js')
  const { fill, groupRings } = await import('../src/geometry.js')
  for (const style of ['sans', 'serif']) {
    const source = componentPositionBox('儿:under-bar', style), height = 120
    const target = [250, 0, 920, height], size = 1024
    const part = componentPosition('儿:under-bar', target, style, height)
    const native = componentPosition('儿:under-bar', target, style)
    for (let i = 0; i < native.part.contours.length; i++)
      expect(part.part.contours[i].light).toEqual(native.part.contours[i].light)
    const mask = fill(groupRings([part]), size, [0, 0, 1000, height])
    const nativeMask = fill(groupRings([native]), size, [0, 0, 1000, height])
    let removed = 0
    for (let i = 0; i < mask.length; i++) removed += nativeMask[i] && !mask[i] ? 1 : 0
    expect(removed).toBe(0)
    const x = 250 + (760 - source[0]) / (source[2] - source[0]) * 670
    const column = Math.floor(x / 1000 * size)
    let ink = 0, nativeInk = 0
    for (let row = 0; row < size; row++) {
      ink += mask[row * size + column]
      nativeInk += nativeMask[row * size + column]
    }
    expect(ink * height / size).toBeGreaterThan(style === 'sans' ? 27 : 18)
    expect(ink).toBeGreaterThan(nativeInk * 1.5)
    const before = componentPosition('儿:under-bar', [250, 0, 920, 180], style, 179.99)
    const after = componentPosition('儿:under-bar', [250, 0, 920, 180], style, 180.01)
    for (let i = 0; i < before.part.contours.length; i++) {
      const a = before.part.contours[i].light, b = after.part.contours[i].light
      expect(Math.max(...a.map((value, j) => Math.abs(value - b[j])))).toBeLessThan(1)
    }
  }
})

it('renders requested native components offline, including the three exact subtraction shapes', async () => {
  const { componentDrawing, componentParts } = await import('../src/component-forms.js')
  for (const fontStyle of ['sans','serif']) {
    for (const text of ['⿻𢆶戈','⿸尸彳','㇯鹿比','㇯馬灬','㇯鳥灬','⿳亠口冖','⿸尸氺','⿳𰀉冖木','⿳卝罒冖']) {
      expect(onlyBundled(text)).toBe(true)
      const drawn = await compose(local(), text, { fontStyle })
      expect(drawn.d).toBe(componentDrawing(text, fontStyle).d)
      expect(drawn.d).not.toMatch(/NaN|Infinity/)
      expect(drawn.cut).toBe('')
      const part = componentParts(text, undefined, fontStyle)[0]
      part.target.forEach((value, i) => expect(value).toBeCloseTo(part.source[i], 8))
    }
    // The native hooks remain; all four isolated 灬 contours are absent.
    expect(componentDrawing('㇯馬灬', fontStyle).d.match(/M/g)).toHaveLength(4)
    expect(componentDrawing('㇯鳥灬', fontStyle).d.match(/M/g)).toHaveLength(3)
    expect(componentParts('㇯鳥灬', undefined, fontStyle)[0].source[1]).toBeLessThan(0)
    const nested = await compose(remote(), '⿹㇯鳥灬木', { fontStyle })
    expect(nested.origins.some(origin => origin.includes('㇯鳥灬'))).toBe(true)
  }
})

it('reports subtraction as approximate when its native form is unavailable or separated', async () => {
  const source = remote()
  await compose(source, '木')
  const store = source.store
  source.store = () => {
    const data = store(), rec = data.rec
    return { ...data, rec: key => rec(['鹿', '比'].includes(key) ? '木' : key) }
  }
  for (const options of [{ fontStyle: 'kaisho' }, { fontStyle: 'sans', separate: true }]) {
    const drawing = await compose(source, '㇯鹿比', options)
    expect(drawing.cut).not.toBe('')
    expect(drawing.approximate).toContain('㇯')
  }
  const native = await compose(source, '㇯鹿比', { fontStyle: 'sans' })
  expect(native.cut).toBe('')
  expect(native.approximate).not.toContain('㇯')
  const fallback = await compose(local(), '㇯鹿比', { fontStyle: 'sans', separate: true })
  expect(fallback.cut).toBe('')
  expect(fallback.approximate).not.toContain('㇯')
})

it('joins the shallow sweep to the hook in both source spellings and preserves two editable strokes', async () => {
  const { componentDrawing, componentParts } = await import('../src/component-forms.js')
  for (const fontStyle of ['sans','serif']) {
    const parts = componentParts('⿱丿乚', undefined, fontStyle)
    expect(parts).toHaveLength(2)
    const [sweep, hook] = parts.map(part => part.source)
    expect(sweep[2] - sweep[0]).toBeGreaterThan(3 * (sweep[3] - sweep[1]))
    expect(hook[3]).toBeGreaterThan(sweep[1])
    expect(hook[3]).toBeLessThan(sweep[3])
    expect(hook[0]).toBeGreaterThan(sweep[0])
    expect(hook[0]).toBeLessThan(sweep[2])
    expect(componentDrawing('⿱丿乚', fontStyle).d).toBe(componentDrawing('⿱㇒乚', fontStyle).d)
    for (const text of ['⿱丿乚','⿱㇒乚']) {
      expect(onlyBundled(text)).toBe(true)
      const drawn = await compose(local(), text, { fontStyle, separate: true })
      expect(drawn.d).toBe(componentDrawing(text, fontStyle).d)
      expect(groupParts(drawn.parts, await sketch(local(), text, { fontStyle }))).toHaveLength(2)
      const nested = await compose(remote(), `⿰木${text}`, { fontStyle })
      expect(nested.origins.filter(origin => origin.includes(text))).toHaveLength(2)
      expect(nested.d).not.toMatch(/NaN|Infinity/)
    }
  }
  expect(componentDrawing('⿱丿乚','kaisho')).toBeNull()
})

it('draws the Gongche three-sweep component locally in both styles with two editable leaves', async () => {
  for (const fontStyle of ['sans', 'serif']) {
    const text = '⿱𰀪亻'
    expect(onlyBundled(text, true)).toBe(true)
    const drawn = await compose(local(), text, { fontStyle, separate: true })
    expect(drawn.d.match(/M/g)).toHaveLength(3)
    expect(drawn.d).not.toMatch(/NaN|Infinity/)
    expect(drawn.approximate).toEqual([])
    expect(groupParts(drawn.parts, await sketch(local(), text, { fontStyle }))).toHaveLength(2)
    const nested = await compose(remote(), `⿰${text}木`, { fontStyle })
    expect(nested.origins.filter(origin => origin.includes(text))).toHaveLength(2)
  }
})

it('repeats identical water-radical outlines without overlap in both styles', async () => {
  const { componentParts } = await import('../src/component-forms.js')
  for (const fontStyle of ['sans', 'serif']) {
    const text = '⿰氵氵'
    const parts = componentParts(text, undefined, fontStyle)
    expect(parts).toHaveLength(2)
    const [a, b] = parts.map(part => part.target)
    expect(a[2]).toBeLessThan(b[0])
    expect(a[2] - a[0]).toBeCloseTo(b[2] - b[0])
    expect(a[1]).toBe(b[1])
    expect(a[3]).toBe(b[3])
    const drawn = await compose(local(), text, { fontStyle, separate: true })
    expect(drawn.approximate).toEqual([])
    expect(groupParts(drawn.parts, await sketch(local(), text, { fontStyle }))).toHaveLength(2)
  }
})

it('joins 儿 to a generic ⿸ enclosure bar, including 厃', async () => {
  const { Composer, collision } = await import('../src/compose.js')
  const { constants } = await import('./fixtures/small-export.js')
  for (const fontStyle of ['sans', 'serif']) for (const text of ['⿸厃⿱儿木', '⿰扌⿸厃⿱儿木', '⿸厃⿱儿⬚']) {
    const source = remote()
    await compose(source, text, { fontStyle })
    const parts = new Composer(source.store(), { fontStyle }).compose(text)
    const outer = parts.find(part => part.origin === 'glyph 厃')
    const form = text.startsWith('⿰') ? '儿:dan' : '儿:zhan'
    const legs = parts.find(part => part.origin === `Noto ${fontStyle} ${form}`)
    expect(outer).toBeDefined()
    expect(legs).toBeDefined()
    if (text.startsWith('⿸')) expect(collision([outer], [legs], constants.face, 512)).toBeGreaterThan(0)
    const lower = parts[parts.indexOf(legs) + 1]
    if (!text.endsWith('木')) expect(legs.target[1]).toBeGreaterThan(lower.target[3])
    expect(parts.some(part => part.origin === 'host 冏')).toBe(false)
  }
})
