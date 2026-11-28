// @ts-check
import { resolveYaoForm, u26201Forms } from './yao-forms.js'

/** Pinned component spellings at the two 幺 of the BabelStone U+26201 analysis. */
const choices = new Map()
const native = { left: undefined, right: undefined }
choices.set('𦈁', native)
const forms = ['幺', ...u26201Forms.flatMap(form => [form.text, ...form.aliases])]
for (const left of forms) {
  const lhs = ['⿱𠂹⿱' + left + '小']
  if (left === '幺') lhs.push('𦃃', '⿱𠂹糸')
  for (const right of forms) {
    const rhs = ['⿳亠⿴{11}' + right + '十', '⿳亠⿴&X-00011;' + right + '十']
    if (right === '幺') rhs.push('率')
    const pair = { left: resolveYaoForm(left)?.text, right: resolveYaoForm(right)?.text }
    for (const a of lhs) for (const b of rhs) choices.set('⿰' + a + b, pair)
  }
}

/** @param {string} text @returns {{left?: string, right?: string} | undefined} */
export const u26201Choice = text => choices.get(text)
/** @param {string} text */
export const containsU26201 = text => text.includes('𦈁') || text.includes('⿰𦃃') || text.includes('⿰⿱𠂹')
