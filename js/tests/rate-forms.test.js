import { expect, test } from 'bun:test'
import { rateFormsFor, rateHosts } from '../src/rate-forms.js'
import { rateDrawing } from '../src/rate-drawing.js'
import { Composer } from '../src/compose.js'
import { commands, svgPath } from '../src/geometry.js'
import regular from '../data/rate-forms/regular.json' with { type: 'json' }
import { onlyBundled } from '../src/local.js'
import { constants, records } from './fixtures/small-export.js'

const store = {manifest:{constants, spelled:[]}, rec:key=>records[key], hosts:()=>[], places:()=>[], layout:null}
test('all 37 hosts round-trip through four selectable IDS forms and each face draws them', () => {
  expect(rateHosts.length).toBe(37)
  for (const host of rateHosts) {
    const forms = rateFormsFor(host)
    for (const form of forms) expect(rateFormsFor(form.text)).toBe(forms)
    for (const style of ['regular','sans','serif','fangsong','pen-writing']) {
      const composer = new Composer(store,{fontStyle:style,separate:true})
      const paths = forms.map(({text}) => {
        expect(onlyBundled(text,true,false,style)).toBe(true)
        const d = svgPath(composer.compose(text))
        expect(d).toBe(rateDrawing(text,style))
        return d
      })
      expect(new Set(paths).size).toBe(4)
    }
  }
  expect(rateFormsFor('木')).toEqual([])
  expect(rateFormsFor('蟀󠄀')).toBe(rateFormsFor('蟀'))
})
test('one nested choice leaves its sibling independently selectable', () => {
  const c = new Composer(store,{fontStyle:'serif'})
  const [first,second] = rateFormsFor('𳅀')
  const a = svgPath(c.compose('⿰'+first.text+second.text))
  const b = svgPath(c.compose('⿰'+second.text+second.text))
  expect(a).not.toEqual(b)
})

test('every spelling owns one editable subtree and leaves its sibling in place', async () => {
  const { compose, sketch } = await import('../src/loader.js')
  const { sourceFor } = await import('../src/source.js')
  const { groupParts } = await import('../src/group-parts.js')
  for (const host of ['率', '蟀', '𳅀']) {
    const forms = rateFormsFor(host)
    for (const operator of ['⿰', '⿱']) {
      const boxes = []
      for (const form of forms) {
        const text = operator + form.text + forms[0].text
        const source = sourceFor(text)
        const { parts } = await compose(source, text, { separate: true })
        const leaves = await sketch(source, text)
        expect(groupParts(parts, leaves)?.map(group => group.parts)).toEqual([[0], [1]])
        boxes.push(parts[1].box)
      }
      expect(boxes).toEqual(Array(4).fill(boxes[0]))
    }
  }
})

test('each 正楷 contour consumes all of its control points', () => {
  for (const [ops, coordinates] of regular.contours) {
    const points = commands(ops).reduce((sum, [, count]) => sum + count, 0)
    expect(coordinates.split(' ').length).toBe(2 * points)
  }
})
