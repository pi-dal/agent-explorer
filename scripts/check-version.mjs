import { readFile } from 'node:fs/promises'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const tauriConfig = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'))
const cargoToml = await readFile(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8')
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1]

const versions = {
  'package.json': packageJson.version,
  'src-tauri/tauri.conf.json': tauriConfig.version,
  'src-tauri/Cargo.toml': cargoVersion,
}
const unique = new Set(Object.values(versions))

if (unique.size !== 1 || unique.has(undefined)) {
  console.error('Application versions do not match:')
  for (const [file, version] of Object.entries(versions)) {
    console.error(`  ${file}: ${version ?? 'missing'}`)
  }
  process.exit(1)
}

const version = packageJson.version
const expected = process.env.EXPECTED_VERSION?.replace(/^v/, '')
if (expected && version !== expected) {
  console.error(`Release tag version ${expected} does not match application version ${version}`)
  process.exit(1)
}

console.log(`Application version ${version} is consistent`)
