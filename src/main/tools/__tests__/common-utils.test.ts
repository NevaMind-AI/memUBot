/**
 * Layer 1: Pure utility function tests
 * Tests for functions without external side effects
 */

import { describe, it, expect } from 'vitest'
import { truncateOutput, getScaleFactor } from '../computer/common'

describe('truncateOutput', () => {
  it('should return short output unchanged', () => {
    const short = 'Hello, world!'
    expect(truncateOutput(short)).toBe(short)
  })

  it('should return output at exact max length unchanged', () => {
    const exact = 'a'.repeat(30000)
    expect(truncateOutput(exact)).toBe(exact)
  })

  it('should truncate output exceeding default max length', () => {
    const long = 'a'.repeat(50000)
    const result = truncateOutput(long)
    expect(result.length).toBeLessThan(long.length)
    expect(result).toContain('OUTPUT TRUNCATED')
  })

  it('should truncate output exceeding custom max length', () => {
    const text = 'a'.repeat(5000)
    const result = truncateOutput(text, 1000)
    // The result should be shorter than original (notice adds some overhead but net is smaller)
    expect(result.length).toBeLessThan(text.length)
    expect(result).toContain('OUTPUT TRUNCATED')
  })

  it('should keep head portion (70%) and tail portion (30%)', () => {
    // Create a string with distinct head and tail
    const head = 'HEAD'.repeat(5000)
    const middle = 'MIDDLE'.repeat(5000)
    const tail = 'TAIL'.repeat(5000)
    const full = head + middle + tail

    const result = truncateOutput(full)
    // Head portion should be preserved
    expect(result.startsWith('HEAD')).toBe(true)
    // Tail portion should be preserved
    expect(result.endsWith('TAIL')).toBe(true)
    // Truncation notice should be present
    expect(result).toContain('OUTPUT TRUNCATED')
  })

  it('should include character count in truncation notice', () => {
    const long = 'x'.repeat(50000)
    const result = truncateOutput(long)
    // Should mention how many characters were removed
    expect(result).toMatch(/\d[\d,]+ characters/)
  })

  it('should handle empty string', () => {
    expect(truncateOutput('')).toBe('')
  })

  it('should handle multiline content', () => {
    const lines = Array.from({ length: 10000 }, (_, i) => `Line ${i + 1}: some content here`).join(
      '\n'
    )
    const result = truncateOutput(lines)
    expect(result).toContain('OUTPUT TRUNCATED')
    expect(result).toContain('total lines')
  })
})

describe('getScaleFactor', () => {
  it('should return a number', () => {
    const factor = getScaleFactor()
    expect(typeof factor).toBe('number')
  })

  it('should default to 1.0', () => {
    // Before any screenshot, the default scale factor should be 1.0
    expect(getScaleFactor()).toBe(1.0)
  })
})
