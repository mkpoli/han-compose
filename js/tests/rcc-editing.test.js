import { expect, it } from 'bun:test'
import { keyOf, leafTexts } from '../src/compose.js'
import { numberRccLeaves, rccLeafBoxes } from '../src/rcc-forms.js'

it('preserves operand ownership through repeated records and intervening ordinary leaves', () => {
  const record = ['⿵', '巾', '１']
  const tree = ['⿲', record, '木', record]
  const group = () => {
    const rccGroup = { key: keyOf(record) }
    return [1, 0, 0].map((rccLeaf, i) => ({ rccGroup, rccLeaf, target: [i, i, i + 1, i + 2] }))
  }
  const a = group(), b = group()
  const parts = [...a, {}, ...b]
  numberRccLeaves(tree, parts, keyOf, leafTexts)
  expect(parts.map(p => p.leaf)).toEqual([1, 0, 0, 2, 4, 3, 3])
  expect(rccLeafBoxes(a, 2)).toEqual([[1, 1, 3, 4], [0, 0, 1, 2]])
})
