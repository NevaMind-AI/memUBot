import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

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
  const root = document.documentElement

  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}
