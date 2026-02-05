/**
 * AutoConnect Service - Memu Implementation
 * Connects to messaging platforms (Telegram, Discord, Slack, Feishu)
 */
import { loadSettings } from '../../config/settings.config'
import { telegramBotService } from '../../apps/telegram/bot.service'
import { discordBotService } from '../../apps/discord/bot.service'
import { slackBotService } from '../../apps/slack/bot.service'
import { feishuBotService } from '../../apps/feishu/bot.service'
import type { IAutoConnectService } from './types'

class MemuAutoConnectService implements IAutoConnectService {
  /**
   * Check and connect to all configured platforms
   */
  async connectConfiguredPlatforms(): Promise<void> {
    console.log('[AutoConnect:Memu] Checking configured platforms...')
    
    const settings = await loadSettings()
    const connectPromises: Promise<void>[] = []

    // Check Telegram
    if (settings.telegramBotToken && settings.telegramBotToken.trim() !== '') {
      if (settings.telegramAutoConnect !== false) {
        console.log('[AutoConnect:Memu] Telegram is configured, connecting...')
        connectPromises.push(
          this.connectTelegram().catch((err) => {
            console.error('[AutoConnect:Memu] Failed to connect Telegram:', err)
          })
        )
      } else {
        console.log('[AutoConnect:Memu] Telegram is configured but auto-connect is disabled')
      }
    }

    // Check Discord
    if (settings.discordBotToken && settings.discordBotToken.trim() !== '') {
      if (settings.discordAutoConnect !== false) {
        console.log('[AutoConnect:Memu] Discord is configured, connecting...')
        connectPromises.push(
          this.connectDiscord().catch((err) => {
            console.error('[AutoConnect:Memu] Failed to connect Discord:', err)
          })
        )
      } else {
        console.log('[AutoConnect:Memu] Discord is configured but auto-connect is disabled')
      }
    }

    // Check Slack (needs both bot token and app token)
    if (
      settings.slackBotToken && settings.slackBotToken.trim() !== '' &&
      settings.slackAppToken && settings.slackAppToken.trim() !== ''
    ) {
      if (settings.slackAutoConnect !== false) {
        console.log('[AutoConnect:Memu] Slack is configured, connecting...')
        connectPromises.push(
          this.connectSlack().catch((err) => {
            console.error('[AutoConnect:Memu] Failed to connect Slack:', err)
          })
        )
      } else {
        console.log('[AutoConnect:Memu] Slack is configured but auto-connect is disabled')
      }
    }

    // Check Feishu (needs both app ID and app secret)
    if (
      settings.feishuAppId && settings.feishuAppId.trim() !== '' &&
      settings.feishuAppSecret && settings.feishuAppSecret.trim() !== ''
    ) {
      if (settings.feishuAutoConnect !== false) {
        console.log('[AutoConnect:Memu] Feishu is configured, connecting...')
        connectPromises.push(
          this.connectFeishu().catch((err) => {
            console.error('[AutoConnect:Memu] Failed to connect Feishu:', err)
          })
        )
      } else {
        console.log('[AutoConnect:Memu] Feishu is configured but auto-connect is disabled')
      }
    }

    // Wait for all connections to complete (or fail)
    if (connectPromises.length > 0) {
      await Promise.all(connectPromises)
      console.log('[AutoConnect:Memu] All configured platforms connection attempts completed')
    } else {
      console.log('[AutoConnect:Memu] No platforms configured')
    }
  }

  /**
   * Connect to Telegram
   */
  private async connectTelegram(): Promise<void> {
    try {
      await telegramBotService.connect()
      console.log('[AutoConnect:Memu] Telegram connected successfully')
    } catch (error) {
      throw new Error(`Telegram connection failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Connect to Discord
   */
  private async connectDiscord(): Promise<void> {
    try {
      await discordBotService.connect()
      console.log('[AutoConnect:Memu] Discord connected successfully')
    } catch (error) {
      throw new Error(`Discord connection failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Connect to Slack
   */
  private async connectSlack(): Promise<void> {
    try {
      await slackBotService.connect()
      console.log('[AutoConnect:Memu] Slack connected successfully')
    } catch (error) {
      throw new Error(`Slack connection failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Connect to Feishu
   */
  private async connectFeishu(): Promise<void> {
    try {
      await feishuBotService.connect()
      console.log('[AutoConnect:Memu] Feishu connected successfully')
    } catch (error) {
      throw new Error(`Feishu connection failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// Export singleton instance
export const memuAutoConnectService = new MemuAutoConnectService()
