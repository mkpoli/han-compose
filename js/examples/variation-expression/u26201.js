import outlines from './yao-outlines.json' with { type: 'json' }

const babelstone = 'BabelStone IDS 2025-06-27'
export const sources = {
  [babelstone]: {
    author: 'Andrew West (魏安)', date: '2025-06-27', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT',
    sha256: 'cc2a0a97e6a51ed6ebe59870ef2af66e83f3c3c27387d79b4441bb2d791d78b1',
  },
  glyphwiki: {
    author: 'GlyphWiki contributors', retrieved: '2026-11-27',
    license: 'https://glyphwiki.org/wiki/GlyphWiki:データ・記事のライセンス',
    renderer: '@kurgm/kage-engine 0.7.0, default Mincho, polygon outlines',
    rendererURL: 'https://github.com/kurgm/kage-engine',
  },
  ivd: {
    author: 'Unicode Consortium', edition: '2026-08-03',
    url: 'https://www.unicode.org/ivd/data/2026-08-03/IVD_Sequences.txt',
    sequence: '5E7A E0100', collection: 'Adobe-Japan1', identifier: 'CID+4739',
    outlineWitness: 'https://glyphwiki.org/wiki/u5e7a-ue0100@13',
  },
}

export const expression = {
  version: 1, base: '𦈁',
  expansions: [
    { path: [], subject: '𦈁', ids: '⿰𦃃率', source: babelstone + ' U+26201 [GT]' },
    { path: [0], subject: '𦃃', ids: '⿱𠂹糸', source: babelstone + ' U+260C3 [GT]' },
    { path: [0, 1], subject: '糸', ids: '⿱幺小', source: babelstone + ' U+7CF8 [GHT]' },
    { path: [1], subject: '率', ids: '⿳亠⿴{11}幺十', source: babelstone + ' U+7387 [GHTJKP]' },
  ],
  choices: [],
}

const witness = 'Default Mincho polygon extrema, 200-unit GlyphWiki drawing square'
const axis = (id, property, unit) => ({
  id, property, unit, witness, locus: [{ path: [] }],
  values: [...new Set(outlines.map(row => String(row[id])))],
})

export const family = {
  id: 'glyphwiki/5E7A', subjects: ['幺'], reference: '幺',
  axes: [
    { ...axis('primitives', 'count', 'KAGE instructions'), witness: 'Dollar-separated records in each pinned KAGE program' },
    axis('inkWidth', 'width', 'GlyphWiki units'), axis('inkHeight', 'height', 'GlyphWiki units'),
  ],
  forms: outlines.map(({ name, version, primitives, inkWidth, inkHeight, d }) => ({
    id: name, text: name === 'u5e7a-j' ? '幺󠄀' : '&GW-' + name + ';',
    outline: { viewBox: '0 0 200 200', d },
    traits: { primitives: String(primitives), inkWidth: String(inkWidth), inkHeight: String(inkHeight) },
    sources: [
      { name: 'GlyphWiki', glyph: name, revision: version, url: 'https://glyphwiki.org/wiki/' + name + '@' + version },
      ...(name === 'u5e7a-j' ? [sources.ivd] : []),
    ],
  })),
}

export const sites = [[0, 1, 0], [1, 1, 1]].map(path => ({ path, family: family.id }))
