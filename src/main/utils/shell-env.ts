import { execSync } from 'child_process'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

let cachedPath: string | null = null

/**
 * Get enhanced PATH for spawned processes
 * Packaged Electron apps don't inherit terminal PATH, so we need to manually add common node paths
 * This should be called once at app startup
 */
export function getEnhancedPath(): string {
  if (cachedPath) {
    return cachedPath
  }

  const currentPath = process.env.PATH || ''
  const homeDir = os.homedir()
  
  // Common paths where node/npm/npx might be installed
  const additionalPaths = [
    '/usr/local/bin',                          // Homebrew on Intel Mac
    '/opt/homebrew/bin',                       // Homebrew on Apple Silicon
    `${homeDir}/.volta/bin`,                   // Volta
    '/usr/bin',
    '/bin'
  ]
  
  // Try to get nvm current node path
  try {
    const nvmDir = process.env.NVM_DIR || `${homeDir}/.nvm`
    const nvmNodeVersions = `${nvmDir}/versions/node`
    
    // Try to find default node version from nvm alias
    const defaultAliasPath = path.join(nvmDir, 'alias', 'default')
    try {
      if (fs.existsSync(defaultAliasPath)) {
        const nodeVersion = fs.readFileSync(defaultAliasPath, 'utf8').trim()
        const nodeBinPath = path.join(nvmNodeVersions, nodeVersion, 'bin')
        if (fs.existsSync(nodeBinPath)) {
          additionalPaths.unshift(nodeBinPath)
        }
      }
    } catch {
      // Try to find any node version
      try {
        if (fs.existsSync(nvmNodeVersions)) {
          const versions = fs.readdirSync(nvmNodeVersions).filter(v => v.startsWith('v'))
          if (versions.length > 0) {
            // Use the latest version
            const latestVersion = versions.sort().pop()
            const nodeBinPath = path.join(nvmNodeVersions, latestVersion!, 'bin')
            if (fs.existsSync(nodeBinPath)) {
              additionalPaths.unshift(nodeBinPath)
            }
          }
        }
      } catch {
        // nvm not installed or no versions
      }
    }
  } catch {
    // Ignore nvm detection errors
  }
  
  // Try to get path from shell (works when shell is available)
  // This is the most reliable method as it gets the actual user's PATH
  try {
    const shell = process.env.SHELL || '/bin/zsh'
    const shellPath = execSync(`${shell} -ilc 'echo $PATH'`, { 
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()
    
    if (shellPath && shellPath.length > 0) {
      console.log('[Shell Env] Got PATH from shell')
      cachedPath = shellPath
      return cachedPath
    }
  } catch (error) {
    console.log('[Shell Env] Could not get PATH from shell, using fallback')
  }
  
  // Combine paths, removing duplicates
  const allPaths = Array.from(new Set([...additionalPaths, ...currentPath.split(':')]))
  cachedPath = allPaths.filter(p => p).join(':')
  
  return cachedPath
}

/**
 * Initialize shell environment
 * Should be called once at app startup, before any external processes are spawned
 */
export function initializeShellEnv(): void {
  console.log('[Shell Env] Initializing shell environment...')
  
  const enhancedPath = getEnhancedPath()
  process.env.PATH = enhancedPath
  
  // Log first few paths for debugging
  const pathParts = enhancedPath.split(':').slice(0, 6)
  console.log('[Shell Env] PATH set to:', pathParts.join(':'), '...')
  
  // Verify npx is accessible
  try {
    const npxPath = execSync('which npx', { 
      encoding: 'utf8',
      timeout: 2000,
      env: { ...process.env, PATH: enhancedPath }
    }).trim()
    console.log('[Shell Env] npx found at:', npxPath)
  } catch {
    console.warn('[Shell Env] Warning: npx not found in PATH')
  }
}
