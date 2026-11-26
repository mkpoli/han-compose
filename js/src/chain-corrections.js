import { canonicalHistoricalChain } from './historical-chains.js'

// The original records remain in the catalogue. For these obsolete descriptions
// the stated joins conflict, or a single old stroke name has no modern reading.
// Use the identifiable source glyph or the author's correction at the same slot.
// Yi Bai, ids_lv0.txt before and after the explicit-join revision:
// https://github.com/yi-bai/ids/commit/078797d20191d3901d9067fd744961690f4e0af0
// 𠄷's three diamonds and 𠃉's falling entry into 乙 are visible in the
// corresponding regional glyphs as well:
// https://glyphwiki.org/wiki/u20137-t  https://glyphwiki.org/wiki/u200c9-i
const corrections = new Map([
  ['#(乀丿乀丿>^>,0v3)', '#(-乀-丿乀丿z)'],
  ['#(丨𠃍一丨一一乚𠃍^v>>,0>5,3v7,5>6)', '#(𠃍-𠃊一-𠃍𠃊乚)'], // 黽(jwb), enclosing 一 and 𰀄
  ['#(Qc,Qd,Qa,Qb>>>,0>3)', '#(◟◜◝◞z)'], // 〇
  ['#(丨㇎一一丨^v,0v3,2>4,3^4)', '#(-丨一-丨㇎-一z)'], // 凸
  ['#(丨㇎一丨一^v>^,0v4)', '#(-丨一-丨㇎-一z)'],
  ['#(PHPHwg)', '#(丿乙)'], // the earlier, sloping entry into 𠃉
])

/** Reference drawing for a corrected source record. @param {string} key */
export const correctedChain = key => corrections.get(key)

/** The drawable spelling with its documented corrections. @param {string} key */
export const drawingChain = key => canonicalHistoricalChain(correctedChain(key) ?? key)
