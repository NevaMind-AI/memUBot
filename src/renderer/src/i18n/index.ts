import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import zhCN from './locales/zh-CN.json'
import ja from './locales/ja.json'

const resources = {
  en: { translation: en },
  'zh-CN': { translation: zhCN },
  ja: { translation: ja }
}

// Get saved language from localStorage
const savedLanguage = localStorage.getItem('memu-language')

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage || undefined, // Use saved language or detect
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'memu-language',
      caches: ['localStorage']
    }
  })
  .then(() => {
    // Sync renderer language to main process settings after init completes
    // This ensures main-side i18n (agent rejection messages, etc.) uses the correct language
    const lang = i18n.language
    if (lang && window.settings?.save) {
      window.settings.save({ language: lang })
    }
  })

export default i18n

// Helper to change language
export const changeLanguage = (lng: string): void => {
  i18n.changeLanguage(lng)
  localStorage.setItem('memu-language', lng)
  // Sync to main process settings
  if (window.settings?.save) {
    window.settings.save({ language: lng })
  }
}

// Available languages
export const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' }
]
