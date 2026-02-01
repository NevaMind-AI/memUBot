import { loadSettings } from '../config/settings.config'
import { telegramBotService } from '../apps/telegram/bot.service'
import { discordBotService } from '../apps/discord/bot.service'
import { slackBotService } from '../apps/slack/bot.service'
import { feishuBotService } from '../apps/feishu/bot.service'

/**
 * AutoConnect Service
 * Automatically connects to messaging platforms that have been configured
 */
class AutoConnectService {
  /**
   * Check and connect to all configured platforms
   */
  async connectConfiguredPlatforms(): Promise<void> {
    console.log('[AutoConnect] Checking configured platforms...')
    
    const settings = await loadSettings()
    const connectPromises: Promise<void>[] = []

    // Check Telegram
    if (settings.telegramBotToken && settings.telegramBotToken.trim() !== '') {
      console.log('[AutoConnect] Telegram is configured, connecting...')
      connectPromises.push(
        this.connectTelegram().catch((err) => {
          console.error('[AutoConnect] Failed to connect Telegram:', err)
        })
      )
    }

    // Check Discord
    if (settings.discordBotToken && settings.discordBotToken.trim() !== '') {
      console.log('[AutoConnect] Discord is configured, connecting...')
      connectPromises.push(
        this.connectDiscord().catch((err) => {
          console.error('[AutoConnect] Failed to connect Discord:', err)
        })
      )
    }

    // Check Slack (needs both bot token and app token)
    if (
      settings.slackBotToken && settings.slackBotToken.trim() !== '' &&
      settings.slackAppToken && settings.slackAppToken.trim() !== ''
    ) {
      console.log('[AutoConnect] Slack is configured, connecting...')
      connectPromises.push(
        this.connectSlack().catch((err) => {
          console.error('[AutoConnect] Failed to connect Slack:', err)
        })
      )
    }

    // Check Feishu (needs both app ID and app secret)
    if (
      settings.feishuAppId && settings.feishuAppId.trim() !== '' &&
      settings.feishuAppSecret && settings.feishuAppSecret.trim() !== ''
    ) {
      console.log('[AutoConnect] Feishu is configured, connecting...')
      connectPromises.push(
        this.connectFeishu().catch((err) => {
          console.error('[AutoConnect] Failed to connect Feishu:', err)
        })
      )
    }

    // Wait for all connections to complete (or fail)
    if (connectPromises.length > 0) {
      await Promise.all(connectPromises)
      console.log('[AutoConnect] All configured platforms connection attempts completed')
    } else {
      console.log('[AutoConnect] No platforms configured')
    }
  }

  /**
   * Connect to Telegram
   */
  private async connectTelegram(): Promise<void> {
    try {
      await telegramBotService.connect()
      console.log('[AutoConnect] Telegram connected successfully')
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
      console.log('[AutoConnect] Discord connected successfully')
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
      console.log('[AutoConnect] Slack connected successfully')
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
      console.log('[AutoConnect] Feishu connected successfully')
    } catch (error) {
      throw new Error(`Feishu connection failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

// Export singleton instance
export const autoConnectService = new AutoConnectService()
