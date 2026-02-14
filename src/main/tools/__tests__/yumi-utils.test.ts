/**
 * Layer 1 & 2: Yumi executor utility function and logic tests
 *
 * Since yumi.executor.ts has private helper functions (isUrl, isFileUrl,
 * fileUrlToPath, parseDatetime, resolveFile), we test them indirectly
 * through the exported executor functions, and also test the routing logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// Mock external dependencies before importing the module
vi.mock('../../apps/yumi/bot.service', () => ({
  yumiBotService: {
    getCurrentTargetUserId: vi.fn(() => 'test-user-123'),
    sendText: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-001' }),
    sendImage: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-002' }),
    sendFile: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-003' })
  }
}))

vi.mock('../../apps/yumi/storage', () => ({
  yumiStorage: {
    deleteRecentMessages: vi.fn().mockResolvedValue(5),
    deleteMessagesByTimeRange: vi.fn().mockResolvedValue(10),
    getTotalMessageCount: vi.fn().mockResolvedValue(100),
    clearMessages: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('../../events', () => ({
  appEvents: {
    emitMessagesRefresh: vi.fn()
  }
}))

import {
  executeYumiSendText,
  executeYumiSendImage,
  executeYumiSendFile,
  executeYumiDeleteChatHistory,
  executeYumiTool
} from '../yumi.executor'
import { yumiBotService } from '../../apps/yumi/bot.service'
import { yumiStorage } from '../../apps/yumi/storage'
import { appEvents } from '../../events'

describe('Yumi executor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: user is active
    vi.mocked(yumiBotService.getCurrentTargetUserId).mockReturnValue('test-user-123')
  })

  // ===== executeYumiSendText =====
  describe('executeYumiSendText', () => {
    it('should send text successfully', async () => {
      const result = await executeYumiSendText({ text: 'Hello!' })
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ sent: true, messageId: 'msg-001' })
      expect(yumiBotService.sendText).toHaveBeenCalledWith('test-user-123', 'Hello!')
    })

    it('should fail when no active chat', async () => {
      vi.mocked(yumiBotService.getCurrentTargetUserId).mockReturnValue(null)
      const result = await executeYumiSendText({ text: 'Hello!' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('No active Yumi chat')
    })

    it('should handle send failure', async () => {
      vi.mocked(yumiBotService.sendText).mockResolvedValueOnce({
        success: false,
        error: 'Network error'
      })
      const result = await executeYumiSendText({ text: 'Hello!' })
      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  // ===== executeYumiSendImage =====
  describe('executeYumiSendImage', () => {
    it('should send URL image successfully', async () => {
      const result = await executeYumiSendImage({
        image: 'https://example.com/photo.jpg'
      })
      expect(result.success).toBe(true)
      expect(yumiBotService.sendImage).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          type: 'url',
          url: 'https://example.com/photo.jpg'
        })
      )
    })

    it('should fail when no active chat', async () => {
      vi.mocked(yumiBotService.getCurrentTargetUserId).mockReturnValue(null)
      const result = await executeYumiSendImage({ image: 'https://example.com/photo.jpg' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('No active Yumi chat')
    })

    it('should handle file not found error for local file', async () => {
      const result = await executeYumiSendImage({
        image: '/nonexistent/path/photo.jpg'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('File not found')
    })
  })

  // ===== executeYumiSendFile =====
  describe('executeYumiSendFile', () => {
    it('should send URL file successfully', async () => {
      const result = await executeYumiSendFile({
        file: 'https://example.com/doc.pdf'
      })
      expect(result.success).toBe(true)
      expect(yumiBotService.sendFile).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          type: 'url',
          url: 'https://example.com/doc.pdf'
        })
      )
    })

    it('should fail when no active chat', async () => {
      vi.mocked(yumiBotService.getCurrentTargetUserId).mockReturnValue(null)
      const result = await executeYumiSendFile({ file: 'https://example.com/doc.pdf' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('No active Yumi chat')
    })
  })

  // ===== executeYumiDeleteChatHistory =====
  describe('executeYumiDeleteChatHistory', () => {
    it('should delete by count', async () => {
      const result = await executeYumiDeleteChatHistory({ mode: 'count', count: 5 })
      expect(result.success).toBe(true)
      expect(yumiStorage.deleteRecentMessages).toHaveBeenCalledWith(5)
      expect(appEvents.emitMessagesRefresh).toHaveBeenCalledWith('yumi')
      expect((result.data as { deleted_count: number }).deleted_count).toBe(5)
    })

    it('should fail with invalid count', async () => {
      const result = await executeYumiDeleteChatHistory({ mode: 'count', count: 0 })
      expect(result.success).toBe(false)
      expect(result.error).toContain('positive number')
    })

    it('should fail with missing count', async () => {
      const result = await executeYumiDeleteChatHistory({ mode: 'count' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('positive number')
    })

    it('should delete by time range', async () => {
      const result = await executeYumiDeleteChatHistory({
        mode: 'time_range',
        start_datetime: '2026-02-01T00:00:00Z',
        end_datetime: '2026-02-10T00:00:00Z'
      })
      expect(result.success).toBe(true)
      expect(yumiStorage.deleteMessagesByTimeRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      )
      expect((result.data as { deleted_count: number }).deleted_count).toBe(10)
    })

    it('should handle "now" as end_datetime', async () => {
      const result = await executeYumiDeleteChatHistory({
        mode: 'time_range',
        start_datetime: '2026-02-01',
        end_datetime: 'now'
      })
      expect(result.success).toBe(true)
    })

    it('should fail with missing datetime for time_range mode', async () => {
      const result = await executeYumiDeleteChatHistory({
        mode: 'time_range',
        start_datetime: '2026-02-01'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('start_datetime and end_datetime are required')
    })

    it('should fail with invalid datetime format', async () => {
      const result = await executeYumiDeleteChatHistory({
        mode: 'time_range',
        start_datetime: 'not-a-date',
        end_datetime: 'also-not-a-date'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid datetime')
    })

    it('should delete all messages', async () => {
      const result = await executeYumiDeleteChatHistory({ mode: 'all' })
      expect(result.success).toBe(true)
      expect(yumiStorage.getTotalMessageCount).toHaveBeenCalled()
      expect(yumiStorage.clearMessages).toHaveBeenCalled()
      expect((result.data as { deleted_count: number }).deleted_count).toBe(100)
    })

    it('should fail with unknown mode', async () => {
      const result = await executeYumiDeleteChatHistory({
        mode: 'invalid' as 'count'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown mode')
    })

    it('should emit refresh event after successful deletion', async () => {
      await executeYumiDeleteChatHistory({ mode: 'all' })
      expect(appEvents.emitMessagesRefresh).toHaveBeenCalledWith('yumi')
    })
  })

  // ===== executeYumiTool (routing) =====
  describe('executeYumiTool', () => {
    it('should route yumi_send_text correctly', async () => {
      const result = await executeYumiTool('yumi_send_text', { text: 'hi' })
      expect(result.success).toBe(true)
    })

    it('should route yumi_send_image correctly', async () => {
      const result = await executeYumiTool('yumi_send_image', {
        image: 'https://example.com/img.png'
      })
      expect(result.success).toBe(true)
    })

    it('should route yumi_send_file correctly', async () => {
      const result = await executeYumiTool('yumi_send_file', {
        file: 'https://example.com/f.pdf'
      })
      expect(result.success).toBe(true)
    })

    it('should route yumi_delete_chat_history correctly', async () => {
      const result = await executeYumiTool('yumi_delete_chat_history', {
        mode: 'all'
      })
      expect(result.success).toBe(true)
    })

    it('should return error for unknown tool name', async () => {
      const result = await executeYumiTool('yumi_unknown_tool', {})
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unknown Yumi tool')
    })
  })
})
