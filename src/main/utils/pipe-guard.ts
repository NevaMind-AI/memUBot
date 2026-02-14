/**
 * Pipe Guard - Prevents EPIPE crashes in packaged Electron apps
 *
 * When Electron apps are launched from macOS Finder (or Windows Start Menu),
 * stdout/stderr may not have a valid pipe. Any write to these streams
 * (e.g. console.log) will throw "Error: write EPIPE" and crash the app.
 *
 * This module silently swallows EPIPE errors on stdout/stderr while
 * re-throwing all other errors so they are not masked.
 *
 * Must be called as early as possible — before ANY console.log or import
 * that might write to stdout.
 */

let installed = false

export function installPipeGuard(): void {
  if (installed) return
  installed = true

  const handlePipeError = (err: NodeJS.ErrnoException): void => {
    if (err.code === 'EPIPE') return
    throw err
  }

  process.stdout?.on('error', handlePipeError)
  process.stderr?.on('error', handlePipeError)
}
