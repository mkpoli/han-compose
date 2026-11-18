import { describe, expect, it } from 'bun:test'
import embeddedGrass from './fixtures/kai-embedded-grass.json'
import chui from './fixtures/kai-chui.json'
import splitGrass from './fixtures/kai-grass.json'
import data from '../src/component-forms.json'
import { componentDrawing, componentParts, componentRecord, containsComponentForm, containsForcedForm, isComponentForm, isGroupedForm, isForcedCharacter, isNativeForm } from '../src/component-forms.js'
import { Composer } from '../src/compose.js'
import { raster, windingOf } from '../src/geometry.js'
import { onlyBundled } from '../src/local.js'
import { compose, createSource } from '../src/loader.js'
import { character, constants, files, records, shards } from './fixtures/small-export.js'

it('does not use Noto-only forms for Fangsong', () => {
  for (const text of ['⿱丿乚', '⿰氵氵', '㇯馬灬']) {
    expect(isComponentForm(text, 'sans')).toBe(true)
    expect(isComponentForm(text, 'fangsong')).toBe(false)
    expect(onlyBundled(text, false, true, 'fangsong')).toBe(false)
  }
})

it('does not use Noto-only forms for Kaisho capabilities or outlines', () => {
  for (const text of ['⿱丿乚', '⿸⿳亠㐅厂生', '㇯馬灬']) {
    expect(isComponentForm(text, 'sans')).toBe(true)
    expect(isComponentForm(text, 'serif')).toBe(true)
    expect(isComponentForm(text, 'pen-writing')).toBe(false)
    expect(isGroupedForm(text, 'pen-writing')).toBe(false)
    expect(containsComponentForm(`⿰木${text}`, 'pen-writing')).toBe(false)
    expect(componentRecord(text, 'pen-writing')).toBeNull()
    expect(componentParts(text, undefined, 'pen-writing')).toBeNull()
    expect(componentDrawing(text, 'pen-writing')).toBeNull()
    expect(onlyBundled(text, false, false, 'pen-writing')).toBe(false)
  }
})

it('loads the internal operands of a Noto-only form for Kaisho', async () => {
  const requests = []
  const stop = new Error('stop after initial file selection')
  const source = {
    ready: async () => {}, manifest: { constants },
    filesOf: keys => { requests.push(...keys); return [] }, modelFiles: () => [],
    load: async () => { throw stop },
  }
  await expect(compose(source, '⿱木⿱丿乚', { fontStyle: 'pen-writing' })).rejects.toThrow(stop.message)
  expect(requests).toContain('丿')
  expect(requests).toContain('乚')
  requests.length = 0
  await expect(compose(source, '⿱木⿱丿乚', { fontStyle: 'sans' })).rejects.toThrow(stop.message)
  expect(requests).not.toContain('丿')
  expect(requests).not.toContain('乚')
})

it('recognizes only explicit Kaisho forms and credits their native font', () => {
  for (const [text, groups] of Object.entries(data.forms['pen-writing'] ?? {})) {
    expect(isComponentForm(text, 'pen-writing')).toBe(true)
    expect(isGroupedForm(text, 'pen-writing')).toBe(groups.length > 1)
    // A native form leaves an encoded character that holds it to its own glyph.
    expect(containsComponentForm(`⿰木${text}`, 'pen-writing')).toBe(!data.native?.['pen-writing']?.includes(text))
    expect(onlyBundled(text, false, false, 'pen-writing')).toBe(true)
    const parts = componentParts(text, undefined, 'pen-writing')
    expect(parts).toHaveLength(groups.length)
    expect(parts.every(part => part.origin.includes('Kureedo') && part.origin.endsWith(`: ${text}`))).toBe(true)
    expect(componentDrawing(text, 'pen-writing').d).not.toMatch(/NaN|Infinity/)
  }
})

it('draws 萬 with the bottom of 両 as one prepared form', () => {
  for (const style of ['sans', 'serif']) {
    expect(isComponentForm('⿳艹田⿵冂山', style)).toBe(true)
    expect(isGroupedForm('⿳艹田⿵冂山', style)).toBe(true)
    const drawing = componentDrawing('⿳艹田⿵冂山', style)
    expect(drawing.d).not.toMatch(/NaN|Infinity/)
    expect(componentParts('⿳艹田⿵冂山', undefined, style)).toHaveLength(2)
  }
})

