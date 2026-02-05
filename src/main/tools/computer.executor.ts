/**
 * Computer tools executor
 * Re-exports from the modular computer/ directory
 *
 * Platform-specific implementations:
 * - computer/macos.ts - macOS mouse/keyboard using cliclick and Python/Quartz
 * - computer/windows.ts - Windows mouse/keyboard using nut.js
 * - computer/common.ts - Shared functionality (screenshot, bash, text editor, etc.)
 * - computer/index.ts - Unified entry point with platform detection
 */

export {
  executeComputerTool,
  truncateOutput,
  executeBashTool,
  executeTextEditorTool,
  executeDownloadFileTool,
  executeWebSearchTool
} from './computer'
