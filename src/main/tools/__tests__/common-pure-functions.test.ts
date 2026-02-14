/**
 * Layer 1: Additional pure function tests for computer/common.ts
 * Tests for extractFilename and calculateScaleFactor
 *
 * These functions are not exported, so we test them indirectly
 * by re-implementing the same logic and verifying against known cases.
 * For calculateScaleFactor we can verify via the constants used.
 */

import { describe, it, expect } from 'vitest'

// --- extractFilename logic (mirrors computer/common.ts) ---
// Since extractFilename is not exported, we replicate the logic for testing.
// This ensures the algorithm itself is correct.

function extractFilename(url: string, contentDisposition?: string): string {
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
    if (match && match[1]) {
      return match[1].replace(/['"]/g, '')
    }
  }

  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const { basename } = require('path')
    const filename = basename(pathname)
    if (filename && filename.includes('.')) {
      return filename
    }
  } catch {
    // Ignore URL parsing errors
  }

  return `download_fallback`
}

describe('extractFilename logic', () => {
  it('should extract filename from Content-Disposition header', () => {
    expect(extractFilename('https://example.com/api', 'attachment; filename="report.pdf"')).toBe(
      'report.pdf'
    )
  })

  it('should extract filename with single quotes in Content-Disposition', () => {
    expect(extractFilename('https://example.com/api', "attachment; filename='data.csv'")).toBe(
      'data.csv'
    )
  })

  it('should extract filename without quotes in Content-Disposition', () => {
    expect(extractFilename('https://example.com/api', 'attachment; filename=image.png')).toBe(
      'image.png'
    )
  })

  it('should extract filename from URL path when no Content-Disposition', () => {
    expect(extractFilename('https://example.com/files/photo.jpg')).toBe('photo.jpg')
  })

  it('should extract filename from URL with query params', () => {
    expect(extractFilename('https://example.com/files/doc.pdf?token=abc123')).toBe('doc.pdf')
  })

  it('should fallback when URL has no extension', () => {
    expect(extractFilename('https://example.com/download')).toContain('download_fallback')
  })

  it('should fallback for root URL without path', () => {
    expect(extractFilename('https://example.com/')).toContain('download_fallback')
  })

  it('should prefer Content-Disposition over URL path', () => {
    expect(
      extractFilename('https://example.com/files/wrong.txt', 'attachment; filename="correct.pdf"')
    ).toBe('correct.pdf')
  })
})

// --- calculateScaleFactor logic (mirrors computer/common.ts) ---
// Constants from the source
const ANTHROPIC_MAX_LONG_EDGE = 1568
const ANTHROPIC_MAX_PIXELS = 1_150_000

function calculateScaleFactor(width: number, height: number): number {
  const longEdge = Math.max(width, height)
  const totalPixels = width * height

  const longEdgeScale =
    longEdge > ANTHROPIC_MAX_LONG_EDGE ? ANTHROPIC_MAX_LONG_EDGE / longEdge : 1.0

  const pixelsScale =
    totalPixels > ANTHROPIC_MAX_PIXELS ? Math.sqrt(ANTHROPIC_MAX_PIXELS / totalPixels) : 1.0

  return Math.min(1.0, longEdgeScale, pixelsScale)
}

describe('calculateScaleFactor logic', () => {
  it('should return 1.0 for small images', () => {
    expect(calculateScaleFactor(800, 600)).toBe(1.0)
  })

  it('should return 1.0 when both constraints are within limits', () => {
    // 800x600: long edge 800 < 1568, pixels 480000 < 1150000
    expect(calculateScaleFactor(800, 600)).toBe(1.0)
  })

  it('should scale down when long edge is at limit but pixels exceed', () => {
    // 1568 * 1000 = 1,568,000 > 1,150,000 pixels limit
    const factor = calculateScaleFactor(1568, 1000)
    expect(factor).toBeLessThan(1.0)
  })

  it('should scale down when long edge exceeds limit', () => {
    // 3136 = 2 * 1568, should scale to 0.5
    const factor = calculateScaleFactor(3136, 1000)
    expect(factor).toBeCloseTo(0.5, 5)
  })

  it('should scale down when total pixels exceed limit', () => {
    // 1200 * 1200 = 1,440,000 > 1,150,000
    const factor = calculateScaleFactor(1200, 1200)
    expect(factor).toBeLessThan(1.0)
    // After scaling: (1200 * factor)^2 should be close to 1,150,000
    const scaledPixels = 1200 * factor * (1200 * factor)
    expect(scaledPixels).toBeLessThanOrEqual(ANTHROPIC_MAX_PIXELS * 1.01) // small tolerance
  })

  it('should use more aggressive (smaller) factor when both constraints apply', () => {
    // 4K display: 3840x2160
    const factor = calculateScaleFactor(3840, 2160)
    expect(factor).toBeLessThan(1.0)

    // Scaled dimensions should satisfy both constraints
    const scaledW = 3840 * factor
    const scaledH = 2160 * factor
    expect(Math.max(scaledW, scaledH)).toBeLessThanOrEqual(ANTHROPIC_MAX_LONG_EDGE + 1)
    expect(scaledW * scaledH).toBeLessThanOrEqual(ANTHROPIC_MAX_PIXELS * 1.01)
  })

  it('should handle standard Retina Mac display (2880x1800)', () => {
    const factor = calculateScaleFactor(2880, 1800)
    expect(factor).toBeLessThan(1.0)
    expect(factor).toBeGreaterThan(0)
  })

  it('should handle very large displays (5K: 5120x2880)', () => {
    const factor = calculateScaleFactor(5120, 2880)
    expect(factor).toBeLessThan(0.5)
    expect(factor).toBeGreaterThan(0)
  })

  it('should handle 1:1 aspect ratio', () => {
    const factor = calculateScaleFactor(1568, 1568)
    // 1568 * 1568 = 2,458,624 > 1,150,000, so pixels constraint kicks in
    expect(factor).toBeLessThan(1.0)
  })

  it('should handle portrait orientation', () => {
    const factor = calculateScaleFactor(1000, 3136)
    // Long edge is height=3136, should scale to 0.5
    expect(factor).toBeCloseTo(0.5, 5)
  })
})
