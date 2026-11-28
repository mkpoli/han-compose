import { expect, test } from 'bun:test'
import { composerPreview } from '../src/index.js'
import { selectYao, yaoOccurrences } from '../src/yao-occurrences.js'
import { u26201Forms } from '../src/yao-forms.js'

test('𳅀 keeps its whole-glyph 率 drawing under both numbered spellings in every face', async () => {
  const [site] = yaoOccurrences('𳅀')
  for (const fontStyle of ['sans', 'serif', 'regular', 'fangsong', 'pen-writing']) {
    const draw = composerPreview({ base: '', separate: true, fontStyle })
    const paths = new Set()
    for (const form of u26201Forms) {
      const ids = selectYao('𳅀', site.path, form.id)
      const result = await draw(ids)
      expect(result.parts).toHaveLength(1)
      expect((await draw(ids.replace('{11}', '&X-00011;'))).d).toBe(result.d)
      paths.add(result.d)
    }
    expect(paths.size).toBe(3)
  }
})
