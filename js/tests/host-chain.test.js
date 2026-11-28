import { expect, test } from 'bun:test'
import { fill, groupRings, mapped, partOf, pointsBox } from '../src/geometry.js'
import islandRecords from './fixtures/island-frames.json' with { type: 'json' }
import { chainHost, hostChainParts } from '../src/host-chain.js'

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
  // The requested face may serve the exact Noto fallback outline.
  const [fallback] = hostChainParts({ ...composer, fontStyle: 'regular' }, horse, region, true)
  expect(fallback.part.contours).toEqual(root.part.contours)
  expect(root.target).toEqual(root.source)
  const slot = [100, 100, 400, 500]
  const [custom] = hostChainParts({ ...composer, face: slot }, horse, slot, true)
  expect(custom.target).toEqual(mapped(root.source, region, slot))
  const [nested] = hostChainParts(composer, horse, slot, false)
  expect(nested.target).toEqual(slot)
})

test('uses the corresponding angular or bent walking base in each native face', () => {
  expect(['sans', 'serif', 'regular', 'fangsong', 'pen-writing'].map(style => chainHost('#(㇋乀)', style)))
    .toEqual(['⻎', '⻎', '辶', '辶', '辶'])
  expect(chainHost('#(𠃍乀)', 'regular')).toBe('⻌')
  expect(chainHost('#(𠃍乀)', 'pen-writing')).toBeUndefined()
  for (const excluded of ['辶', '⻎', '㇋']) {
    expect(hostChainParts({
      fontStyle: 'sans', excluded: char => char === excluded,
      glyphRecord() { throw Error('Excluded reference was requested') },
    }, '#(㇋乀)', region, true)).toBeNull()
  }
})

// Kureedo 之 from the Pen Writing export (SIL OFL 1.1).
test('cuts the attached dot of 之 while preserving the pen-written sweep', () => {
  const record = {"v": 1, "b": [65.0, -53.0, 954.0, 746.0], "p": [["MLQ4Q2Q4Q3Q4Q3Q3LLLQ3Q2Q2Q2LLQ3Q3Q3Q2Q2Q3Q3LQ3Q3Q5Q3Q2Q3Q2Q3", "JA4s/zwOLP9sDiz/uA6M/+gO8P/oDvT/6A4QAKwOEADkDBwAYAm4ABwGqAGwBDACoAQ4AngERAJkBEgCwAX8AogIxAQ0C8QGWAzQB2gM3AeMDAwIjAwsCIwMYAgcDMQIzAvECKALxAgICHgICAhECwgIcAuAB6gLPAeoCwAHqAsAB5ALAAeICwgHeAswBzQLMAcECzgHaAiwAxwInAMcCHADGAhYAxgIOAMYCPACIAjQAigIzAIoCMQCLAi8AiwIqAIsCKgCGAioAgwIrAIECNgCjAc4A1gHYANYB3gDWAe8A2AH7ANkB2ALBAjUCawGvAXEA1wDhAI4A4gC8AKMAswCjAKsAowCGAKEAngBaAIEATACBAEAAgQB0AE4AYQBZAGEAXABhAGIAYwB2AGsAYgCzAHkAswBsAPMAaAEcAG4BpwApAto/yQOLP8=", "BABQAAAAUADZ/1AAvP8rALD/EgCw/wAAsP+w////sP/4/7D/7v+y/+f/tP/g/7f/4v+1/+3/sv8e/+D/2P9FANL/QgDN/z4Azf8+AMf/OQCw/xsAsP8AALD/3P/h/7D/AACw/wMAsP+w/6n/sP8AALD/yv/w/7D/AACw/1AAsP9QAAAAUAATAEYAJgBQABYAUAAAAFEAt/8DALD/BACw/wQAsP8AALD//P+w//L/sf/2/7D/7f+w/+3/sP8AALD/UACw/1AAAABQABMASgAgAEEAOAAUAFAAAABQAPv/UAD4/1AA+f9QANMAWQAyAMH/KgC8/xAArv/5/7D//v+w/wAAsP8CALD/CQCw/xkAs/9QAM7/UAAAAFAAGQAqAFAAAABQAPP/UADk/0sA6v9NAPn/UAAAAFAADwBQAB0ASwAYAEwADQBPAAQAUAA="]]}
  const composer = { fontStyle: 'pen-writing', excluded: () => false, glyphRecord: () => record, C: { face: region } }
  const [cut] = hostChainParts(composer, '#(㇇乀)', region, true)
  const original = partOf(record)
  expect(cut.part.contours).toHaveLength(1)
  expect(cut.part.box.slice(0, 3).map(Math.round)).toEqual(original.box.slice(0, 3).map(Math.round))
  expect(cut.part.box[3]).toBeLessThan(570)
  expect(original.box[3]).toBeGreaterThan(740)
  expect(hostChainParts({ ...composer, fontStyle: 'regular' }, '#(㇇乀)', region, true)).toBeNull()
})

