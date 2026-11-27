import { yaoFamily, yaoSources } from '../../src/yao-catalogue.js'

export const family = yaoFamily
const babelstone = 'BabelStone IDS 2025-06-27'
export const sources = {
  [babelstone]: {
    author: 'Andrew West (魏安)', date: '2025-06-27', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT',
    sha256: 'cc2a0a97e6a51ed6ebe59870ef2af66e83f3c3c27387d79b4441bb2d791d78b1',
  },
  ...yaoSources,
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

export const sites = [[0, 1, 0], [1, 1, 1]].map(path => ({ path, family: family.id }))
