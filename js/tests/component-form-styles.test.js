import { expect, it } from 'bun:test'
import data from '../src/component-forms.json'
import { componentDrawing, componentParts, componentRecord, containsComponentForm, isComponentForm, isGroupedForm, isNativeForm } from '../src/component-forms.js'
import { Composer } from '../src/compose.js'
import { windingOf } from '../src/geometry.js'
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
    // A native form leaves an encoded character that holds it to its own glyph.
    expect(containsComponentForm(`⿰木${text}`, 'kaisho')).toBe(!data.native?.kaisho?.includes(text))
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
  expect(isComponentForm('⿲𰀪丨⿱丶丶', 'kaisho')).toBe(false)
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
})
