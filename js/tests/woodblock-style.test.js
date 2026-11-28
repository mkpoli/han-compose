import { expect, test } from 'bun:test'
import { brushFace, componentRecord, containsComponentForm, ownFormsOnly } from '../src/component-forms.js'

test('woodblock keeps to its own font and is no brush face', () => {
  expect(ownFormsOnly('woodblock')).toBe(true)
  expect(brushFace('woodblock')).toBe(false)
  for (const style of ['regular', 'pen-writing', 'fangsong']) expect(brushFace(style) && ownFormsOnly(style)).toBe(true)
  for (const style of ['sans', 'serif']) expect(brushFace(style) || ownFormsOnly(style)).toBe(false)
})

test('no bundled Noto form stands in for a woodblock component', () => {
  // ⿱文厂 is a bundled form of the Sans face.
  expect(containsComponentForm('⿱文厂', 'sans')).toBe(true)
  expect(componentRecord('⿱文厂', 'sans')).not.toBe(null)
  expect(containsComponentForm('⿱文厂', 'woodblock')).toBe(false)
  expect(componentRecord('⿱文厂', 'woodblock')).toBe(null)
})
