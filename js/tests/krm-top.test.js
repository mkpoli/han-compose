import { expect, it } from 'bun:test'
import { compose, createSource, sketch } from '../src/loader.js'
import { componentParts } from '../src/component-forms.js'
import data from '../src/component-forms.json' with { type: 'json' }
import { groupParts } from '../src/group-parts.js'
import { files } from './fixtures/small-export.js'

const source = async () => {
  const source = createSource(async name => {
  const file = files[name]
  return file === undefined ? null : new Blob([file]).arrayBuffer()
  })
  // This small fixture supplies 木 as the stand-in for unrelated leaf outlines.
  await compose(source, '木')
  const store = source.store
  source.store = () => {
    const data = store(), rec = data.rec
    return { ...data, rec: key => rec([...'人⺊冖'].includes(key) ? '木' : key) }
  }
  return source
}

for (const fontStyle of ['sans', 'serif', 'kaisho']) {
  it(`${fontStyle} reuses the KRM top with the same outline in separate view`, async () => {
    const src = await source()
    for (const text of ['⿱⺊冖', '⿳⺊冖人', '⿱⿱⺊冖人', '⿰木⿳⺊冖人']) {
      const separate = await compose(src, text, { fontStyle, separate: true })
      const whole = await compose(src, text, { fontStyle })
      expect(separate.d).toBe(whole.d)
      expect(separate.d).not.toMatch(/NaN|Infinity/)
      const leaves = await sketch(src, text, { fontStyle })
      expect(groupParts(separate.parts, leaves)?.length).toBe(text === '⿱⺊冖' ? 2 : text.startsWith('⿰') ? 4 : 3)
      expect(separate.parts.filter(p => p.origin.includes('KRM-07097330'))).toHaveLength(2)
    }
    expect((await compose(src, '⿳⺊冖人', { fontStyle })).d)
      .toBe((await compose(src, '⿱⿱⺊冖人', { fontStyle })).d)
  })
}

for (const fontStyle of ['sans', 'serif', 'kaisho']) {
  it(`${fontStyle} tucks the part below close under the KRM top's bar`, async () => {
    const { parts } = await compose(await source(), '⿳⺊冖人', { fontStyle, separate: true })
    const [stem, roof, body] = parts
    const end = part => part.box[1] + part.box[3]
    // The lower part starts inside the roof's own height, above the ends of its legs.
    expect(body.box[1]).toBeGreaterThan(roof.box[1])
    expect(body.box[1]).toBeLessThan(end(roof))
    // It still reaches the bottom of the face, and the top stays above it.
    expect(end(body)).toBeGreaterThan(900)
    expect(stem.box[1]).toBeLessThan(body.box[1])
  })
}

it('records Kureedo donors for the Kaisho editorial top', () => {
  const witness = data.editorial['KRM-07097330']
  expect(witness.donors.kaisho).toEqual(['上', '冖'])
  expect(witness.reference).toContain('KRM K07097330')
  expect(witness.gloss).toContain('K07097330: 俗')
  expect(witness.kaisho).toContain('Kureedo')
  expect(data.forms.kaisho['⿱⺊冖']).not.toEqual(data.forms.sans['⿱⺊冖'])
  expect(data.forms.kaisho['⿱⺊冖']).not.toEqual(data.forms.serif['⿱⺊冖'])
  const parts = componentParts('⿱⺊冖', undefined, 'kaisho')
  expect(parts).toHaveLength(2)
  for (const part of parts) expect(part.origin).toContain('KRM-07097330 editorial (Kureedo)')
})
