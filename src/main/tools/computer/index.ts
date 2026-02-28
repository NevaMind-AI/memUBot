/**
 * Computer tools - unified entry point
 * Automatically selects platform-specific implementations
 */

import * as macos from './macos'
import * as windows from './windows'
import {
  isWindows,
  takeScreenshot,
  truncateOutput,
  executeBashTool,
  executeTextEditorTool,
  executeDownloadFileTool,
  executeWebSearchTool,
  getScaleFactor
} from './common'

// Re-export common utilities
export {
  truncateOutput,
  executeBashTool,
  executeTextEditorTool,
  executeDownloadFileTool,
  executeWebSearchTool
}

/**
 * Platform-specific input control module
 */
const inputControl = isWindows ? windows : macos

/**
 * Transform coordinates from Claude's scaled image space to actual screen coordinates
 * @param x X coordinate from Claude
 * @param y Y coordinate from Claude
 * @returns Transformed coordinates for the actual screen
 */
function transformCoordinates(x: number, y: number): [number, number] {
  const scaleFactor = getScaleFactor()
  const screenX = Math.round(x * scaleFactor)
  const screenY = Math.round(y * scaleFactor)

  if (scaleFactor !== 1.0) {
    console.log(
      '[Computer] Coordinate transform:',
      `(${x}, ${y})`,
      '->',
      `(${screenX}, ${screenY})`,
      '(factor:',
      scaleFactor.toFixed(3),
      ')'
    )
  }

  return [screenX, screenY]
}

/**
 * Move mouse to coordinates (internal, expects already-transformed coordinates)
 */
async function moveMouseRaw(x: number, y: number): Promise<void> {
  return inputControl.moveMouse(x, y)
}

/**
 * Click mouse button
 */
async function click(button: 'left' | 'right'): Promise<void> {
  return inputControl.click(button)
}

/**
 * Double click
 */
async function doubleClick(): Promise<void> {
  return inputControl.doubleClick()
}

/**
 * Type text
 */
async function typeText(text: string): Promise<void> {
  return inputControl.typeText(text)
}

/**
 * Press a key or key combination
 */
async function pressKey(keyStr: string): Promise<void> {
  return inputControl.pressKey(keyStr)
}

/**
 * Scroll mouse wheel
 */
async function scroll(direction: 'up' | 'down', amount: number): Promise<void> {
  return inputControl.scroll(direction, amount)
}

/**
 * Execute computer tool actions
 */
export async function executeComputerTool(input: {
  action: string
  coordinate?: [number, number]
  text?: string
  scroll_direction?: 'up' | 'down'
  scroll_amount?: number
}): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (input.action) {
      case 'screenshot':
        return await takeScreenshot()

      case 'mouse_move':
        if (!input.coordinate) {
          return { success: false, error: 'coordinate is required for mouse_move' }
        }
        {
          const [screenX, screenY] = transformCoordinates(input.coordinate[0], input.coordinate[1])
          await inputControl.moveMouse(screenX, screenY)
          return {
            success: true,
            data: `Mouse moved to (${screenX}, ${screenY}) [from Claude: (${input.coordinate[0]}, ${input.coordinate[1]})]`
          }
        }

      case 'left_click':
        {
          let clickMsg = 'Left click performed'
          if (input.coordinate) {
            const [screenX, screenY] = transformCoordinates(input.coordinate[0], input.coordinate[1])
            await moveMouseRaw(screenX, screenY)
            clickMsg = `Left click at (${screenX}, ${screenY}) [from Claude: (${input.coordinate[0]}, ${input.coordinate[1]})]`
          }
          await click('left')
          return { success: true, data: clickMsg }
        }

      case 'right_click':
        {
          let clickMsg = 'Right click performed'
          if (input.coordinate) {
            const [screenX, screenY] = transformCoordinates(input.coordinate[0], input.coordinate[1])
            await moveMouseRaw(screenX, screenY)
            clickMsg = `Right click at (${screenX}, ${screenY}) [from Claude: (${input.coordinate[0]}, ${input.coordinate[1]})]`
          }
          await click('right')
          return { success: true, data: clickMsg }
        }

      case 'double_click':
        {
          let clickMsg = 'Double click performed'
          if (input.coordinate) {
            const [screenX, screenY] = transformCoordinates(input.coordinate[0], input.coordinate[1])
            await moveMouseRaw(screenX, screenY)
            clickMsg = `Double click at (${screenX}, ${screenY}) [from Claude: (${input.coordinate[0]}, ${input.coordinate[1]})]`
          }
          await doubleClick()
          return { success: true, data: clickMsg }
        }

      case 'type':
        if (!input.text) {
          return { success: false, error: 'text is required for type action' }
        }
        await typeText(input.text)
        return { success: true, data: `Typed: ${input.text}` }

      case 'key':
        if (!input.text) {
          return { success: false, error: 'text is required for key action' }
        }
        await pressKey(input.text)
        return { success: true, data: `Key pressed: ${input.text}` }

      case 'scroll':
        const amount = input.scroll_amount || 5
        const direction = input.scroll_direction || 'down'
        await scroll(direction, amount)
        return { success: true, data: `Scrolled ${direction} by ${amount}` }

      default:
        return { success: false, error: `Unknown action: ${input.action}` }
    }
  } catch (error) {
    console.error('[Computer] Error:', error)
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
