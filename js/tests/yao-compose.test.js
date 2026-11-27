import { expect, test } from 'bun:test'
import { composerPreview } from '../src/index.js'
import { u26201Forms } from '../src/yao-forms.js'

test('canonical 幺 forms and their source spellings draw standalone and at either operand', async () => {
  const draw = composerPreview({ base: '', separate: true })
  const paths = new Set()
  const siblings = new Set()
  for (const form of u26201Forms) {
    const canonical = await draw(form.text)
    paths.add(canonical.d)
    expect(canonical.parts).toHaveLength(1)
    for (const alias of form.aliases) expect((await draw(alias)).d).toBe(canonical.d)
    const compound = await draw('⿰' + form.text + u26201Forms[0].text)
    expect(compound.parts).toHaveLength(2)
    siblings.add(compound.parts[1].d)
  }
  expect(paths.size).toBe(3)
  expect(siblings.size).toBe(1)
})
