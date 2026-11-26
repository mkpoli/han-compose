// Current and retired RCC claims can preserve spellings absent from the Bai IDS catalogue.
import catalogue from '../src/recorded-chains.json' with { type: 'json' }
import evidence from '../../data/rcc-chain-evidence.json' with { type: 'json' }
import { rccDonors } from '../src/rcc-forms.js'
import { parseDescription } from '../src/tree.js'

const chains = new Set(Object.keys(catalogue.chains))
const ids = new Set()
for (const record of evidence.records) {
  if (record.primary_ids && rccDonors(record.primary_ids, 'sans').length) ids.add(record.primary_ids)
  for (const claim of [...record.claims, ...record.historical_claims]) {
    ids.add(claim.ids)
    for (const chain of claim.chains) chains.add(chain)
  }
}
export const spellings = [...chains]
export const contexts = [...ids]

// A source can preserve a truncated IDS. Report the literal and its syntax
// error independently of a missing outline or an exception in a font export.
export const malformed = new Map()
for (const raw of contexts) {
  try {
    parseDescription(raw)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
    malformed.set(raw, error.message)
  }
}
