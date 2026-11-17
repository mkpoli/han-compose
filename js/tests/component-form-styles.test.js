import { describe, expect, it } from 'bun:test'
import data from '../src/component-forms.json'
import { componentDrawing, componentParts, componentRecord, containsComponentForm, isComponentForm, isGroupedForm, isNativeForm } from '../src/component-forms.js'
import { Composer } from '../src/compose.js'
import { windingOf } from '../src/geometry.js'
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

// Cut from TW-Kai's 荣: the connected 艹 its simplified characters write, while its traditional
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