describe('the groups of a bundled form', () => {
  // A drawing that keeps one piece per leaf draws each group as a layer of its own. A counter whose
  // outline is in another group fills solid there: 同 in ⿴𦥑同, whose 冂 the font draws in one
  // outline with 𦥑, stood as a black box.
  const area = (/** @type {number[]} */ flat) => { let a = 0; for (let i = 0; i < flat.length; i += 2) { const j = (i + 2) % flat.length; a += flat[i] * flat[j + 1] - flat[j] * flat[i + 1] } return a / 2 }
  const inside = (/** @type {number[]} */ flat, /** @type {number} */ x, /** @type {number} */ y) => {
    let hit = false
    for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
      const xi = flat[i], yi = flat[i + 1], xj = flat[j], yj = flat[j + 1]
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit
    }
    return hit
  }
  // A point inside a counter: the mean of its points. Its first point can lie on the outline's edge.
  // An outline holds a counter when it is the larger of the two and that point is inside it: the
  // point alone is also inside whatever the counter itself holds (口 in the counter of 冂).
  const middle = (/** @type {number[]} */ flat) => {
    let x = 0, y = 0
    for (let i = 0; i < flat.length; i += 2) { x += flat[i]; y += flat[i + 1] }
    return [x / (flat.length / 2), y / (flat.length / 2)]
  }
  for (const [style, forms] of Object.entries(data.forms)) {
    it(`each hold the outline of every counter they hold, in ${style}`, () => {
      const apart = []
      for (const [text, groups] of Object.entries(forms)) {
        if (groups.length < 2) continue
        const rings = groups.map(group => group.map(([, points]) => points))
        // The form's largest contour is an outline: a contour running the other way is a counter.
        const outline = Math.sign(area(rings.flat().reduce((best, flat) => Math.abs(area(flat)) > Math.abs(area(best)) ? flat : best)))
        const alone = rings.every(group => group.filter(flat => Math.sign(area(flat)) !== outline)
          .every(counter => group.some(flat => Math.sign(area(flat)) === outline
            && Math.abs(area(flat)) > Math.abs(area(counter)) && inside(flat, ...middle(counter)))))
        if (!alone) apart.push(text)
      }
      expect(apart).toEqual([])
    })
  }
})

it('draws ⿲𰀪丨⿱丶丶 in Sans from TC’s 眔 and in Fangsong from 鰥, one group per leaf', () => {
  for (const style of ['sans', 'fangsong']) {
    const groups = data.forms[style]['⿲𰀪丨⿱丶丶']
    expect(groups).toHaveLength(4)
    for (const group of groups.slice(1)) expect(group).toHaveLength(1)
    expect(new Set(groups.map(group => windingOf(group.map(([, points]) => points)))).size).toBe(1)
    const [left, stem, upper, lower] = componentParts('⿲𰀪丨⿱丶丶', undefined, style, false).map(part => part.target)
    expect((left[0] + left[2]) / 2).toBeLessThan(stem[0])
    expect(upper[0]).toBeGreaterThan(stem[2])
    expect(upper[1]).toBeGreaterThan(lower[1])
  }
  // Serif composes it, and Kaisho cuts it from its export's 眔.
  expect(isComponentForm('⿲𰀪丨⿱丶丶', 'serif')).toBe(false)
  expect(isComponentForm('⿲𰀪丨⿱丶丶', 'pen-writing')).toBe(false)
})

