import 'dotenv/config'

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  return path.resolve(__dirname, '..')
}

function parseModeArg(): string {
  const args = process.argv.slice(2)
  const modeIdx = args.indexOf('--mode')
  if (modeIdx !== -1 && args[modeIdx + 1]) return args[modeIdx + 1]
  const positional = args.find((a) => !a.startsWith('--'))
  return positional || process.env.APP_MODE || 'memu'
}

async function run(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: process.env
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed: ${command} ${args.join(' ')} (exit ${code})`))
    })
  })
}

async function main(): Promise<void> {
  const root = getProjectRoot()
  const mode = parseModeArg()
  process.env.APP_MODE = mode

  console.log(`Building (mode: ${mode})...`)

  // Prepare mode resources
  console.log('\n[1/2] Preparing mode resources...')
  await run('npm', ['run', 'prepare-mode'], root)

  // Run electron-vite build with mode
  console.log('\n[2/2] Building with electron-vite...')
  await run('npx', ['electron-vite', 'build', '--mode', mode], root)

  console.log('\nBuild complete.')
}

main().catch((err) => {
  console.error('\nBuild failed:')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
