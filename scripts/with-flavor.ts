/**
 * Run a command with a specific flavor
 * Usage: tsx scripts/with-flavor.ts <flavor> <command> [args...]
 * Example: tsx scripts/with-flavor.ts memu dev
 *          tsx scripts/with-flavor.ts memu build:mac
 */

import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

function getAvailableFlavors(): string[] {
  const flavorsDir = path.join(projectRoot, 'flavors')
  if (!fs.existsSync(flavorsDir)) {
    return []
  }
  
  return fs.readdirSync(flavorsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .filter(dirent => fs.existsSync(path.join(flavorsDir, dirent.name, 'config.ts')))
    .map(dirent => dirent.name)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    const flavors = getAvailableFlavors()
    console.error('Usage: tsx scripts/with-flavor.ts <flavor> <command> [args...]')
    console.error('')
    console.error('Available flavors:', flavors.length > 0 ? flavors.join(', ') : '(none)')
    console.error('')
    console.error('Examples:')
    console.error('  tsx scripts/with-flavor.ts memu dev')
    console.error('  tsx scripts/with-flavor.ts memu build')
    console.error('  tsx scripts/with-flavor.ts memu build:mac')
    process.exit(1)
  }
  
  const [flavor, command, ...restArgs] = args
  
  // Validate flavor exists
  const flavorConfigPath = path.join(projectRoot, 'flavors', flavor, 'config.ts')
  if (!fs.existsSync(flavorConfigPath)) {
    const flavors = getAvailableFlavors()
    console.error(`Error: Flavor "${flavor}" not found.`)
    console.error('Available flavors:', flavors.length > 0 ? flavors.join(', ') : '(none)')
    process.exit(1)
  }
  
  console.log(`[Flavor] Running with flavor: ${flavor}`)
  console.log(`[Flavor] Command: npm run ${command} ${restArgs.join(' ')}`)
  console.log('')
  
  // Set environment variable and run the command
  const env = {
    ...process.env,
    APP_FLAVOR: flavor
  }
  
  await new Promise<void>((resolve, reject) => {
    const child = spawn('npm', ['run', command, ...restArgs], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env
    })
    
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed with exit code ${code}`))
    })
  })
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