it('leaves the characters holding 眔’s lower half to their own glyphs', () => {
  for (const style of ['sans', 'fangsong']) {
    expect(isNativeForm('⿲𰀪丨⿱丶丶', style)).toBe(true)
    expect(containsComponentForm('⿰魚⿱罒⿲𰀪丨⿱丶丶', style)).toBe(false)
  }
  expect(containsComponentForm('⿰木⿰氵氵', 'sans')).toBe(true)
  // The layout reads what the export records of the description, and the form's own where it has none.
  const known = { P: ['B'], ink: 7523 }
  const composer = rec => new Composer({ manifest: { constants, spelled: [] }, layout: null, rec, hosts: () => [], places: () => [] })
  expect(composer(key => key === '⿲𰀪丨⿱丶丶' ? known : null).rec('⿲𰀪丨⿱丶丶')).toBe(known)
  expect(composer(() => null).rec('⿲𰀪丨⿱丶丶')).toEqual(componentRecord('⿲𰀪丨⿱丶丶', 'sans'))
  // Its ink and outline count, which size its neighbours, are what they are without the form: here
  // the four leaves', each unknown to this store.
  const exported = composer(key => key === '⿲𰀪丨⿱丶丶' ? known : null), node = exported.parse('⿲𰀪丨⿱丶丶')
  expect(exported.ink(node)).toBe(4000)
  expect(exported.outlines(node)).toBe(0)
  expect(exported.identity('⿲𰀪丨⿱丶丶')).toBe(known)
})

// Cut from TW-Kai's 艺: the connected 艹 its simplified characters write, while its traditional
// characters write two 十. The form draws; the export's split 艹 record still lays it out.
it('draws 艹 connected in Regular Kai as a drawing-only form', () => {
  expect(isComponentForm('艹', 'regular')).toBe(true)
  // The form is a drawing only: the layout still reads the split 艹 record the export carries.
  expect(isNativeForm('艹', 'regular')).toBe(true)
  // A native form leaves the layout the export's own record: the split 艹's ink and outline count.
  const record = { ink: 2729.9, o: 2 }
  const composer = new Composer({ manifest: { constants, spelled: [] }, layout: null,
    rec: key => key === '艹' ? record : null, hosts: () => [], places: () => [] }, { fontStyle: 'regular' })
  expect(composer.rec('艹')).toBe(record)
  const parts = componentParts('艹', undefined, 'regular')
  expect(parts).toHaveLength(1)
  expect(parts[0].part.contours).toHaveLength(1)
  expect(parts[0].origin).toBe('TW-Kai: 艹')
  for (const style of ['sans', 'serif', 'fangsong', 'pen-writing']) expect(isComponentForm('艹', style)).toBe(false)
})

it('draws a stacked operand from its form before a host cut', async () => {
  const grass = character('艹', [[100, 620, 480, 800], [520, 620, 900, 800]])
  const half = character('半', [[100, 0, 900, 520]])
  const input = { ...files, ...shards('g', Object.entries({ ...records, 艹: grass, 半: half })) }
  const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
  const drawn = await compose(source, '⿱艹半', { fontStyle: 'regular' })
  expect(drawn.parts.some(part => part.origin === 'TW-Kai: 艹')).toBe(true)
})

it('still draws the split 十十 spelling in every face', async () => {
  const ten = character('十', [[100, 0, 480, 800], [520, 0, 900, 800]])
  const input = { ...files, ...shards('g', Object.entries({ ...records, 十: ten })) }
  const source = () => createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
  for (const fontStyle of ['sans', 'serif', 'regular', 'fangsong', 'pen-writing']) {
    const drawn = await compose(source(), '⿰十十', { fontStyle })
    expect(drawn.parts).toHaveLength(2)
    expect(drawn.parts.every(part => part.origin === 'glyph 十')).toBe(true)
  }
})

it('forces the 艹 form on every face and every encoded character that names it', () => {
  expect(containsForcedForm('⿱艹采', 'regular')).toBe(true)
  for (const style of ['sans', 'serif', 'fangsong', 'pen-writing']) {
    expect(containsForcedForm('⿱艹采', style)).toBe(false)
    expect(containsForcedForm('華', style)).toBe(false)
  }
  const records = { 菜: { s: '⿱艹采' }, 敬: { s: '⿰苟攵' }, 苟: { s: '⿱艹句' } }
  const composer = new Composer({ manifest: { constants, spelled: [] }, layout: null,
    rec: key => records[key] ?? null, hosts: () => [], places: () => [] }, { fontStyle: 'regular' })
  expect(composer.forced('菜')).toBe(true)
  expect(composer.forced('木')).toBe(false)
  expect(isForcedCharacter('華', 'regular')).toBe(true)
  expect(isForcedCharacter('茰', 'regular')).toBe(true)
})

