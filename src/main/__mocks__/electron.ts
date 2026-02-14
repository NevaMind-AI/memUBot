/**
 * Electron mock for Vitest
 * Provides stub implementations for Electron APIs used in tools
 */

import { vi } from 'vitest'

export const app = {
  getPath: vi.fn((name: string) => `/mock/${name}`),
  getAppPath: vi.fn(() => '/mock/app'),
  getName: vi.fn(() => 'memu-bot-test'),
  getVersion: vi.fn(() => '1.0.0-test')
}

export const screen = {
  getPrimaryDisplay: vi.fn(() => ({
    size: { width: 1920, height: 1080 },
    scaleFactor: 2,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 }
  }))
}

export const nativeImage = {
  createFromBuffer: vi.fn((buffer: Buffer) => ({
    getSize: () => ({ width: 1920, height: 1080 }),
    resize: vi.fn(({ width, height }: { width: number; height: number }) => ({
      getSize: () => ({ width, height }),
      toPNG: () => buffer
    })),
    toPNG: () => buffer
  }))
}

export const BrowserWindow = vi.fn()
export const ipcMain = {
  on: vi.fn(),
  handle: vi.fn()
}

export default {
  app,
  screen,
  nativeImage,
  BrowserWindow,
  ipcMain
}
