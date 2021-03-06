import { outputJson } from 'fs-extra'
import { resolve } from 'path'
import { assoc, keys, reduce } from 'ramda'

import log from '../../logger'
import { getManifest } from '../../manifest'

const PREFIX = 'npm:'
const npmReducer = dependencies => (acc: {}, k: string): {} =>
  k.startsWith(PREFIX) ? assoc(k.replace(PREFIX, ''), dependencies[k], acc) : acc
const vtexReducer = dependencies => (acc: {}, k: string): {} =>
  k.startsWith(PREFIX) ? acc : assoc(k, dependencies[k], acc)

export default async () => {
  const manifest = await getManifest()
  const pkg = {
    ...manifest,
    version: null,
    vtexVersion: manifest.version,
    dependencies: reduce(npmReducer(manifest.dependencies), {}, keys(manifest.dependencies).sort()),
    vtexDependencies: reduce(vtexReducer(manifest.dependencies), {}, keys(manifest.dependencies).sort()),
  }
  log.debug('Generating package:', JSON.stringify(pkg, null, 2))
  await outputJson(resolve(process.cwd(), 'package.json'), pkg, { spaces: 2 })
  log.info('Generated package.json successfully.')
}