it('redraws an encoded 菜 from its IDS with the form', async () => {
  const grass = character('艹', [[100, 620, 480, 800], [520, 620, 900, 800]])
  const cai = character('采', [[100, 0, 900, 520]])
  const char = { ...character('菜', [[100, 620, 480, 800], [520, 620, 900, 800], [100, 0, 900, 520]]), s: '⿱艹采' }
  char.G.p = [...splitGrass, char.G.p.at(-1)]
  const input = { ...files, ...shards('g', Object.entries({ ...records, 艹: grass, 采: cai, 菜: char })) }
  const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
  const drawn = await compose(source, '菜', { fontStyle: 'regular' })
  expect(drawn.origins.filter(origin => origin === 'TW-Kai: 艹')).toHaveLength(1)
  expect(drawn.origins).toContain('glyph 菜 kept')
})

it('uses the form in a three-band stack', async () => {
  const grass = character('艹', [[100, 620, 480, 800], [520, 620, 900, 800]])
  const mouth = character('口', [[100, 0, 900, 200]])
  const one = character('一', [[100, 0, 900, 100]])
  const char = { ...character('𦴯', [[100, 0, 900, 900]]), s: '⿳艹口一' }
  char.G.p = [...splitGrass, char.G.p.at(-1)]
  const input = { ...files, ...shards('g', Object.entries({ ...records, 艹: grass, 口: mouth, 一: one, 𦴯: char })) }
  const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
  const drawn = await compose(source, '𦴯', { fontStyle: 'regular' })
  expect(drawn.origins).toContain('TW-Kai: 艹')
})

it('keeps a forced terminal glyph with no sequence drawable', async () => {
  const grass = character('艹', [[100, 620, 480, 800], [520, 620, 900, 800]])
  const input = { ...files, ...shards('g', Object.entries({ ...records, 艹: grass })) }
  const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
  const drawn = await compose(source, '艹', { fontStyle: 'sans' })
  expect(drawn.origins).toEqual(['glyph 艹'])
})

it('uses the form under a cover before the child glyph shortcut', async () => {
  const grass = character('艹', [[100, 620, 480, 800], [520, 620, 900, 800]])
  const roof = character('宀', [[100, 700, 900, 800], [100, 0, 180, 800], [820, 0, 900, 800]])
  const gou = { ...character('苟', [[100, 0, 900, 900]]), s: '⿱艹句' }
  const ju = character('句', [[100, 0, 900, 700]])
  gou.G.p = [...splitGrass, gou.G.p.at(-1)]
  const input = { ...files, ...shards('g', Object.entries({ ...records, 艹: grass, 宀: roof, 苟: gou, 句: ju })) }
  const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
  const drawn = await compose(source, '⿱宀苟', { fontStyle: 'regular' })
  expect(drawn.origins).toContain('TW-Kai: 艹')
})

it('retains native contours outside each of two split grass heads', async () => {
  const stack = character('𧁖', [[0, 0, 1000, 880]])
  const lowerHead = splitGrass.map(([ops, light, delta]) => {
    const points = Buffer.from(light, 'base64')
    for (let i = 2; i < points.length; i += 4) points.writeInt16LE(points.readInt16LE(i) - 1200, i)
    return [ops, points.toString('base64'), delta]
  })
  stack.G.p.push(...splitGrass, ...lowerHead)
  stack.s = '⿳艹艹田'
  const input = { ...files, ...shards('g', [['𧁖', stack]]) }
  const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
  const drawing = await compose(source, '𧁖', { fontStyle: 'regular' })
  expect(drawing.parts.filter(p => p.origin === 'TW-Kai: 艹')).toHaveLength(2)
  const kept = drawing.parts.find(p => p.origin === 'glyph 𧁖 kept')
  expect(kept.d.match(/M/g)).toHaveLength(1)
})

