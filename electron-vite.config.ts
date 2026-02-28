import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  console.log(`[electron-vite] Mode: ${mode}`)
  
  // electron-vite automatically loads .env.[mode] files
  // Environment variables are exposed based on prefix:
  // - MAIN_VITE_* -> main process (import.meta.env.MAIN_VITE_*)
  // - PRELOAD_VITE_* -> preload scripts
  // - RENDERER_VITE_* or VITE_* -> renderer process
  
  return {
    main: {
      plugins: [externalizeDepsPlugin()]
    },
    preload: {
      plugins: [externalizeDepsPlugin()]
    },
    renderer: {
      resolve: {
        alias: {
          '@renderer': resolve('src/renderer/src')
        }
      },
      plugins: [react()]
    }
  }
})
