import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'
export type AppMode = 'memu' | 'yumi'

interface ThemeStore {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => set({ mode })
    }),
    {
      name: 'theme-storage'
    }
  )
)

// Get app mode from environment
export function getAppMode(): AppMode {
  const mode = import.meta.env.VITE_APP_MODE || 'memu'
  return mode as AppMode
}

// Helper to get actual theme based on mode
export function getActualTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

// Apply theme to document
export function applyTheme(mode: ThemeMode): void {
  const theme = getActualTheme(mode)
  const appMode = getAppMode()
  const root = document.documentElement

  // Apply dark/light theme
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  // Apply app mode theme (memu or yumi)
  root.classList.remove('memu', 'yumi')
  if (appMode === 'yumi') {
    root.classList.add('yumi')
  }
}