it('groups the enclosing 木 under the leaves of each manuscript spelling', () => {
  for (const style of ['sans', 'serif', 'fangsong', 'regular', 'pen-writing']) {
    const expanded = componentParts('⿰氵⿺木罒', undefined, style)
    const contracted = componentParts('⿺沐罒', undefined, style)
    expect(expanded).toHaveLength(3)
    expect(contracted).toHaveLength(2)
    const [short, long] = ['⿺沐罒', '⿰氵⿺木罒'].map(text => componentDrawing(text, style).d)
    const numbers = /-?\d+\.\d+/g
    expect(short.replace(numbers, '')).toBe(long.replace(numbers, ''))
    const coords = long.match(numbers).map(Number)
    // Group placement can round a coordinate on the opposite side of a tenth.
    expect(short.match(numbers).every((v, i) => Math.abs(Number(v) - coords[i]) < 0.101)).toBe(true)
    expect(expanded[1].target[2]).toBeGreaterThan(expanded[2].target[2])
    expect(isComponentForm('⿲氵木罒', style)).toBe(false)
  }
})

it('selects the upper grass in 菙 while retaining both crosses in 垂 in composed and cell layouts', async () => {
  const input = { ...files, ...shards('g', [['菙', { G: chui, s: '⿱艹垂' }]]) }
  const source = createSource(async name => input[name] === undefined ? null : new Uint8Array(Buffer.from(input[name])).buffer)
  for (const layout of ['composed', 'cells']) {
    const drawing = await compose(source, '菙', { fontStyle: 'regular', layout })
    const grass = drawing.parts.find(p => p.origin === 'TW-Kai: 艹')
    expect(grass.box[3]).toBeLessThan(450)
    expect(drawing.parts.find(p => p.origin === 'glyph 菙 kept').d.match(/M/g)).toHaveLength(chui.p.length - 2)
    if (layout === 'cells') expect(drawing.parts.every(p => p.leaf === 0)).toBe(true)
  }
})

it('retains the connected grass when a narrow pair restores the full glyph', () => {
  const composer = new Composer({ manifest: { constants, spelled: [] }, layout: null,
    rec: key => key === '菙' ? { G: chui, s: '⿱艹垂' } : null, hosts: () => [], places: () => [] }, { fontStyle: 'regular' })
  const narrow = composer.node('菙', [0, 0, 40, 100])
  const filled = composer.fillCell('菙', narrow, [0, 0, 250, 900], true)
  expect(filled.map(p => p.origin)).toEqual(['glyph 菙 kept', 'TW-Kai: 艹'])
  expect(filled[0].target[2]).toBeGreaterThan(narrow[0].target[2])
})

it('keeps the intersecting uprights and draws both heads of 𦴐', () => {
  const cases = [
    ['𤀾', '⿰氵⿱业⿻𢆉艹', [8, 9], 1],
    ['𣀱', '⿰⿱米⿻⿱廿艹大攵', [3, 4], 1],
    ['𦴐', '⿳艹⿱一艹天', [3, 4, 6, 7], 2],
    ['𡽼', '⿱山⿰忄⿳亠厶⿻艹木', [], 0],
    ['𡪨', '⿱宀⿻莧厶', [], 0],
  ]
  for (const [ch, sequence, cut, count] of cases) {
    const composer = new Composer({ manifest: { constants, spelled: [] }, layout: null,
      rec: key => key === ch ? { G: embeddedGrass[ch], s: sequence } : null, hosts: () => [], places: () => [] }, { fontStyle: 'regular' })
    const glyph = composer.glyph(ch)
    const native = composer.place(glyph, glyph.box, 0, ch)
    const [body, ...heads] = composer.replaceGlyph(native, ch, composer.parse(sequence))
    expect(heads).toHaveLength(count)
    expect(body.part.contours).toEqual(glyph.contours.filter((_, i) => !cut.includes(i)))
    if (count === 1) {
      const size = 400
      const before = raster([native], size), after = raster([body, ...heads], size)
      const [left, right] = ch === '𤀾' ? [540, 749] : [233, 430]
      let changed = 0, outside = 0
      for (let i = 0; i < before.length; i++) {
        if (before[i] === after[i]) continue
        changed++
        const x = (i % size + 0.5) * 1000 / size
        if (x < left - 2 || x > right + 2) outside++
      }
      expect(changed).toBeGreaterThan(0)
      expect(outside).toBe(0)
    }
  }
})
