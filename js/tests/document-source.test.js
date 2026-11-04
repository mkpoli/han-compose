// The source a document renderer reads: each drawn part in its leaf's own 1000-unit frame.
import { describe, expect, it } from 'bun:test'
import { documentSource } from '../src/document-source.js'

const component = (id, char) => ({ id, kind: 'component', char })
const document = { root: { id: 'root', kind: 'operator', op: '⿰', children: [component('a', '木'), component('b', '口')] } }
const sketch = [{ index: 0, box: [0, 0, 500, 1000], empty: false }, { index: 1, box: [500, 0, 500, 1000], empty: false }]

describe('a document source', () => {
  it('maps a quadratic curve without flattening it', () => {
    // A leaf's box is its own frame, so a path already in that frame comes back as it went in.
    const made = documentSource(document, { d: '', parts: [{ d: 'M0 0Q500 0 1000 1000Z', leaf: 0 }, { d: 'M0 0L1000 1000Z', leaf: 1 }], slots: [] }, sketch)
    expect(made.issues).toEqual([])
    const [piece] = made.source.geometry(document.root.children[0]).pieces
    expect(piece.d).not.toContain('NaN')
    expect(piece.d).toContain('Q')
  })
  it('takes an Emoji part, which carries no path, as drawn', () => {
    const made = documentSource(document, { d: '', parts: [{ d: '', leaf: 0 }, { d: 'M0 0L1000 1000Z', leaf: 1 }], slots: [] }, sketch)
    expect(made.issues).toEqual([])
    expect(made.source.geometry(document.root.children[0]).pieces).toEqual([{ d: '', fillRule: 'nonzero', cut: false }])
  })
  it('maps a cubic curve without flattening it', () => {
    const made = documentSource(document, { d: '', parts: [{ d: 'M0 0C0 0 1000 1000 1000 1000Z', leaf: 0 }, { d: 'M0 0L1000 1000Z', leaf: 1 }], slots: [] }, sketch)
    const [piece] = made.source.geometry(document.root.children[0]).pieces
    expect(piece.d).not.toContain('NaN')
    expect(piece.d).toContain('C')
  })
})
