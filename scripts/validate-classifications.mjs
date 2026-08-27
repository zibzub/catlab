import { promises as fs } from 'node:fs'
import path from 'node:path'
import { validateClassificationArtifact } from './lib/mooncat-classifications.mjs'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const ARTIFACT_PATH = path.join(ROOT, 'public/data/mooncat-classifications.json')

async function main() {
  const artifact = JSON.parse(await fs.readFile(ARTIFACT_PATH, 'utf8'))
  validateClassificationArtifact(artifact)
  console.log(
    `MoonCat classifications are valid: ${Object.keys(artifact.categories).length} ` +
      `sets covering ${artifact.count.toLocaleString()} rescue orders.`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
