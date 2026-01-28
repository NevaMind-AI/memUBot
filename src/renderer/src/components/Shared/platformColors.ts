import { ThemeColors } from './MessageBubble'

/**
 * Platform theme colors configuration
 */
export const platformColors: Record<string, ThemeColors> = {
  telegram: {
    primary: '#2596D1',
    primaryLight: '#7DCBF7',
    primaryDark: '#7DCBF7',
    secondary: '#64748b',
    secondaryDark: '#94a3b8'
  },
  discord: {
    primary: '#5865F2',
    primaryLight: '#7289DA',
    primaryDark: '#a5b4fc',
    secondary: '#9B84EE',
    secondaryDark: '#c4b5fd'
  },
  slack: {
    primary: '#611f69',
    primaryLight: '#8b4f99',
    primaryDark: '#e0b3e6',
    secondary: '#8b4f99',
    secondaryDark: '#d4a5d9'
  },
  whatsapp: {
    primary: '#25D366',
    primaryLight: '#128C7E',
    primaryDark: '#4ade80',
    secondary: '#128C7E',
    secondaryDark: '#2dd4bf'
  },
  line: {
    primary: '#00B900',
    primaryLight: '#00C300',
    primaryDark: '#4ade80',
    secondary: '#00C300',
    secondaryDark: '#86efac'
  }
}
