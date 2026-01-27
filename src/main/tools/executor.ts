import { fileService } from '../services/file.service'
import type {
  ReadFileInput,
  WriteFileInput,
  ListDirectoryInput,
  DeleteFileInput,
  CreateDirectoryInput,
  FileInfoInput,
  ToolResult
} from '../types'

/**
 * Execute a tool by name with the given input
 */
export async function executeTool(
  toolName: string,
  toolInput: unknown
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'read_file':
        return await executeReadFile(toolInput as ReadFileInput)

      case 'write_file':
        return await executeWriteFile(toolInput as WriteFileInput)

      case 'list_directory':
        return await executeListDirectory(toolInput as ListDirectoryInput)

      case 'delete_file':
        return await executeDeleteFile(toolInput as DeleteFileInput)

      case 'create_directory':
        return await executeCreateDirectory(toolInput as CreateDirectoryInput)

      case 'get_file_info':
        return await executeGetFileInfo(toolInput as FileInfoInput)

      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`
        }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function executeReadFile(input: ReadFileInput): Promise<ToolResult> {
  const content = await fileService.readFile(input.path)
  return { success: true, data: content }
}

async function executeWriteFile(input: WriteFileInput): Promise<ToolResult> {
  await fileService.writeFile(input.path, input.content)
  return { success: true, data: `File written successfully: ${input.path}` }
}

async function executeListDirectory(input: ListDirectoryInput): Promise<ToolResult> {
  const files = await fileService.listDirectory(input.path)
  return { success: true, data: files }
}

async function executeDeleteFile(input: DeleteFileInput): Promise<ToolResult> {
  await fileService.deleteFile(input.path)
  return { success: true, data: `Deleted successfully: ${input.path}` }
}

async function executeCreateDirectory(input: CreateDirectoryInput): Promise<ToolResult> {
  await fileService.createDirectory(input.path)
  return { success: true, data: `Directory created: ${input.path}` }
}

async function executeGetFileInfo(input: FileInfoInput): Promise<ToolResult> {
  const info = await fileService.getFileInfo(input.path)
  return { success: true, data: info }
}
