/**
 * Windows-specific mouse and keyboard control implementation
 * Uses nut.js (@nut-tree-fork/nut-js) for desktop automation
 */

/**
 * nut.js module references (lazy loaded)
 */
let nutMouse: typeof import('@nut-tree-fork/nut-js').mouse | null = null
let nutKeyboard: typeof import('@nut-tree-fork/nut-js').keyboard | null = null
let nutButton: typeof import('@nut-tree-fork/nut-js').Button | null = null
let nutKey: typeof import('@nut-tree-fork/nut-js').Key | null = null
let nutInitialized = false

/**
 * Initialize nut.js (lazy load)
 */
async function initNutJs(): Promise<boolean> {
  if (nutInitialized) return true

  try {
    const nutJs = await import('@nut-tree-fork/nut-js')
    nutMouse = nutJs.mouse
    nutKeyboard = nutJs.keyboard
    nutButton = nutJs.Button
    nutKey = nutJs.Key

    // Configure nut.js for faster operations
    nutMouse.config.mouseSpeed = 2000 // pixels per second
    nutMouse.config.autoDelayMs = 50
    nutKeyboard.config.autoDelayMs = 50

    nutInitialized = true
    console.log('[Computer/Windows] nut.js initialized')
    return true
  } catch (error) {
    console.error('[Computer/Windows] Failed to initialize nut.js:', error)
    return false
  }
}

/**
 * Move mouse to coordinates using nut.js
 */
export async function moveMouse(x: number, y: number): Promise<void> {
  if (!(await initNutJs()) || !nutMouse) {
    throw new Error('nut.js not available for Windows mouse control')
  }
  await nutMouse.setPosition({ x: Math.round(x), y: Math.round(y) })
}

/**
 * Click using nut.js
 */
export async function click(button: 'left' | 'right'): Promise<void> {
  if (!(await initNutJs()) || !nutMouse || !nutButton) {
    throw new Error('nut.js not available for Windows mouse control')
  }
  const btn = button === 'left' ? nutButton.LEFT : nutButton.RIGHT
  await nutMouse.click(btn)
}

/**
 * Double click using nut.js
 */
export async function doubleClick(): Promise<void> {
  if (!(await initNutJs()) || !nutMouse || !nutButton) {
    throw new Error('nut.js not available for Windows mouse control')
  }
  await nutMouse.doubleClick(nutButton.LEFT)
}

/**
 * Type text using nut.js
 */
export async function typeText(text: string): Promise<void> {
  if (!(await initNutJs()) || !nutKeyboard) {
    throw new Error('nut.js not available for Windows keyboard control')
  }
  await nutKeyboard.type(text)
}

/**
 * Press a key or key combination using nut.js
 */
export async function pressKey(keyStr: string): Promise<void> {
  if (!(await initNutJs()) || !nutKeyboard || !nutKey) {
    throw new Error('nut.js not available for Windows keyboard control')
  }

  // Map common key names to nut.js Key enum
  const nutKeyMap: Record<string, number> = {
    enter: nutKey.Enter,
    return: nutKey.Enter,
    tab: nutKey.Tab,
    space: nutKey.Space,
    delete: nutKey.Delete,
    backspace: nutKey.Backspace,
    escape: nutKey.Escape,
    esc: nutKey.Escape,
    up: nutKey.Up,
    down: nutKey.Down,
    left: nutKey.Left,
    right: nutKey.Right,
    home: nutKey.Home,
    end: nutKey.End,
    pageup: nutKey.PageUp,
    pagedown: nutKey.PageDown,
    f1: nutKey.F1,
    f2: nutKey.F2,
    f3: nutKey.F3,
    f4: nutKey.F4,
    f5: nutKey.F5,
    f6: nutKey.F6,
    f7: nutKey.F7,
    f8: nutKey.F8,
    f9: nutKey.F9,
    f10: nutKey.F10,
    f11: nutKey.F11,
    f12: nutKey.F12
  }

  // Handle key combinations (e.g., "ctrl+c", "win+v")
  const parts = keyStr.toLowerCase().split('+').map((s) => s.trim())
  const modifiers: number[] = []
  let mainKey = ''

  for (const part of parts) {
    if (['ctrl', 'control'].includes(part)) {
      modifiers.push(nutKey.LeftControl)
    } else if (['cmd', 'command', 'win', 'meta'].includes(part)) {
      modifiers.push(nutKey.LeftSuper) // Windows key
    } else if (['alt', 'option'].includes(part)) {
      modifiers.push(nutKey.LeftAlt)
    } else if (['shift'].includes(part)) {
      modifiers.push(nutKey.LeftShift)
    } else {
      mainKey = part
    }
  }

  // Get the main key code
  let keyCode: number
  if (nutKeyMap[mainKey] !== undefined) {
    keyCode = nutKeyMap[mainKey]
  } else if (mainKey.length === 1) {
    // Single character - convert to Key enum
    const charUpper = mainKey.toUpperCase()
    // nut.js Key enum has A-Z as Key.A, Key.B, etc.
    if (charUpper >= 'A' && charUpper <= 'Z') {
      keyCode = nutKey[charUpper as keyof typeof nutKey] as number
    } else if (charUpper >= '0' && charUpper <= '9') {
      // Number keys - use Num0-Num9 or the direct number
      const numKey = `Num${charUpper}` as keyof typeof nutKey
      keyCode = nutKey[numKey] as number
    } else {
      throw new Error(`Unknown key: ${mainKey}`)
    }
  } else {
    throw new Error(`Unknown key: ${mainKey}`)
  }

  // Press modifiers, then key, then release
  if (modifiers.length > 0) {
    // Press all modifiers
    for (const mod of modifiers) {
      await nutKeyboard.pressKey(mod)
    }
    // Press main key
    await nutKeyboard.pressKey(keyCode)
    await nutKeyboard.releaseKey(keyCode)
    // Release all modifiers in reverse order
    for (const mod of modifiers.reverse()) {
      await nutKeyboard.releaseKey(mod)
    }
  } else {
    // Just press and release the key
    await nutKeyboard.pressKey(keyCode)
    await nutKeyboard.releaseKey(keyCode)
  }
}

/**
 * Scroll using nut.js
 */
export async function scroll(direction: 'up' | 'down', amount: number): Promise<void> {
  if (!(await initNutJs()) || !nutMouse) {
    throw new Error('nut.js not available for Windows mouse control')
  }

  // nut.js scrollDown/scrollUp scroll by lines
  if (direction === 'up') {
    await nutMouse.scrollUp(amount)
  } else {
    await nutMouse.scrollDown(amount)
  }
}
