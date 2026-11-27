import { expect, test } from 'bun:test'
import { formatVariationSyntax, parseVariationSyntax } from '../src/variation-syntax.js'
import { realizeVariation } from '../src/variation-expression.js'
import { createVariationRegistry } from '../src/variation-registry.js'
import { variationProductFromJSON } from '../src/variation-product.js'
import { family, expression, sites } from '../examples/variation-expression/u26201.js'

test('the two nested 幺 occurrences round-trip as a space, then as every individual design', () => {
  const registry = createVariationRegistry([family])
  const space = {version:1, expression, dimensions:sites}
  const syntax = formatVariationSyntax(space)
  expect(syntax).toContain('vary /0/1/0 in "VR/5E7A"')
  expect(syntax).toContain('vary /1/1/1 in "VR/5E7A"')
  const product = variationProductFromJSON(registry, parseVariationSyntax(syntax))
  expect(product.count).toBe(9n)
  expect(parseVariationSyntax(formatVariationSyntax(product.toJSON()))).toEqual(product.toJSON())
  for (let i=0n; i<product.count; i++) {
    const selected = parseVariationSyntax(formatVariationSyntax(product.at(i)))
    const spelling = realizeVariation(selected, registry)
    expect(product.rank(selected)).toBe(i)
    expect(product.detect(spelling).index).toBe(i)
  }
})

test('local literal choices preserve quoted evidence and complete operands', () => {
  const text = 'variant 1 "⿰幺幺"\nform /1 "幺" = "&GW-u5e7a-g;" from "archive #4, \\"A\\""\n'
  expect(formatVariationSyntax(parseVariationSyntax(text))).toBe(text)
  const space = 'space 1 "幺"\nvary / options [{"text":"&GW-u5e7a-g;","source":"glyph file"}]\n'
  expect(formatVariationSyntax(parseVariationSyntax(space))).toBe(space)
})

test('invalid paths, incompatible or duplicate sites, and malformed lines produce errors', () => {
  for (const text of [
    'space 3 "幺"',
    'space 1 "木"\nvary /9 in "shape"',
    'space 1 "⿰木木"\nvary / in "any"\nvary /0 in "shape"',
    'space 1 "木"\nvary / in "one"\nvary / in "two"',
    'variant 1 "木"\nform / "木" = "水" from "source" junk',
    'space 1 "幺"\nvary / options [{"source":"local","text":"口","family":"other"}]',
    'space 1 "幺"\nvary / among []',
  ]) expect(() => parseVariationSyntax(text)).toThrow()
})
