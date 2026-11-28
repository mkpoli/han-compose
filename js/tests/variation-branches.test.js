import { expect, test } from 'bun:test'
import { createVariationRegistry } from '../src/variation-registry.js'
import { replaceVariation, realizeVariation, variationExpression } from '../src/variation-expression.js'
import { createVariationProduct } from '../src/variation-product.js'
import { createVariationBranches, variationBranchesFromJSON } from '../src/variation-branches.js'

const registry = createVariationRegistry([])
const pin = (text, source = 'fixture:child') => ({ text, source })
const root = variationExpression('糸')
const fork = (text, source, dimensions) => createVariationProduct(registry, replaceVariation(root, [], pin(text, source)), dimensions)

// A component has two possible structures. Only the compound has a child to adjust.
const compact = fork('幺', 'fixture:compact', [])
const compound = fork('⿱幺小', 'fixture:compound', [{ path: [0], options: [pin('幺'), pin('&loop;')] }])
const other = fork('⿱幺小', 'fixture:alternative', [{ path: [1], options: [pin('小','A'), pin('小','B')] }])
const branches = createVariationBranches([{ id:'compact', product:compact }, { id:'compound', product:compound }, { id:'other', product:other }])

test('dependent products count distinct occurrences under each parent and survive serialization', () => {
  const saved = variationBranchesFromJSON(registry, JSON.parse(JSON.stringify(branches)))
  expect(saved.count).toBe(5n)
  for (let i = 0n; i < saved.count; i++) expect(saved.rank(branches.at(i))).toBe(i)
  expect(realizeVariation(saved.at(2n).expression)).toBe('⿱&loop;小')
  expect(saved.detect('⿱&loop;小')).toMatchObject({ status:'exact', count:1n, candidates:[{branch:'compound',index:2n}] })
  expect(saved.detect('⿱幺小')).toMatchObject({ status:'ambiguous', count:3n, candidates:[
    { branch:'compound', index:1n }, { branch:'other', count:2n, candidates:[{path:[1],options:[pin('小','A'),pin('小','B')]}] },
  ] })
  expect(saved.detect('土')).toEqual({ status:'unknown', count:0n, candidates:[] })
  expect(() => saved.rank({ ...saved.at(1n), branch:'compact' })).toThrow()
})

test('an empty sum is empty and branch identity is unique', () => {
  const empty = createVariationBranches([])
  expect(empty.count).toBe(0n)
  expect(() => empty.at(0n)).toThrow()
  expect(() => branches.at(-1n)).toThrow()
  expect(() => branches.at(branches.count)).toThrow()
  expect(() => branches.rank({ branch:'absent', expression:root })).toThrow()
  expect(() => createVariationBranches([{id:'same',product:compact},{id:'same',product:compound}])).toThrow('unique')
})
