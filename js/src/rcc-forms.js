import { rccChainContextParts, rccChainDonors } from './rcc-chain-contexts.js'
import { numeralDonors, numeralParts } from './rcc-numerals.js'
import { overlayContextDonors, overlayContextParts } from './rcc-overlays.js'
import { k5Donors, k5Parts } from './k5h00030.js'

/** @param {string} key @param {string} style */
export const rccDonors = (key, style) => [...rccChainDonors(key, style), ...k5Donors(key), ...numeralDonors(key, style), ...overlayContextDonors(key, style)]

/** @param {import('./compose.js').Composer} composer @param {string} key @param {number[]} region */
export const rccParts = (composer, key, region) => rccChainContextParts(composer, key, region) ?? k5Parts(composer, key, region) ?? numeralParts(composer, key, region) ?? overlayContextParts(composer, key, region)
