import { test, expect } from 'bun:test'
import { recognizeVariationOutline } from '../../src/variation-outline.js'
import { createVariationRegistry } from '../../src/variation-registry.js'
import { createVariationProduct } from '../../src/variation-product.js'
import { realizeVariation } from '../../src/variation-expression.js'
import { family, expression, sites } from './u26201.js'

test('each of the three 幺 drawings identifies its canonical design', () => {
  const witnesses = family.forms.map(form => ({
    frame: form.outline.viewBox, d: form.outline.d, form: form.id, source: form.design.id,
  }))
  for (const witness of witnesses) {
    expect(recognizeVariationOutline(witness, witnesses)).toEqual({
      status: 'matched', candidates: [{ form: witness.form, source: witness.source, distance: 0 }],
    })
  }
})

test('source spellings map to one design and select independently at both occurrences', () => {
  const registry = createVariationRegistry([family])
  const product = createVariationProduct(registry, expression, sites)
  const original = realizeVariation(product.at(4n), registry)
  for (const left of family.forms[1].aliases) for (const right of family.forms[1].aliases) {
    const old = original.replace(family.forms[1].text, left).replace(family.forms[1].text, right)
    expect(product.detect(old)).toMatchObject({status: 'exact', index: 4n})
    expect(registry.familiesFor(left).map(f => f.id)).toEqual([family.id])
    expect(registry.at(left, [])[0].forms.map(f => f.id)).toEqual(['folded'])
    expect(registry.select('⿰' + left + right, [0], family.id, 'returning')).toBe('⿰' + family.forms[2].text + right)
  }
})
