// @ts-check
import { yaoOutline } from './render-u26201.js'
import { u26201Forms } from './yao-forms.js'

export const yaoSources = {
  glyphwiki: {
    author: 'GlyphWiki contributors', retrieved: '2026-11-27',
    license: 'https://glyphwiki.org/wiki/GlyphWiki:データ・記事のライセンス',
  },
  ivd: {
    name: 'IVD', family: 'IVD/5E7A', form: 'E0100',
    author: 'Unicode Consortium', edition: '2026-08-03',
    url: 'https://www.unicode.org/ivd/data/2026-08-03/IVD_Sequences.txt',
    sequence: '5E7A E0100', collection: 'Adobe-Japan1', identifier: 'CID+4739',
    // The GlyphWiki alias documents the association of the IVS with this stroke construction.
    outlineWitness: {
      source: 'https://glyphwiki.org/api/glyph?name=u5e7a-ue0100@13',
      program: '99:0:0:0:0:200:200:u5e7a-j',
      // The target in that revision is unversioned.
      target: 'https://glyphwiki.org/api/glyph?name=u5e7a-j@2',
      resolved: '2026-11-27',
    },
  },
}

/** @type {Record<string,[number,string?]>} */
const witnesses = {
  'u5e7a-j': [2, 'J'], 'u5e7a-g': [6, 'G'], 'u5e7a-h': [6, 'H'],
  'u5e7a-t': [7, 'T'], 'u5e7a-var-002': [1], 'u5e7a-itaiji-009': [3],
}

/** @param {string} glyph */
function sourceFor(glyph) {
  const [revision, region] = witnesses[glyph]
  return {
    name: 'GlyphWiki', ...(region && {region}),
    glyph, revision, author: 'GlyphWiki contributors', url: 'https://glyphwiki.org/wiki/' + glyph + '@' + revision,
  }
}

const notoRelease = {
  name: 'RegionalDiff', face: 'Noto Serif CJK Regular', edition: '2.003',
  url: 'https://github.com/notofonts/noto-cjk/blob/Serif2.003/Serif/OTC/NotoSerifCJK-Regular.ttc',
  sha256: '5d9c31a059600193c9d7968a998bde886ccdc77e934006ad243b41794c496a7d',
}
/** @type {Record<string,(typeof notoRelease & {regions:string[], glyph:string})[]>} */
const regional = {
  detached: [{...notoRelease, regions: ['JP', 'KR'], glyph: 'cid16889'}],
  folded: [{...notoRelease, regions: ['SC', 'TC', 'HK'], glyph: 'cid16890'}],
  returning: [],
}

export const yaoFamily = {
  id: 'VR/5E7A', subjects: ['幺'], reference: '幺',
  axes: [{ id: 'upperTurn', property: 'construction', locus: [{path: []}],
    values: u26201Forms.map(form => form.id) }],
  related: [{ name: 'UCV', id: '129', components: '么幺', relation: 'component criterion',
    source: 'IRG N2978 (2026-10-20)', url: 'https://hc.jsecs.org/irg/iwds/ucv?show=129' }],
  forms: u26201Forms.map(({id, text, aliases, witnesses}) => ({
    id, text, aliases, outline: yaoOutline(id), traits: {upperTurn: id},
    design: { id: `VR/5E7A/${id}`, styleReference: notoRelease.url },
    sources: [...witnesses.map(sourceFor), ...regional[id], ...(id === 'detached' ? [yaoSources.ivd] : [])],
  })),
}
