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

async function main(): Promise<void> {
  const root = getProjectRoot()
  const mode = parseModeArg()

  console.log(`Starting dev server (mode: ${mode})...`)

  // Set APP_MODE for the child process
  process.env.APP_MODE = mode

  // Run electron-vite dev with mode
  const child = spawn('npx', ['electron-vite', 'dev', '--mode', mode], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env
  })

  child.on('exit', (code) => {
    process.exit(code ?? 0)
  })
}

main().catch((err) => {
  console.error('Dev server failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
