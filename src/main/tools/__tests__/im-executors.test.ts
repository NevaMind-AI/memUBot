/**
 * Layer 2: IM platform executor tests
 * Tests for Slack, Telegram, Discord, WhatsApp, Line, Feishu executors
 *
 * All IM executors follow the same pattern:
 * 1. Get current chat/channel ID from bot service
 * 2. Call bot service method
 * 3. Store sent message + emit UI event
 * 4. Delete history (count/time_range/all)
 *
 * We test each platform's core flows: send text, no-active-chat guard,
 * delete history modes, routing, and unknown tool handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================
// SLACK
// ============================================================

vi.mock('../../apps/slack/bot.service', () => ({
  slackBotService: {
    getCurrentChannelId: vi.fn(() => 'C-slack-001'),
    sendText: vi.fn().mockResolvedValue({ success: true, messageId: 'slack-msg-1' }),
    sendBlocks: vi.fn().mockResolvedValue({ success: true, messageId: 'slack-msg-2' }),
    uploadFile: vi.fn().mockResolvedValue({ success: true, fileId: 'slack-file-1' }),
    addReaction: vi.fn().mockResolvedValue({ success: true }),
    sendEphemeral: vi.fn().mockResolvedValue({ success: true }),
    getStatus: vi.fn(() => ({ username: 'testbot', botName: 'TestBot' }))
  }
}))

vi.mock('../../apps/slack/storage', () => ({
  slackStorage: {
    storeMessage: vi.fn(),
    deleteRecentMessages: vi.fn().mockResolvedValue(5),
    deleteMessagesByTimeRange: vi.fn().mockResolvedValue(10),
    getMessageCount: vi.fn().mockResolvedValue(50),
    clearMessages: vi.fn()
  }
}))

// ============================================================
// TELEGRAM
// ============================================================

vi.mock('../../apps/telegram/bot.service', () => ({
  telegramBotService: {
    getCurrentChatId: vi.fn(() => 12345),
    sendText: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'tg-msg-1',
      message: {
        message_id: 1,
        chat: { id: 12345 },
        from: { id: 99, first_name: 'Bot' },
        date: Math.floor(Date.now() / 1000)
      }
    }),
    sendPhoto: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'tg-msg-2',
      message: {
        message_id: 2,
        chat: { id: 12345 },
        from: { id: 99, first_name: 'Bot' },
        date: Math.floor(Date.now() / 1000),
        photo: [{ file_id: 'photo-1', width: 100, height: 100 }]
      }
    }),
    sendLocation: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'tg-msg-3',
      message: {
        message_id: 3,
        chat: { id: 12345 },
        from: { id: 99, first_name: 'Bot' },
        date: Math.floor(Date.now() / 1000)
      }
    }),
    sendChatAction: vi.fn().mockResolvedValue({ success: true })
  }
}))

vi.mock('../../apps/telegram/storage', () => ({
  telegramStorage: {
    storeMessage: vi.fn(),
    deleteRecentMessages: vi.fn().mockResolvedValue(3),
    deleteMessagesByTimeRange: vi.fn().mockResolvedValue(8),
    getTotalMessageCount: vi.fn().mockResolvedValue(200),
    clearMessages: vi.fn()
  }
}))

// ============================================================
// DISCORD
// ============================================================

vi.mock('../../apps/discord/bot.service', () => ({
  discordBotService: {
    getCurrentChannelId: vi.fn(() => 'discord-ch-001'),
    sendText: vi.fn().mockResolvedValue({ success: true, messageId: 'dc-msg-1' }),
    sendEmbed: vi.fn().mockResolvedValue({ success: true, messageId: 'dc-msg-2' }),
    sendFile: vi.fn().mockResolvedValue({ success: true, messageId: 'dc-msg-3' }),
    reply: vi.fn().mockResolvedValue({ success: true, messageId: 'dc-msg-4' }),
    addReaction: vi.fn().mockResolvedValue({ success: true }),
    sendTyping: vi.fn().mockResolvedValue({ success: true }),
    getStatus: vi.fn(() => ({ username: 'discordbot', botName: 'DiscordBot' }))
  }
}))

vi.mock('../../apps/discord/storage', () => ({
  discordStorage: {
    storeMessage: vi.fn(),
    deleteRecentMessages: vi.fn().mockResolvedValue(4),
    deleteMessagesByTimeRange: vi.fn().mockResolvedValue(12),
    getMessageCount: vi.fn().mockResolvedValue(80),
    clearMessages: vi.fn()
  }
}))

// ============================================================
// WHATSAPP
// ============================================================

vi.mock('../../apps/whatsapp/bot.service', () => ({
  whatsappBotService: {
    getCurrentChatId: vi.fn(() => 'wa-chat-001'),
    sendText: vi.fn().mockResolvedValue({ success: true, messageId: 'wa-msg-1' }),
    sendImage: vi.fn().mockResolvedValue({ success: true, messageId: 'wa-msg-2' }),
    sendDocument: vi.fn().mockResolvedValue({ success: true, messageId: 'wa-msg-3' }),
    sendLocation: vi.fn().mockResolvedValue({ success: true, messageId: 'wa-msg-4' })
  }
}))

vi.mock('../../apps/whatsapp/storage', () => ({
  whatsappStorage: {
    deleteRecentMessages: vi.fn().mockResolvedValue(6),
    deleteMessagesByTimeRange: vi.fn().mockResolvedValue(15),
    getMessageCount: vi.fn().mockResolvedValue(120),
    clearMessages: vi.fn()
  }
}))

// ============================================================
// LINE
// ============================================================

vi.mock('../../apps/line/bot.service', () => ({
  lineBotService: {
    getCurrentSource: vi.fn(() => ({ id: 'line-user-001', type: 'user' })),
    sendText: vi.fn().mockResolvedValue({ success: true }),
    sendImage: vi.fn().mockResolvedValue({ success: true }),
    sendSticker: vi.fn().mockResolvedValue({ success: true }),
    sendLocation: vi.fn().mockResolvedValue({ success: true }),
    sendFlexMessage: vi.fn().mockResolvedValue({ success: true })
  }
}))

vi.mock('../../apps/line/storage', () => ({
  lineStorage: {
    deleteRecentMessages: vi.fn().mockResolvedValue(7),
    deleteMessagesByTimeRange: vi.fn().mockResolvedValue(20),
    getMessageCount: vi.fn().mockResolvedValue(300),
    clearMessages: vi.fn()
  }
}))

// ============================================================
// FEISHU
// ============================================================

vi.mock('../../apps/feishu/bot.service', () => ({
  feishuBotService: {
    getCurrentChatId: vi.fn(() => 'feishu-chat-001'),
    sendText: vi.fn().mockResolvedValue({ success: true, messageId: 'fs-msg-1' }),
    sendImage: vi.fn().mockResolvedValue({ success: true, messageId: 'fs-msg-2' }),
    sendFile: vi.fn().mockResolvedValue({ success: true, messageId: 'fs-msg-3' }),
    sendCard: vi.fn().mockResolvedValue({ success: true, messageId: 'fs-msg-4' }),
    getStatus: vi.fn(() => ({ botName: 'FeishuBot' }))
  }
}))

vi.mock('../../apps/feishu/storage', () => ({
  feishuStorage: {
    storeMessage: vi.fn(),
    deleteRecentMessages: vi.fn().mockResolvedValue(9),
    deleteMessagesByTimeRange: vi.fn().mockResolvedValue(25),
    getTotalMessageCount: vi.fn().mockResolvedValue(500),
    clearMessages: vi.fn()
  }
}))

// ============================================================
// SHARED MOCKS
// ============================================================

vi.mock('../../events', () => ({
  appEvents: {
    emitMessagesRefresh: vi.fn(),
    emitSlackNewMessage: vi.fn(),
    emitNewMessage: vi.fn(),
    emitDiscordNewMessage: vi.fn(),
    emitFeishuNewMessage: vi.fn()
  }
}))

// ============================================================
// IMPORTS (after mocks)
// ============================================================

import { executeSlackSendText, executeSlackDeleteChatHistory, executeSlackTool } from '../slack.executor'
import { slackBotService } from '../../apps/slack/bot.service'

import { executeTelegramSendText, executeTelegramSendLocation, executeTelegramSendChatAction, executeTelegramDeleteChatHistory, executeTelegramTool } from '../telegram.executor'
import { telegramBotService } from '../../apps/telegram/bot.service'

import { executeDiscordSendText, executeDiscordSendEmbed, executeDiscordTyping, executeDiscordDeleteChatHistory, executeDiscordTool } from '../discord.executor'
import { discordBotService } from '../../apps/discord/bot.service'

import { executeWhatsAppSendText, executeWhatsAppSendLocation, executeWhatsAppDeleteChatHistory, executeWhatsAppTool } from '../whatsapp.executor'
import { whatsappBotService } from '../../apps/whatsapp/bot.service'

import { executeLineSendText, executeLineSendSticker, executeLineDeleteChatHistory, executeLineTool } from '../line.executor'
import { lineBotService } from '../../apps/line/bot.service'

import { executeFeishuSendText, executeFeishuSendCard, executeFeishuDeleteChatHistory, executeFeishuTool } from '../feishu.executor'
import { feishuBotService } from '../../apps/feishu/bot.service'

import { appEvents } from '../../events'

// ============================================================
// TESTS
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  // Restore default return values
  vi.mocked(slackBotService.getCurrentChannelId).mockReturnValue('C-slack-001')
  vi.mocked(telegramBotService.getCurrentChatId).mockReturnValue(12345)
  vi.mocked(discordBotService.getCurrentChannelId).mockReturnValue('discord-ch-001')
  vi.mocked(whatsappBotService.getCurrentChatId).mockReturnValue('wa-chat-001')
  vi.mocked(lineBotService.getCurrentSource).mockReturnValue({ id: 'line-user-001', type: 'user' } as any)
  vi.mocked(feishuBotService.getCurrentChatId).mockReturnValue('feishu-chat-001')
})

// --- SLACK ---
describe('Slack executor', () => {
  it('should send text successfully', async () => {
    const r = await executeSlackSendText({ text: 'hello slack' })
    expect(r.success).toBe(true)
    expect(slackBotService.sendText).toHaveBeenCalledWith('C-slack-001', 'hello slack', undefined)
  })

  it('should fail when no active channel', async () => {
    vi.mocked(slackBotService.getCurrentChannelId).mockReturnValue(null)
    const r = await executeSlackSendText({ text: 'hi' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('No active Slack channel')
  })

  it('should delete by count', async () => {
    const r = await executeSlackDeleteChatHistory({ mode: 'count', count: 5 })
    expect(r.success).toBe(true)
    expect(appEvents.emitMessagesRefresh).toHaveBeenCalledWith('slack')
  })

  it('should delete all', async () => {
    const r = await executeSlackDeleteChatHistory({ mode: 'all' })
    expect(r.success).toBe(true)
    expect((r.data as any).deleted_count).toBe(50)
  })

  it('should reject invalid count', async () => {
    const r = await executeSlackDeleteChatHistory({ mode: 'count', count: 0 })
    expect(r.success).toBe(false)
  })

  it('should route unknown tool', async () => {
    const r = await executeSlackTool('slack_unknown', {})
    expect(r.success).toBe(false)
    expect(r.error).toContain('Unknown Slack tool')
  })
})

// --- TELEGRAM ---
describe('Telegram executor', () => {
  it('should send text successfully', async () => {
    const r = await executeTelegramSendText({ text: 'hello tg' })
    expect(r.success).toBe(true)
    expect(telegramBotService.sendText).toHaveBeenCalledWith(12345, 'hello tg')
  })

  it('should fail when no active chat', async () => {
    vi.mocked(telegramBotService.getCurrentChatId).mockReturnValue(null)
    const r = await executeTelegramSendText({ text: 'hi' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('No active Telegram chat')
  })

  it('should send location', async () => {
    const r = await executeTelegramSendLocation({ latitude: 35.68, longitude: 139.69 })
    expect(r.success).toBe(true)
    expect(telegramBotService.sendLocation).toHaveBeenCalledWith(12345, 35.68, 139.69)
  })

  it('should send chat action', async () => {
    const r = await executeTelegramSendChatAction({ action: 'typing' })
    expect(r.success).toBe(true)
  })

  it('should delete by time range', async () => {
    const r = await executeTelegramDeleteChatHistory({
      mode: 'time_range',
      start_datetime: '2026-01-01T00:00:00Z',
      end_datetime: 'now'
    })
    expect(r.success).toBe(true)
    expect(appEvents.emitMessagesRefresh).toHaveBeenCalledWith('telegram')
  })

  it('should delete all', async () => {
    const r = await executeTelegramDeleteChatHistory({ mode: 'all' })
    expect(r.success).toBe(true)
    expect((r.data as any).deleted_count).toBe(200)
  })

  it('should route unknown tool', async () => {
    const r = await executeTelegramTool('telegram_fly', {})
    expect(r.success).toBe(false)
    expect(r.error).toContain('Unknown Telegram tool')
  })
})

// --- DISCORD ---
describe('Discord executor', () => {
  it('should send text successfully', async () => {
    const r = await executeDiscordSendText({ text: 'hello dc' })
    expect(r.success).toBe(true)
    expect(discordBotService.sendText).toHaveBeenCalledWith('discord-ch-001', 'hello dc')
  })

  it('should fail when no active channel', async () => {
    vi.mocked(discordBotService.getCurrentChannelId).mockReturnValue(null)
    const r = await executeDiscordSendText({ text: 'hi' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('No active Discord channel')
  })

  it('should send embed', async () => {
    const r = await executeDiscordSendEmbed({ title: 'Test', description: 'desc' })
    expect(r.success).toBe(true)
    expect(discordBotService.sendEmbed).toHaveBeenCalled()
  })

  it('should send typing indicator', async () => {
    const r = await executeDiscordTyping()
    expect(r.success).toBe(true)
  })

  it('should delete all', async () => {
    const r = await executeDiscordDeleteChatHistory({ mode: 'all' })
    expect(r.success).toBe(true)
    expect((r.data as any).deleted_count).toBe(80)
    expect(appEvents.emitMessagesRefresh).toHaveBeenCalledWith('discord')
  })

  it('should route unknown tool', async () => {
    const r = await executeDiscordTool('discord_dance', {})
    expect(r.success).toBe(false)
    expect(r.error).toContain('Unknown Discord tool')
  })
})

// --- WHATSAPP ---
describe('WhatsApp executor', () => {
  it('should send text successfully', async () => {
    const r = await executeWhatsAppSendText({ text: 'hello wa' })
    expect(r.success).toBe(true)
    expect(whatsappBotService.sendText).toHaveBeenCalledWith('wa-chat-001', 'hello wa')
  })

  it('should fail when no active chat', async () => {
    vi.mocked(whatsappBotService.getCurrentChatId).mockReturnValue(null)
    const r = await executeWhatsAppSendText({ text: 'hi' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('No active WhatsApp chat')
  })

  it('should send location', async () => {
    const r = await executeWhatsAppSendLocation({ latitude: 1.35, longitude: 103.82 })
    expect(r.success).toBe(true)
  })

  it('should delete all', async () => {
    const r = await executeWhatsAppDeleteChatHistory({ mode: 'all' })
    expect(r.success).toBe(true)
    expect((r.data as any).deleted_count).toBe(120)
    expect(appEvents.emitMessagesRefresh).toHaveBeenCalledWith('whatsapp')
  })

  it('should route unknown tool', async () => {
    const r = await executeWhatsAppTool('whatsapp_call', {})
    expect(r.success).toBe(false)
    expect(r.error).toContain('Unknown WhatsApp tool')
  })
})

// --- LINE ---
describe('Line executor', () => {
  it('should send text successfully', async () => {
    const r = await executeLineSendText({ text: 'hello line' })
    expect(r.success).toBe(true)
    expect(lineBotService.sendText).toHaveBeenCalledWith('line-user-001', 'hello line')
  })

  it('should fail when no active chat', async () => {
    vi.mocked(lineBotService.getCurrentSource).mockReturnValue({ id: null, type: 'user' } as any)
    const r = await executeLineSendText({ text: 'hi' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('No active Line chat')
  })

  it('should send sticker', async () => {
    const r = await executeLineSendSticker({ package_id: '11537', sticker_id: '52002734' })
    expect(r.success).toBe(true)
    expect(lineBotService.sendSticker).toHaveBeenCalledWith('line-user-001', '11537', '52002734')
  })

  it('should delete all', async () => {
    const r = await executeLineDeleteChatHistory({ mode: 'all' })
    expect(r.success).toBe(true)
    expect((r.data as any).deleted_count).toBe(300)
    expect(appEvents.emitMessagesRefresh).toHaveBeenCalledWith('line')
  })

  it('should route unknown tool', async () => {
    const r = await executeLineTool('line_video_call', {})
    expect(r.success).toBe(false)
    expect(r.error).toContain('Unknown Line tool')
  })
})

// --- FEISHU ---
describe('Feishu executor', () => {
  it('should send text successfully', async () => {
    const r = await executeFeishuSendText({ text: 'hello feishu' })
    expect(r.success).toBe(true)
    expect(feishuBotService.sendText).toHaveBeenCalledWith('feishu-chat-001', 'hello feishu')
  })

  it('should fail when no active chat', async () => {
    vi.mocked(feishuBotService.getCurrentChatId).mockReturnValue(null)
    const r = await executeFeishuSendText({ text: 'hi' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('No active Feishu chat')
  })

  it('should send card', async () => {
    const r = await executeFeishuSendCard({ title: 'Alert', content: '**Important**' })
    expect(r.success).toBe(true)
    expect(feishuBotService.sendCard).toHaveBeenCalled()
  })

  it('should delete all', async () => {
    const r = await executeFeishuDeleteChatHistory({ mode: 'all' })
    expect(r.success).toBe(true)
    expect((r.data as any).deleted_count).toBe(500)
    expect(appEvents.emitMessagesRefresh).toHaveBeenCalledWith('feishu')
  })

  it('should route unknown tool', async () => {
    const r = await executeFeishuTool('feishu_video', {})
    expect(r.success).toBe(false)
    expect(r.error).toContain('Unknown Feishu tool')
  })
})
