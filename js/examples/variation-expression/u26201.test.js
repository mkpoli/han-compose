import { test, expect } from 'bun:test'
import { recognizeVariationOutline } from '../../src/variation-outline.js'
import { family } from './u26201.js'

test('each of the six pinned 幺 outlines identifies only its own witness', () => {
  const witnesses = family.forms.map(form => ({
    frame: 'GlyphWiki:200', d: form.outline.d, form: form.id, source: form.sources[0].url,
  }))
  for (const witness of witnesses) {
    expect(recognizeVariationOutline(witness, witnesses)).toEqual({
      status: 'matched', candidates: [{ form: witness.form, source: witness.source, distance: 0 }],
    })
  }
})
