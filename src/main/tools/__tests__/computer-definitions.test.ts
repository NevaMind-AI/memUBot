/**
 * Layer 1: Computer tool definitions specific tests
 * Validates that the exported computerUseTools array has the right tools
 */

import { describe, it, expect } from 'vitest'
import {
  computerTool,
  bashTool,
  textEditorTool,
  downloadFileTool,
  webSearchTool,
  computerUseTools
} from '../computer.definitions'

describe('Computer tool definitions', () => {
  describe('computerTool (mouse/keyboard)', () => {
    it('should be named "computer"', () => {
      expect(computerTool.name).toBe('computer')
    })

    it('should support all expected actions', () => {
      const actionProp = (
        computerTool.input_schema as {
          properties: { action: { enum: string[] } }
        }
      ).properties.action
      expect(actionProp.enum).toEqual(
        expect.arrayContaining([
          'screenshot',
          'mouse_move',
          'left_click',
          'right_click',
          'double_click',
          'type',
          'key',
          'scroll'
        ])
      )
    })

    it('should NOT be included in computerUseTools (disabled for stability)', () => {
      const names = computerUseTools.map((t) => t.name)
      expect(names).not.toContain('computer')
    })
  })

  describe('bashTool', () => {
    it('should be named "bash"', () => {
      expect(bashTool.name).toBe('bash')
    })

    it('should require command parameter', () => {
      const schema = bashTool.input_schema as { required: string[] }
      expect(schema.required).toContain('command')
    })

    it('should have optional timeout parameter', () => {
      const schema = bashTool.input_schema as {
        properties: Record<string, { type: string }>
      }
      expect(schema.properties.timeout).toBeDefined()
      expect(schema.properties.timeout.type).toBe('number')
    })
  })

  describe('textEditorTool', () => {
    it('should be named "str_replace_editor"', () => {
      expect(textEditorTool.name).toBe('str_replace_editor')
    })

    it('should support view, create, str_replace, insert commands', () => {
      const schema = textEditorTool.input_schema as {
        properties: { command: { enum: string[] } }
      }
      expect(schema.properties.command.enum).toEqual(['view', 'create', 'str_replace', 'insert'])
    })

    it('should require command and path', () => {
      const schema = textEditorTool.input_schema as { required: string[] }
      expect(schema.required).toContain('command')
      expect(schema.required).toContain('path')
    })
  })

  describe('downloadFileTool', () => {
    it('should be named "download_file"', () => {
      expect(downloadFileTool.name).toBe('download_file')
    })

    it('should require url parameter', () => {
      const schema = downloadFileTool.input_schema as { required: string[] }
      expect(schema.required).toContain('url')
    })

    it('should have optional filename and output_dir', () => {
      const schema = downloadFileTool.input_schema as {
        properties: Record<string, unknown>
      }
      expect(schema.properties.filename).toBeDefined()
      expect(schema.properties.output_dir).toBeDefined()
    })
  })

  describe('webSearchTool', () => {
    it('should be named "web_search"', () => {
      expect(webSearchTool.name).toBe('web_search')
    })

    it('should require query parameter', () => {
      const schema = webSearchTool.input_schema as { required: string[] }
      expect(schema.required).toContain('query')
    })
  })

  describe('computerUseTools (exported array)', () => {
    it('should contain exactly 4 tools', () => {
      expect(computerUseTools).toHaveLength(4)
    })

    it('should contain bash, str_replace_editor, download_file, web_search', () => {
      const names = computerUseTools.map((t) => t.name)
      expect(names).toEqual(['bash', 'str_replace_editor', 'download_file', 'web_search'])
    })
  })
})
