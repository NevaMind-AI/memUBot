/**
 * Lightweight i18n for the main process.
 * Reuses the same locale JSON files as the renderer (i18next).
 * Supports simple {{key}} interpolation.
 */

import en from '../../renderer/src/i18n/locales/en.json'
import zhCN from '../../renderer/src/i18n/locales/zh-CN.json'
import ja from '../../renderer/src/i18n/locales/ja.json'
import { loadSettings } from '../config/settings.config'

type LocaleData = Record<string, unknown>

const locales: Record<string, LocaleData> = {
  en,
  'zh-CN': zhCN,
  ja
}

/**
 * Resolve a dot-separated key (e.g. "agent.busySamePlatform") from a locale object.
 */
function resolve(data: LocaleData, key: string): string | undefined {
  const parts = key.split('.')
  let current: unknown = data
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

/**
 * Translate a key using the user's configured language.
 * Falls back to English if the key is missing in the target locale.
 *
 * @param key - Dot-separated locale key (e.g. "agent.busySamePlatform")
 * @param params - Optional interpolation values for {{key}} placeholders
 */
export async function t(key: string, params?: Record<string, string>): Promise<string> {
  const settings = await loadSettings()
  const lang = settings.language || 'en'

  // Try exact match, then language prefix, then fallback to English
  const locale = locales[lang] || locales[lang.split('-')[0]] || locales.en
  let text = resolve(locale, key) ?? resolve(locales.en, key) ?? key

  // Simple interpolation: replace {{varName}} with params
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v)
    }
  }

  return text
}
