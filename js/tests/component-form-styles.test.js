import { expect, it } from 'bun:test'
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
    filesOf: keys => { requests.push(...keys); return [] },
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
