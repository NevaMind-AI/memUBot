import 'dotenv/config'

import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  return path.resolve(__dirname, '..')
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

function parseModeArg(): string {
  // Support: tsx build-win.ts --mode memu  OR  tsx build-win.ts memu
  const args = process.argv.slice(2)
  const modeIdx = args.indexOf('--mode')
  if (modeIdx !== -1 && args[modeIdx + 1]) return args[modeIdx + 1]
  // First non-flag argument
  const positional = args.find((a) => !a.startsWith('--'))
  return positional || process.env.APP_MODE || 'memu'
}

async function main(): Promise<void> {
  const root = getProjectRoot()
  const mode = parseModeArg()
  // Ensure APP_MODE is set for child processes (prepare-mode reads it)
  process.env.APP_MODE = mode

  console.log(`Building for Windows (mode: ${mode})...`)

  // Prepare mode resources
  console.log('\n[1/3] Preparing mode resources...')
  await run('npm', ['run', 'prepare-mode'], root)

  // Run electron-vite build with mode
  console.log('\n[2/3] Building with electron-vite...')
  await run('npx', ['electron-vite', 'build', '--mode', mode], root)

  // Run electron-builder with mode config
  console.log('\n[3/3] Packaging with electron-builder...')
  const modeConfigPath = path.join(root, 'electron-builder.mode.json')

  // Use mode config if it exists (it extends the base config)
  const builderArgs = fs.existsSync(modeConfigPath)
    ? ['electron-builder', '--win', '--config', 'electron-builder.mode.json']
    : ['electron-builder', '--win']

  await run('npx', builderArgs, root)

  console.log('\nBuild complete.')
}

main().catch((err) => {
  console.error('\nBuild failed:')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
