import { expect, it } from 'bun:test'
import data from '../src/component-forms.json'
import { componentDrawing, isComponentForm } from '../src/component-forms.js'

// The frame of 马 as zi.tools writes it, cut from 马 in each Noto face.
const CHAIN = '#(-𠃍㇉)'

it('draws a stroke chain from the outline cut out of its host', () => {
  for (const style of ['sans', 'serif']) {
    expect(isComponentForm(CHAIN, style)).toBe(true)
    expect(componentDrawing(CHAIN, style)?.d).toMatch(/^M/)
    // One piece: the chain, with the host's other stroke left behind.
    expect(data.forms[style][CHAIN]).toHaveLength(1)
    expect(data.forms[style][CHAIN][0]).toHaveLength(1)
  }
})

it('keeps a Noto cut out of the faces that draw only their own', () => {
  for (const style of ['kaisho', 'fangsong']) expect(isComponentForm(CHAIN, style)).toBe(false)
})
