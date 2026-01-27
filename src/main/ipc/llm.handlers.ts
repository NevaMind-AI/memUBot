import { ipcMain } from 'electron'
import { agentService } from '../services/agent.service'

/**
 * Setup IPC handlers for LLM operations
 */
export function setupLLMHandlers(): void {
  // Get current LLM status
  ipcMain.handle('llm:get-status', () => {
    return agentService.getStatus()
  })

  // Abort current processing
  ipcMain.handle('llm:abort', () => {
    agentService.abort()
    return { success: true }
  })

  // Check if LLM is processing
  ipcMain.handle('llm:is-processing', () => {
    return agentService.isProcessing()
  })

  console.log('[IPC] LLM handlers registered')
}
