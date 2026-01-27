import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type { ProxyConfig } from '../apps/types'

const CONFIG_FILE = 'proxy-config.json'

// Default proxy configuration
const defaultConfig: ProxyConfig = {
  enabled: false,
  type: 'socks5',
  host: '127.0.0.1',
  port: 1080,
  username: undefined,
  password: undefined
}

/**
 * Get the config file path
 */
function getConfigPath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, CONFIG_FILE)
}

/**
 * Load proxy configuration from file
 */
export async function loadProxyConfig(): Promise<ProxyConfig> {
  try {
    const configPath = getConfigPath()
    const content = await fs.readFile(configPath, 'utf-8')
    const config = JSON.parse(content) as ProxyConfig
    return { ...defaultConfig, ...config }
  } catch {
    // Return default config if file doesn't exist
    return defaultConfig
  }
}

/**
 * Save proxy configuration to file
 */
export async function saveProxyConfig(config: ProxyConfig): Promise<void> {
  const configPath = getConfigPath()
  const dir = path.dirname(configPath)

  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

/**
 * Build proxy URL from config
 */
export function buildProxyUrl(config: ProxyConfig): string | undefined {
  if (!config.enabled) {
    return undefined
  }

  let url = `${config.type}://`

  if (config.username && config.password) {
    url += `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@`
  }

  url += `${config.host}:${config.port}`

  return url
}
