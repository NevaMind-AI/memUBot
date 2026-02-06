import { executeComputerTool, executeBashTool, executeTextEditorTool, executeDownloadFileTool, executeWebSearchTool } from '../../tools/computer.executor'
import { isMacOS } from '../../tools/macos/definitions'
import { executeMacOSLaunchAppTool, executeMacOSMailTool, executeMacOSCalendarTool, executeMacOSContactsTool } from '../../tools/macos/executor'
import { executeMacOSShowTool, executeMacOSCloseTool } from '../../tools/macos/visual.executor'
import { executeTelegramTool } from '../../tools/telegram.executor'
import { executeDiscordTool } from '../../tools/discord.executor'
import { executeWhatsAppTool } from '../../tools/whatsapp.executor'
import { executeSlackTool } from '../../tools/slack.executor'
import { executeLineTool } from '../../tools/line.executor'
import { executeFeishuTool } from '../../tools/feishu.executor'
import { executeYumiTool } from '../../tools/yumi.executor'
import { executeServiceTool } from '../../tools/service.executor'
import { mcpService } from '../mcp.service'
import type { MessagePlatform, ToolResult } from './types'

/**
 * Execute a single tool by name
 * @param name Tool name
 * @param input Tool input parameters
 * @param currentPlatform Current messaging platform context
 */
export async function executeTool(
  name: string,
  input: unknown,
  currentPlatform: MessagePlatform
): Promise<ToolResult> {
  // Computer use tools
  switch (name) {
    case 'computer':
      return await executeComputerTool(input as Parameters<typeof executeComputerTool>[0])

    case 'bash':
      return await executeBashTool(input as Parameters<typeof executeBashTool>[0])

    case 'str_replace_editor':
      return await executeTextEditorTool(input as Parameters<typeof executeTextEditorTool>[0])

    case 'download_file':
      return await executeDownloadFileTool(input as Parameters<typeof executeDownloadFileTool>[0])

    case 'web_search':
      return await executeWebSearchTool(input as Parameters<typeof executeWebSearchTool>[0])
  }

  // macOS-specific tools
  if (isMacOS()) {
    switch (name) {
      case 'macos_launch_app':
        return await executeMacOSLaunchAppTool(input as Parameters<typeof executeMacOSLaunchAppTool>[0])
      case 'macos_mail':
        return await executeMacOSMailTool(input as Parameters<typeof executeMacOSMailTool>[0])
      case 'macos_calendar':
        return await executeMacOSCalendarTool(input as Parameters<typeof executeMacOSCalendarTool>[0])
      case 'macos_contacts':
        return await executeMacOSContactsTool(input as Parameters<typeof executeMacOSContactsTool>[0])
      // Visual demo tools (experimental)
      case 'macos_show':
        return await executeMacOSShowTool(input as Parameters<typeof executeMacOSShowTool>[0])
      case 'macos_close':
        return await executeMacOSCloseTool(input as Parameters<typeof executeMacOSCloseTool>[0])
    }
  }

  // Telegram tools
  if (name.startsWith('telegram_')) {
    if (currentPlatform !== 'telegram') {
      return { success: false, error: `Telegram tools are not available in ${currentPlatform} context` }
    }
    return await executeTelegramTool(name, input)
  }

  // Discord tools
  if (name.startsWith('discord_')) {
    if (currentPlatform !== 'discord') {
      return { success: false, error: `Discord tools are not available in ${currentPlatform} context` }
    }
    return await executeDiscordTool(name, input)
  }

  // WhatsApp tools
  if (name.startsWith('whatsapp_')) {
    if (currentPlatform !== 'whatsapp') {
      return { success: false, error: `WhatsApp tools are not available in ${currentPlatform} context` }
    }
    return await executeWhatsAppTool(name, input)
  }

  // Slack tools
  if (name.startsWith('slack_')) {
    if (currentPlatform !== 'slack') {
      return { success: false, error: `Slack tools are not available in ${currentPlatform} context` }
    }
    return await executeSlackTool(name, input)
  }

  // Line tools
  if (name.startsWith('line_')) {
    if (currentPlatform !== 'line') {
      return { success: false, error: `Line tools are not available in ${currentPlatform} context` }
    }
    return await executeLineTool(name, input)
  }

  // Feishu tools
  if (name.startsWith('feishu_')) {
    if (currentPlatform !== 'feishu') {
      return { success: false, error: `Feishu tools are not available in ${currentPlatform} context` }
    }
    return await executeFeishuTool(name, input)
  }

  // Yumi tools
  if (name.startsWith('yumi_')) {
    if (currentPlatform !== 'yumi') {
      return { success: false, error: `Yumi tools are not available in ${currentPlatform} context` }
    }
    return await executeYumiTool(name, input)
  }

  // Service tools
  if (name.startsWith('service_')) {
    return await executeServiceTool(name, input)
  }

  // MCP tools
  if (mcpService.isMcpTool(name)) {
    return await mcpService.executeTool(name, input)
  }

  return { success: false, error: `Unknown tool: ${name}` }
}
