import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { createVariationRegistry } from '../src/variation-registry.js'
import { formatVariationSyntax, parseVariationSyntax } from '../src/variation-syntax.js'
import { variationProductFromJSON } from '../src/variation-product.js'
import { realizeVariation } from '../src/variation-expression.js'

const usage = `variation <show | pin | count | at INDEX | ids [INDEX] | detect IDS>
  --input FILE       Read a variant or space document (default: U+26201 example)
  --catalogue FILE   Read an array of families in JSON; may be repeated`

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    input: { type: 'string' }, catalogue: { type: 'string', multiple: true }, help: { type: 'boolean' },
  } })
  if (values.help) return usage
  const [action, argument] = positionals
  if (!['show', 'pin', 'count', 'at', 'ids', 'detect'].includes(action)) throw new Error(usage)
  const needsArg = action === 'at' || action === 'detect'
  if (positionals.length > 2 || (needsArg && argument === undefined) || (argument !== undefined && !needsArg && action !== 'ids')) {
    throw new Error(usage)
  }
  const families = []
  let document
  if (values.input) {
    document = parseVariationSyntax(readFileSync(values.input, 'utf8'))
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
  if (action === 'show') return formatVariationSyntax(document).trimEnd()
  if (!('dimensions' in document)) {
    if (action !== 'ids' || argument !== undefined) throw new Error('Expected a space document')
    return realizeVariation(document, families.length ? createVariationRegistry(families) : undefined)
  }
  const space = variationProductFromJSON(createVariationRegistry(families), document)
  if (action === 'count') return String(space.count)
  if (action === 'pin') return formatVariationSyntax(space.toJSON()).trimEnd()
  if (action === 'detect') {
    return JSON.stringify(space.detect(argument), (_, value) => typeof value === 'bigint' ? String(value) : value)
  }
  if (!/^\d+$/u.test(argument ?? '')) throw new Error('Expected a nonnegative decimal index')
  const design = space.at(BigInt(argument))
  return action === 'at' ? formatVariationSyntax(design).trimEnd() : realizeVariation(design)
}

try { console.log(await main()) } catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
