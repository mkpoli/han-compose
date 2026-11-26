import { expect, test } from 'bun:test'
import { mapped, partOf } from '../src/geometry.js'
import { hostChainParts } from '../src/host-chain.js'

const horse = '#(-一丨b𠃌)'
const island = '#(一-𠃍丨b𠃌)'
const region = [0, 0, 1000, 1000]

test('fetches only the attested glyph for supported complete leaves', () => {
  const lookedUp = []
  const composer = {
    excluded: () => false,
    glyphRecord(char) {
      lookedUp.push(char)
      return null
    },
  }
  expect(hostChainParts(composer, horse, region, true)).toBeNull()
  expect(hostChainParts(composer, island, region, true)).toBeNull()
  expect(hostChainParts(composer, ['⿹', horse, '灬'], region, true)).toBeNull()
  expect(lookedUp).toEqual(['馬', '島'])
})

test('keeps the fallback when the host, chain, or contour revision is unavailable', () => {
  for (const excluded of [horse, '馬', '丨']) {
    const composer = {
      excluded: char => char === excluded,
      glyphRecord() { throw new Error('excluded host must not be fetched') },
    }
    expect(hostChainParts(composer, horse, region, true)).toBeNull()
  }
  const composer = {
    excluded: () => false,
    glyphRecord: () => ({ v: 1, p: [] }),
  }
  expect(hostChainParts(composer, horse, region, true)).toBeNull()
})

// Noto Sans CJK 馬 contour data from the Sans export (SIL OFL 1.1).
test('preserves the host contours and native placement of its frame', () => {
  const record = { v: 1, b: [36.35, -80.58, 933.21, 791.11], p: [
    ["MLLL", "OwNKBw0NSgcNDVUGOwNVBg==", "SQCOABsAjgAbAMP/SQDD/w=="],
    ["MLLL", "OwPJCQ0NyQkNDdEIOwPRCA==", "SQBzABsAcwAbAKv/SQCr/w=="],
    ["MLLL", "mQLJBKYNyQSmDcADmQLAAw==", "t/+jAG7/owBu/7z/t/+8/w=="],
    ["MLQ3Q4Q3Q3Q3Q3Q3Q4", "Zg3JBJUOyQSVDskEkQ5oBI4ORgRyDqICMw6RAOUNc/+rDTb/dw3+/vsMzf6lDMb+Vgy+/kELv/6oCsv+pAoH/3gKo/9VCuD/6QrS/+kLyv8dDMv/VgzL/5IM2v+sDPT/1gweABYNGwFNDQoDZg2cBA==", "Qv+jAF8AowBfAKMAXwBkAFoATgBiAE4AaQA7AGsAHQBpABYAVQD2/zEA2/8nANL/IgDK/zsAwf9EALn/RAD5/xgAiQD7/7wAz/++AH//vgB//8EAcv/BAG7/xgBw/8gAZv/GAFr/tQBL/5oAQv98AA=="],
    ["MLQ3LQ3", "SAelAjYI2wKICDUCGAmkADAJGwA1CNX/HghhAJkH+QFIB6UC", "fP/P/04ABQBMAPv/RADo/0QA2f9f/6P/Zv+v/3f/w/98/8//"],
    ["MLQ3LQ3", "zwnhAqkKOQMWC74C4AuLAQwMHAEmC7UA+AonATYKYwLPCeEC", "df/X/z8ABwAiAP7/9P/x/+j/7P8O/7f/IP+5/1r/zf91/9f/"],
    ["MLQ3LQ4", "mASMApYFtQLNBfYBHAY7ACEGl/8PBWv/DwXY/+0E6wC4BAsCmASMAg==", "fP/g/2YABwBzAP7/fADl/38A2f+N/63/jf+0/4v/xf+E/9n/fP/g/w=="],
    ["MLQ4LQ3", "VwIXA14D0AI6AxQCxAKcAA4CWv+GAeT+kQB+/00BHgAoAhACVwIXAw==", "gf8lAHoA4P96ANT/hADI/44Avv+OALT/q/9CAJf/QgCI/yAAgf8lAA=="],
    ["MLLL", "ZgfPC5AIzwuQCF4EZgdeBA==", "hv/5/5wA+f+cAE4Ahv9OAA=="],
    ["MLLLLL", "mQJcDJgNXAyYDVQLvwNUC78DTASZAkwE", "t/94ACAAeAAgAJD/zQCQ/80ALAC3/ywA"],
  ] }
  const composer = {
    excluded: () => false,
    glyphRecord: () => record,
    C: { face: region },
  }
  const [root] = hostChainParts(composer, horse, region, true)
  const glyph = partOf(record)
  expect(root.part.contours).toEqual([glyph.contours[2], glyph.contours[3], glyph.contours[9]])
  expect(root.target).toEqual(root.source)
  const slot = [100, 100, 400, 500]
  const [custom] = hostChainParts({ ...composer, face: slot }, horse, slot, true)
  expect(custom.target).toEqual(mapped(root.source, region, slot))
  const [nested] = hostChainParts(composer, horse, slot, false)
  expect(nested.target).toEqual(slot)
})
