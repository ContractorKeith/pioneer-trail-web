import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = join(root, 'public/assets/manifest.json')
const errors = []
const warnings = []

const exists = async (path) => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const text = (value) => typeof value === 'string' && value.trim().length > 0
const pathFromRoot = (value) => resolve(root, value)

const requireFields = (record, fields, label) => {
  for (const field of fields) {
    if (!text(record?.[field])) errors.push(`${label}: missing required field ${field}`)
  }
}

const checkPath = async (value, label) => {
  if (!text(value)) return
  if (!(await exists(pathFromRoot(value)))) errors.push(`${label}: missing path ${value}`)
}

const scanRuntimeForHotlinks = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await scanRuntimeForHotlinks(path)
      continue
    }
    if (!/\.(css|html|js|json|mjs|ts|tsx)$/.test(entry.name)) continue
    const body = await readFile(path, 'utf8')
    if (/https?:\/\//.test(body)) {
      errors.push(`runtime source contains a hotlinked URL: ${relative(root, path)}`)
    }
    if (/fetch\s*\(\s*[`'"]https?:\/\//.test(body)) {
      errors.push(`runtime source fetches a remote URL: ${relative(root, path)}`)
    }
  }
}

const manifest = await readJson(manifestPath)
requireFields(
  manifest,
  ['title', 'creator', 'license', 'licensePath', 'redistributionRequirements'],
  'manifest',
)
if (manifest.version !== 1)
  errors.push(`manifest: expected version 1, received ${manifest.version}`)
await checkPath(manifest.licensePath, 'manifest.licensePath')

const assets = Array.isArray(manifest.assets) ? manifest.assets : []
const dependencies = Array.isArray(manifest.dependencies) ? manifest.dependencies : []
if (!Array.isArray(manifest.assets)) errors.push('manifest.assets must be an array')
if (!Array.isArray(manifest.dependencies)) errors.push('manifest.dependencies must be an array')

const ids = new Set()
for (const [index, asset] of assets.entries()) {
  const label = `assets[${index}]`
  requireFields(
    asset,
    ['id', 'source', 'creator', 'license', 'localPath', 'redistributionRequirements'],
    label,
  )
  if (text(asset.id) && ids.has(asset.id)) errors.push(`duplicate asset id: ${asset.id}`)
  if (text(asset.id)) ids.add(asset.id)
  await checkPath(asset.localPath, `${label}.localPath`)
  await checkPath(asset.licensePath, `${label}.licensePath`)
  await checkPath(asset.entryPoint && asset.localPath, `${label}.entryPoint source`)
}

for (const [index, dependency] of dependencies.entries()) {
  const label = `dependencies[${index}]`
  requireFields(
    dependency,
    [
      'name',
      'source',
      'creator',
      'license',
      'localPath',
      'modifications',
      'redistributionRequirements',
    ],
    label,
  )
  await checkPath(dependency.localPath, `${label}.localPath`)
  await checkPath(dependency.upstreamLicensePath, `${label}.upstreamLicensePath`)
  for (const runtimePath of dependency.runtimePaths ?? [])
    await checkPath(runtimePath, `${label}.runtimePaths`)
  for (const bundledFile of dependency.bundledFiles ?? []) {
    const packageFile = join(root, 'node_modules', dependency.name, bundledFile)
    if (!(await exists(packageFile))) {
      warnings.push(
        `${label}: bundled package file not installed, skipped check (${dependency.name}/${bundledFile})`,
      )
    }
  }
  if (text(dependency.upstreamLicensePath) && text(dependency.localPath)) {
    const upstream = pathFromRoot(dependency.upstreamLicensePath)
    const bundled = pathFromRoot(dependency.localPath)
    if ((await exists(upstream)) && (await exists(bundled))) {
      const [source, copy] = await Promise.all([readFile(upstream), readFile(bundled)])
      if (!source.equals(copy))
        errors.push(
          `${label}: ${dependency.localPath} is not a verbatim copy of ${dependency.upstreamLicensePath}`,
        )
    } else if (!(await exists(upstream))) {
      warnings.push(
        `${label}: upstream license not installed, skipped byte comparison (${dependency.upstreamLicensePath})`,
      )
    }
  }
}

if (manifest.reference)
  await checkPath(manifest.reference.localPath, 'manifest.reference.localPath')
await scanRuntimeForHotlinks(join(root, 'src'))

if (warnings.length) for (const warning of warnings) console.warn(`WARN ${warning}`)
if (errors.length) {
  for (const error of errors) console.error(`ERROR ${error}`)
  process.exitCode = 1
} else {
  console.log(
    `Asset manifest OK: ${assets.length} authored/data entries, ${dependencies.length} runtime dependencies, no runtime hotlinks.`,
  )
}
