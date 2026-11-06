// The source a document renderer reads: each drawn part in its leaf's own 1000-unit frame.
import { describe, expect, it } from 'bun:test'
import { documentSource } from '../src/document-source.js'
import { documentView } from '../src/document-view.js'

const component = (id, char) => ({ id, kind: 'component', char })
const document = { root: { id: 'root', kind: 'operator', op: '⿰', children: [component('a', '木'), component('b', '口')] } }
const sketch = [{ index: 0, box: [0, 0, 500, 1000], empty: false }, { index: 1, box: [500, 0, 500, 1000], empty: false }]

describe('a document source', () => {
  it('maps a quadratic curve without flattening it', () => {
    // A leaf's box is its own frame, so a path already in that frame comes back as it went in.
    const made = documentSource(document, { d: '', parts: [{ d: 'M0 0Q500 0 1000 1000Z', leaf: 0 }, { d: 'M0 0L1000 1000Z', leaf: 1 }], slots: [] }, sketch)
    expect(made.issues).toEqual([])
    const [piece] = made.source.geometry(document.root.children[0]).pieces
    // The leaf is 500 wide, so its frame doubles every x, control point included.
    expect(piece.d).toBe('M0 0Q1000 0 2000 1000Z')
  })
  it('reports a path with too few numbers for a command', () => {
    const made = documentSource(document, { d: '', parts: [{ d: 'M0 0Q0', leaf: 0 }, { d: 'M0 0L1000 1000Z', leaf: 1 }], slots: [] }, sketch)
    expect(made.complete).toBe(false)
    expect(made.issues.join()).toContain('not a path')
  })
  it('reports a layout box with a number that is not finite', () => {
    const broken = [{ index: 0, box: [Number.NaN, 0, 500, 1000], empty: false }, sketch[1]]
    const made = documentSource(document, { d: '', parts: [{ d: 'M0 0L1 1Z', leaf: 0 }, { d: 'M0 0L1 1Z', leaf: 1 }], slots: [] }, broken)
    expect(made.complete).toBe(false)
    expect(made.issues.join()).toContain('no layout box')
  })
  it('takes an Emoji part, which carries no path, as drawn', () => {
    const made = documentSource(document, { d: '', parts: [{ d: '', leaf: 0 }, { d: 'M0 0L1000 1000Z', leaf: 1 }], slots: [] }, sketch)
    expect(made.issues).toEqual([])
    expect(made.source.geometry(document.root.children[0]).pieces).toEqual([{ d: '', fillRule: 'nonzero', cut: false }])
  })
  it('maps a cubic curve without flattening it', () => {
    const made = documentSource(document, { d: '', parts: [{ d: 'M0 0C0 0 1000 1000 1000 1000Z', leaf: 0 }, { d: 'M0 0L1000 1000Z', leaf: 1 }], slots: [] }, sketch)
    const [piece] = made.source.geometry(document.root.children[0]).pieces
    expect(piece.d).toBe('M0 0C0 0 2000 1000 2000 1000Z')
  })
  it('lists the parts drawn for each leaf, complete or not', () => {
    const renderer = { layerFrames: () => new Map(), renderScopes: () => ({ complete: true, issues: [], leafFrames: new Map() }) }
    const a = { d: 'M0 0L500 1000Z', leaf: 0 }, b = { d: 'M500 0L1000 1000Z', leaf: 1 }, c = { d: 'M0 0L500 500Z', leaf: 0 }
    const whole = documentView(document, { d: '', parts: [a, b, c] }, sketch, { renderer })
    expect(whole.complete).toBe(true)
    expect(whole.partsByLeaf.get(0)).toEqual([a, c])
    expect(whole.partsByLeaf.get(1)).toEqual([b])
    const partial = documentView(document, { d: '', parts: [a] }, sketch, { renderer })
    expect(partial.complete).toBe(false)
    expect(partial.partsByLeaf.get(0)).toEqual([a])
    expect(partial.partsByLeaf.has(1)).toBe(false)
  })
})
