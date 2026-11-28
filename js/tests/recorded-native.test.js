import { expect, test } from 'bun:test'
import { recordedNativeGlyph } from '../src/recorded-native.js'

test('loads only exact outlines from the selected primary font', () => {
  const sans = recordedNativeGlyph('sans', '凫')
  const serif = recordedNativeGlyph('serif', '凫')
  expect(sans.contours.length).toBeGreaterThan(1)
  expect(serif.box).not.toEqual(sans.box)
  expect(recordedNativeGlyph('regular', '𡷊').contours.length).toBeGreaterThan(1)
  const pen = recordedNativeGlyph('pen-writing', '凸')
  expect(pen.contours.every(contour => contour.light.every((point, i) => point === contour.heavy[i]))).toBe(true)
  expect(recordedNativeGlyph('pen-writing', '𡷊')).toBeNull()
  expect(recordedNativeGlyph('fangsong', '𡷊')).toBeNull()
  expect(recordedNativeGlyph('sans', '鸟')).toBeNull()
})
