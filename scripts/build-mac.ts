import 'dotenv/config'

import path from 'node:path'
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
      shell: false,
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

  console.log('Building memU bot for macOS...')
  console.log(`Apple ID: ${process.env.APPLE_ID ? 'configured' : 'not set'}`)
  console.log(`Team ID: ${process.env.APPLE_TEAM_ID ? 'configured' : 'not set'}`)

  // Run electron-vite build
  await run('npm', ['run', 'build'], root)

  // Run electron-builder
  await run('npx', ['electron-builder', '--mac'], root)

  console.log('\nBuild complete.')
}

main().catch((err) => {
  console.error('\nBuild failed:')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
