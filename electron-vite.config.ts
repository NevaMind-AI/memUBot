import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

// Get flavor from environment variable, default to 'memu'
const flavor = process.env.APP_FLAVOR || 'memu'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      'process.env.APP_FLAVOR': JSON.stringify(flavor)
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define: {
      'process.env.APP_FLAVOR': JSON.stringify(flavor)
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    define: {
      'process.env.APP_FLAVOR': JSON.stringify(flavor)
    }
  }
})
