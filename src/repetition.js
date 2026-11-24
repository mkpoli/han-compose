// @ts-nocheck
import { componentDrawing, componentParts, componentRecord } from './component-forms.js'
export const REPETITION = '⿰冫⿱丿丶'
export const REPETITION_MIRRORED = '⿰冫⿾冫'
export const isRepetition = text => text === REPETITION || text === REPETITION_MIRRORED
export const containsRepetition = text => text.includes(REPETITION) || text.includes(REPETITION_MIRRORED)
export const repetitionInk = componentRecord(REPETITION).ink
export const repetitionRecord = { ...componentRecord(REPETITION), nl: 4 }
export const repetitionParts = (text, region, style) => isRepetition(text) ? componentParts(text, region, style) : null
export const repetitionDrawing = (text, style) => isRepetition(text) ? componentDrawing(text, style) : null
