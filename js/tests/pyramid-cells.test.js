import { describe, expect, it } from 'bun:test'
import { pyramidCells } from '../src/pyramid.js'

describe('the cells of a pyramid', () => {
  it('has none for a count of layers that is no whole number', () => {
    expect(pyramidCells([0, 0, 1000, 1000], 2.5)).toEqual([])
    expect(pyramidCells([0, 0, 1000, 1000], Number.NaN)).toEqual([])
    expect(pyramidCells([0, 0, 1000, 1000], 3)).toHaveLength(6)
  })
})
