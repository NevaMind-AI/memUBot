/**
 * macOS-specific mouse and keyboard control implementation
 * Uses cliclick and Python/Quartz (CoreGraphics)
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Move mouse to coordinates using cliclick or Python/Quartz
 */
export async function moveMouse(x: number, y: number): Promise<void> {
  // Try cliclick first (faster and more reliable)
  try {
    await execAsync(`cliclick m:${Math.round(x)},${Math.round(y)}`)
    return
  } catch {
    // Fall back to AppleScript via Python (CoreGraphics)
  }

  // Use Python with Quartz (CoreGraphics) - built into macOS
  const script = `
import Quartz
Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, (${x}, ${y}), Quartz.kCGMouseButtonLeft))
`
  await execAsync(`python3 -c "${script}"`)
}

/**
 * Click using cliclick or Python/Quartz
 */
export async function click(button: 'left' | 'right'): Promise<void> {
  // Try cliclick first
  try {
    const cmd = button === 'left' ? 'c:.' : 'rc:.'
    await execAsync(`cliclick ${cmd}`)
    return
  } catch {
    // Fall back to Python
  }

  const buttonType = button === 'left' ? 'kCGMouseButtonLeft' : 'kCGMouseButtonRight'
  const downEvent = button === 'left' ? 'kCGEventLeftMouseDown' : 'kCGEventRightMouseDown'
  const upEvent = button === 'left' ? 'kCGEventLeftMouseUp' : 'kCGEventRightMouseUp'

  const script = `
import Quartz
import time
loc = Quartz.CGEventGetLocation(Quartz.CGEventCreate(None))
Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.${downEvent}, loc, Quartz.${buttonType}))
time.sleep(0.05)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.${upEvent}, loc, Quartz.${buttonType}))
`
  await execAsync(`python3 -c "${script}"`)
}

/**
 * Double click using cliclick or Python/Quartz
 */
export async function doubleClick(): Promise<void> {
  // Try cliclick first
  try {
    await execAsync('cliclick dc:.')
    return
  } catch {
    // Fall back to Python
  }

  const script = `
import Quartz
import time
loc = Quartz.CGEventGetLocation(Quartz.CGEventCreate(None))
for _ in range(2):
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, loc, Quartz.kCGMouseButtonLeft))
    time.sleep(0.02)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, loc, Quartz.kCGMouseButtonLeft))
    time.sleep(0.02)
`
  await execAsync(`python3 -c "${script}"`)
}

/**
 * Type text using cliclick or AppleScript
 */
export async function typeText(text: string): Promise<void> {
  // Escape special characters for shell
  const escaped = text.replace(/"/g, '\\"').replace(/'/g, "'\\''")

  try {
    // cliclick t: for typing
    await execAsync(`cliclick t:"${escaped}"`)
    return
  } catch {
    // Fall back to AppleScript
  }

  // AppleScript for typing
  const script = `osascript -e 'tell application "System Events" to keystroke "${escaped}"'`
  await execAsync(script)
}

/**
 * Press a key or key combination using AppleScript
 */
export async function pressKey(keyStr: string): Promise<void> {
  // Map common key names to AppleScript key codes
  const keyCodeMap: Record<string, number> = {
    enter: 36,
    return: 36,
    tab: 48,
    space: 49,
    delete: 51,
    backspace: 51,
    escape: 53,
    esc: 53,
    up: 126,
    down: 125,
    left: 123,
    right: 124,
    home: 115,
    end: 119,
    pageup: 116,
    pagedown: 121,
    f1: 122,
    f2: 120,
    f3: 99,
    f4: 118,
    f5: 96,
    f6: 97,
    f7: 98,
    f8: 100,
    f9: 101,
    f10: 109,
    f11: 103,
    f12: 111
  }

  // Handle key combinations (e.g., "ctrl+c", "cmd+v")
  const parts = keyStr.toLowerCase().split('+').map((s) => s.trim())
  const modifiers: string[] = []
  let mainKey = ''

  for (const part of parts) {
    if (['ctrl', 'control'].includes(part)) {
      modifiers.push('control down')
    } else if (['cmd', 'command'].includes(part)) {
      modifiers.push('command down')
    } else if (['alt', 'option'].includes(part)) {
      modifiers.push('option down')
    } else if (['shift'].includes(part)) {
      modifiers.push('shift down')
    } else {
      mainKey = part
    }
  }

  const modifierStr = modifiers.length > 0 ? ` using {${modifiers.join(', ')}}` : ''

  // Check if it's a special key with key code
  if (keyCodeMap[mainKey] !== undefined) {
    const script = `osascript -e 'tell application "System Events" to key code ${keyCodeMap[mainKey]}${modifierStr}'`
    await execAsync(script)
  } else if (mainKey.length === 1) {
    // Single character
    const script = `osascript -e 'tell application "System Events" to keystroke "${mainKey}"${modifierStr}'`
    await execAsync(script)
  } else {
    throw new Error(`Unknown key: ${mainKey}`)
  }
}

/**
 * Scroll using cliclick or AppleScript/Python
 */
export async function scroll(direction: 'up' | 'down', amount: number): Promise<void> {
  const scrollAmount = direction === 'up' ? amount : -amount

  try {
    // cliclick scroll
    await execAsync(`cliclick "w:${scrollAmount}"`)
    return
  } catch {
    // Fall back to AppleScript
  }

  // Use AppleScript to scroll
  const scrollDirection = direction === 'up' ? -amount : amount
  const script = `osascript -e 'tell application "System Events" to scroll ${scrollDirection}'`

  try {
    await execAsync(script)
  } catch {
    // If AppleScript scroll fails, try Python
    const pyScript = `
import Quartz
Quartz.CGEventPost(Quartz.kCGHIDEventTap, Quartz.CGEventCreateScrollWheelEvent(None, Quartz.kCGScrollEventUnitLine, 1, ${scrollAmount}))
`
    await execAsync(`python3 -c "${pyScript}"`)
  }
}
