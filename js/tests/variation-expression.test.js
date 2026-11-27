import { expect, test } from 'bun:test'
import { createVariationRegistry } from '../src/variation-registry.js'
import {
  chooseVariation, clearVariation, collapseVariation, expandVariation, expandedVariation, realizeVariation,
  replaceVariation, variationExpression, variationSubject,
} from '../src/variation-expression.js'

const registry = createVariationRegistry([{ id: 'fixture/forms', subjects: ['幺'], forms: [
  { id: 'one', text: '幺' }, { id: 'two', text: '&Example-loop;' },
] }])

// These are grammar fixtures. The local source identifiers belong only to this test.
const base = variationExpression('⿰糸糸')
const witness = { subject: '糸', ids: '⿱幺小', source: 'fixture:structure' }
const expanded = expandVariation(expandVariation(base, [1], witness), [0], witness)

test('independent occurrences retain witnesses and expand only ancestors with a chosen descendant', () => {
  expect(expandedVariation(expanded)).toBe('⿰⿱幺小⿱幺小')
  expect(realizeVariation(expanded)).toBe('⿰糸糸')
  const left = chooseVariation(registry, expanded, [0, 0], 'fixture/forms', 'two')
  expect(realizeVariation(left)).toBe('⿰⿱&Example-loop;小糸')
  const right = chooseVariation(registry, left, [1, 0], 'fixture/forms', 'one')
  expect(realizeVariation(right)).toBe('⿰⿱&Example-loop;小⿱幺小')
  expect(realizeVariation(JSON.parse(JSON.stringify(right)), registry)).toBe(realizeVariation(right))
  expect(clearVariation(right, [1, 0])).toEqual(left)
  expect(realizeVariation(collapseVariation(left, [0]))).toBe('⿰糸糸')
  expect(realizeVariation(expanded)).toBe('⿰糸糸')
  const stale = JSON.parse(JSON.stringify(right))
  stale.choices[0].text = '木'
  expect(() => realizeVariation(stale, registry)).toThrow('Catalogue spelling changed')
})

test('a sourced replacement has addressable children and can itself have an expansion', () => {
  const source = 'fixture:drawing'
  const parent = replaceVariation(expanded, [0], { text: '⿱木水', source })
  expect(variationSubject(parent, [0])).toBe('糸')
  expect(variationSubject(parent, [0, 1])).toBe('水')
  const child = replaceVariation(parent, [0, 1], { text: '&Example-drop;', source })
  expect(realizeVariation(child)).toBe('⿰⿱木&Example-drop;糸')
  expect(() => clearVariation(child, [0])).toThrow('subject mismatch')
  const annotated = expandVariation(child, [0, 1], { subject: '&Example-drop;', ids: '⿱丶丶', source })
  const lower = replaceVariation(annotated, [0, 1, 1], { text: '丿', source })
  expect(realizeVariation(lower)).toBe('⿰⿱木⿱丶丿糸')
  expect(realizeVariation(collapseVariation(lower, [0, 1]))).toBe(realizeVariation(child))
})

test('expressions reject misplaced witnesses, missing operands, and invalid boundaries', () => {
  expect(() => expandVariation(base, [0], { ...witness, subject: '木' })).toThrow('subject mismatch')
  expect(() => expandVariation(base, [0], { ...witness, ids: '⿱幺' })).toThrow('complete IDS')
  expect(() => realizeVariation({ ...expanded, expansions: [...expanded.expansions, expanded.expansions[0]] })).toThrow('Invalid expansion')
  expect(() => expandVariation(base, [3], witness)).toThrow('Invalid child')
  expect(() => replaceVariation(base, [-1], { text:'木', source:'fixture' })).toThrow('Invalid operand path')
  expect(() => variationExpression('⿰木⬚')).toThrow('complete IDS')
  expect(() => replaceVariation(base, [1], { text:'〮', source:'fixture' })).toThrow('boundaries')
  expect(() => replaceVariation(base, [], { text:'木', source:'' })).toThrow('Invalid choice')
  expect(() => realizeVariation({ ...base, version: 2 })).toThrow('version 1')
})

test('a source criterion stays distinct from a selectable registered family', () => {
  const r = createVariationRegistry([{ id:'UCV/30', subjects:['率'], evidenceOnly:true,
    forms:[{ id:'1', text:'&GW-aj1-03952;' }] }])
  expect(() => chooseVariation(r, variationExpression('率'), [], 'UCV/30', '1')).toThrow('explicit sourced replacement')
  const chosen = replaceVariation(variationExpression('率'), [], { text:'&GW-aj1-03952;', source:'UCV/30/1' })
  expect(realizeVariation(chosen, r)).toBe('&GW-aj1-03952;')
})
