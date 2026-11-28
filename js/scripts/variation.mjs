import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { archiveVariation, openVariationArchive } from '../src/variation-archive.js'
import { createVariationRegistry } from '../src/variation-registry.js'
import { formatVariationSyntax, parseVariationSyntax } from '../src/variation-syntax.js'
import { variationBranchesFromJSON } from '../src/variation-branches.js'
import { variationProductFromJSON } from '../src/variation-product.js'
import { realizeVariation } from '../src/variation-expression.js'

const usage = `variation <show | pin | archive | count | at INDEX | ids [INDEX] | detect IDS>
  --input FILE       Read a variant, space or JSON archive (default: U+26201 example)
  --catalogue FILE   Read an array of families in JSON; may be repeated`

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    input: { type: 'string' }, catalogue: { type: 'string', multiple: true }, help: { type: 'boolean' },
  } })
  if (values.help) return usage
  const [action, argument] = positionals
  if (!['show', 'pin', 'archive', 'count', 'at', 'ids', 'detect'].includes(action)) throw new Error(usage)
  const needsArg = action === 'at' || action === 'detect'
  if (positionals.length > 2 || (needsArg && argument === undefined) || (argument !== undefined && !needsArg && action !== 'ids')) {
    throw new Error(usage)
  }
  const families = []
  let document
  if (values.input) {
    const input = readFileSync(values.input, 'utf8')
    if (input.trimStart().startsWith('{')) {
      const saved = openVariationArchive(JSON.parse(input))
      document = saved.document
      families.push(...saved.registry.families)
    } else document = parseVariationSyntax(input)
  } else {
    const { family, expression, sites } = await import('../examples/variation-expression/u26201.js')
    document = { version: 1, expression, dimensions: sites }
    families.push(family)
  }
  for (const file of values.catalogue ?? []) {
    const records = JSON.parse(readFileSync(file, 'utf8'))
    if (!Array.isArray(records)) throw new Error('Expected an array of catalogue families in ' + file)
    families.push(...records)
  }
  const branched = 'branches' in document
  if (action === 'show') return branched ? JSON.stringify(document) : formatVariationSyntax(document).trimEnd()
  const registry = createVariationRegistry(families)
  if (action === 'archive') return JSON.stringify(archiveVariation(registry, document))
  if (!branched && !('dimensions' in document)) {
    if (action !== 'ids' || argument !== undefined) throw new Error('Expected a space document')
    return realizeVariation(document, families.length ? registry : undefined)
  }
  const space = branched ? variationBranchesFromJSON(registry, document) : variationProductFromJSON(registry, document)
  if (action === 'count') return String(space.count)
  if (action === 'pin') return branched ? JSON.stringify(archiveVariation(registry, space.toJSON())) : formatVariationSyntax(space.toJSON()).trimEnd()
  if (action === 'detect') {
    return JSON.stringify(space.detect(argument), (_, value) => typeof value === 'bigint' ? String(value) : value)
  }
  if (!/^\d+$/u.test(argument ?? '')) throw new Error('Expected a nonnegative decimal index')
  const selected = space.at(BigInt(argument))
  const design = branched ? selected.expression : selected
  return action === 'at' ? formatVariationSyntax(design).trimEnd() : realizeVariation(design)
}

try { console.log(await main()) } catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