test('loads the native regional walking base when format 7 omits the radical', () => {
  for (const fontStyle of ['sans', 'serif', 'regular']) {
    const key = fontStyle === 'regular' ? '#(𠃍乀)' : '#(㇋乀)'
    const composer = { fontStyle, excluded: () => false, glyphRecord: () => null, C: { face: region } }
    const [part] = hostChainParts(composer, key, region, true)
    expect(part.origin).toContain(chainHost(key, fontStyle))
    expect(part.part.box[3]).toBeLessThan(650)
  }
})

// Noto Sans CJK JP 2.004 亞 (SIL OFL 1.1).
test('widens the space between 亞 uprights only in the saved standalone frame', () => {
  const record = {"b": [51.98, -35.48, 949.02, 776.28], "p": [["MLLL", "OAEhDHcOIQx3DgwLOAEMCw==", "nP9/AF0AfwBdAIj/nP+I/w=="], ["MLLL", "0ACFANQOhQDUDnL/0ABy/w==", "1P+rACwAqwAsALL/1P+y/w=="], ["MLLLLL", "ngJtBJcGbQSXBvD/eAXw/3gFZAOeAmQD", "YgCXAIkAlwCJACAAfP8gAHz/tP9iALT/"], ["MLLLLL", "7AGkCJYGpAiWBp8HEwOfBxMDwwLsAcMC", "vP9kAI4AZACOAIH/zQCB/80A2f+8/9n/"], ["MLLL", "lgagC5YGIQh1BSEIdQWgCw==", "jgAUAI4A+/9///v/f/8UAA=="], ["MLLL", "7gicCxAKnAsQChwI7ggcCA==", "bv8AAHwAAAB8AOj/bv/o/w=="], ["MLLLLL", "7gipCK8NqQivDd0CgAzdAoAMpAfuCKQH", "bv9fAEkAXwBJANv/LP/b/yz/fP9u/3z/"], ["MLLLLL", "7ghtBB8NbQQfDWQDEApkAxAK6v/uCOr/", "bv+XAMH/lwDB/7T/fAC0/3wAFgBu/xYA"]], "v": 1}
  const composer = {
    fontStyle: 'sans', excluded: () => false, glyphRecord: () => record, C: { face: region },
    data: { manifest: { composer: { commit: 'a83fc941166b' } } },
  }
  const metrics = (contour, master) => { const [x0, , x1] = pointsBox(contour[master]); return x1 - x0 }
  for (const [key, upright] of [['#(丨-一𠃑)', 2], ['#(𠃑-一丨)', 0]]) {
    const [nested] = hostChainParts(composer, key, region, false)
    const [root] = hostChainParts(composer, key, region, true)
    const width = piece => piece.box[2] - piece.box[0]
    expect(width(root.part)).toBeGreaterThan(2 * width(nested.part))
    for (const master of ['light', 'heavy']) {
      expect(metrics(root.part.contours[upright], master)).toBeCloseTo(metrics(nested.part.contours[upright], master), 6)
    }
    expect(nested.target).toEqual(region)
  }
})

// Native 島 paths from TW-Kai, Zhuque FangSong and Kureedo in the deployed format-7 exports.
test('closes the upper counter of the 島 frame in the three brush faces', () => {
  for (const [fontStyle, record] of Object.entries(islandRecords)) {
    expect(chainHost(horse, fontStyle)).toBe('馬')
    expect(chainHost(island, fontStyle)).toBe('島')
    const composer = { fontStyle, glyphRecord: ch => ch === '島' ? record : null, excluded: () => false }
    const [frame] = hostChainParts(composer, island, region, false)
    expect(frame.part.contours).toHaveLength(2)
    // The middle bar spans the opening between the left stem and the fold.
    // A column near either end crosses the top, middle and hooked lower bars.
    const size = 100
    const mask = fill(groupRings([frame], 24), size, region)
    for (const x of [23, 45]) {
      let bands = 0
      for (let y = 0; y < size; y++) {
        if (mask[y * size + x] && (y === 0 || !mask[(y - 1) * size + x])) bands++
      }
      expect(bands).toBe(3)
    }
    for (const ch of ['島', island, '𠃌']) {
      expect(hostChainParts({ ...composer, excluded: candidate => candidate === ch }, island, region, false)).toBeNull()
    }
  }
})
