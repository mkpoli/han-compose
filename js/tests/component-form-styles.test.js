import { describe, expect, it } from 'bun:test'
import data from '../src/component-forms.json'
import { componentDrawing, componentParts, componentRecord, containsComponentForm, isComponentForm, isGroupedForm } from '../src/component-forms.js'
import { onlyBundled } from '../src/local.js'
import { compose } from '../src/loader.js'
import { constants } from './fixtures/small-export.js'

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
    expect(isComponentForm(text, 'kaisho')).toBe(false)
    expect(isGroupedForm(text, 'kaisho')).toBe(false)
    expect(containsComponentForm(`⿰木${text}`, 'kaisho')).toBe(false)
    expect(componentRecord(text, 'kaisho')).toBeNull()
    expect(componentParts(text, undefined, 'kaisho')).toBeNull()
    expect(componentDrawing(text, 'kaisho')).toBeNull()
    expect(onlyBundled(text, false, false, 'kaisho')).toBe(false)
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
  await expect(compose(source, '⿱木⿱丿乚', { fontStyle: 'kaisho' })).rejects.toThrow(stop.message)
  expect(requests).toContain('丿')
  expect(requests).toContain('乚')
  requests.length = 0
  await expect(compose(source, '⿱木⿱丿乚', { fontStyle: 'sans' })).rejects.toThrow(stop.message)
  expect(requests).not.toContain('丿')
  expect(requests).not.toContain('乚')
})

it('recognizes only explicit Kaisho forms and credits their native font', () => {
  for (const [text, groups] of Object.entries(data.forms.kaisho ?? {})) {
    expect(isComponentForm(text, 'kaisho')).toBe(true)
    expect(isGroupedForm(text, 'kaisho')).toBe(groups.length > 1)
    expect(containsComponentForm(`⿰木${text}`, 'kaisho')).toBe(true)
    expect(onlyBundled(text, false, false, 'kaisho')).toBe(true)
    const parts = componentParts(text, undefined, 'kaisho')
    expect(parts).toHaveLength(groups.length)
    expect(parts.every(part => part.origin.includes('Kureedo') && part.origin.endsWith(`: ${text}`))).toBe(true)
    expect(componentDrawing(text, 'kaisho').d).not.toMatch(/NaN|Infinity/)
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
