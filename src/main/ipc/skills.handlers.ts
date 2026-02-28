import { ipcMain } from 'electron'
import { skillsService } from '../services/skills.service'

/**
 * Register skills IPC handlers
 */
export function registerSkillsHandlers(): void {
  // Get all installed skills
  ipcMain.handle('skills:getInstalled', async () => {
    try {
      const skills = await skillsService.getInstalledSkills()
      return { success: true, data: skills }
    } catch (error) {
      console.error('[Skills IPC] Failed to get installed skills:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Enable or disable a skill
  ipcMain.handle('skills:setEnabled', async (_, skillId: string, enabled: boolean) => {
    try {
      const result = await skillsService.setSkillEnabled(skillId, enabled)
      return { success: result }
    } catch (error) {
      console.error('[Skills IPC] Failed to set skill enabled:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Delete a skill
  ipcMain.handle('skills:delete', async (_, skillId: string) => {
    try {
      const result = await skillsService.deleteSkill(skillId)
      return { success: result }
    } catch (error) {
      console.error('[Skills IPC] Failed to delete skill:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Import a skill from a local directory
  ipcMain.handle('skills:importFromDirectory', async () => {
    try {
      const { dialog } = await import('electron')

      // Open folder selection dialog
      const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: 'Select Skill Directory',
        buttonLabel: 'Import Skill'
      })

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'No directory selected' }
      }

      const selectedPath = result.filePaths[0]
      const skill = await skillsService.importFromDirectory(selectedPath)

      if (skill) {
        return { success: true, data: skill }
      }
      return {
        success: false,
        error: 'Invalid skill directory. Make sure it contains a valid SKILL.md file with a name field.'
      }
    } catch (error) {
      console.error('[Skills IPC] Failed to import skill:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Search GitHub skills
  ipcMain.handle('skills:searchGitHub', async (_, query: string) => {
    try {
      const skills = await skillsService.searchGitHubSkills(query)
      return { success: true, data: skills }
    } catch (error) {
      console.error('[Skills IPC] Failed to search GitHub skills:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Install from GitHub
  ipcMain.handle('skills:installFromGitHub', async (_, skillPath: string) => {
    try {
      const skill = await skillsService.installFromGitHub(skillPath)
      if (skill) {
        return { success: true, data: skill }
      }
      return { success: false, error: 'Failed to install skill' }
    } catch (error) {
      console.error('[Skills IPC] Failed to install from GitHub:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Get skill content
  ipcMain.handle('skills:getContent', async (_, skillId: string) => {
    try {
      const content = await skillsService.getSkillContent(skillId)
      return { success: true, data: content }
    } catch (error) {
      console.error('[Skills IPC] Failed to get skill content:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Open skills directory
  ipcMain.handle('skills:openDirectory', async () => {
    try {
      const { shell } = await import('electron')
      const skillsDir = skillsService.getSkillsDir()
      await shell.openPath(skillsDir)
      return { success: true }
    } catch (error) {
      console.error('[Skills IPC] Failed to open skills directory:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Set GitHub token
  ipcMain.handle('skills:setGitHubToken', async (_, token: string | undefined) => {
    try {
      await skillsService.setGitHubToken(token)
      return { success: true }
    } catch (error) {
      console.error('[Skills IPC] Failed to set GitHub token:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  // Get GitHub token
  ipcMain.handle('skills:getGitHubToken', async () => {
    try {
      const token = await skillsService.getGitHubToken()
      return { success: true, data: token }
    } catch (error) {
      console.error('[Skills IPC] Failed to get GitHub token:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  })

  console.log('[Skills IPC] Handlers registered')
}
