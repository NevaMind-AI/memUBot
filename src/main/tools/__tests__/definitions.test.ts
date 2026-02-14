/**
 * Layer 1: Tool definitions schema validation
 * Ensures all tool definitions follow the Anthropic Tool format correctly
 */

import { describe, it, expect } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { fileTools } from '../definitions'
import { computerUseTools } from '../computer.definitions'
import { memuTools } from '../memu.definitions'
import { serviceTools } from '../service.definitions'
import { yumiTools } from '../yumi.definitions'
import { slackTools } from '../slack.definitions'
import { telegramTools } from '../telegram.definitions'
import { discordTools } from '../discord.definitions'
import { whatsappTools } from '../whatsapp.definitions'
import { lineTools } from '../line.definitions'
import { feishuTools } from '../feishu.definitions'
import { mailTool, calendarTool, contactsTool, appLauncherTool } from '../macos/definitions'
import { macosShowTool, macosCloseTool } from '../macos/visual.definitions'

// macOS tools are individual exports, group them for testing
const macosTools: Anthropic.Tool[] = [appLauncherTool, mailTool, calendarTool, contactsTool]
const macosVisualTools: Anthropic.Tool[] = [macosShowTool, macosCloseTool]

// All tool groups to validate
const allToolGroups: { name: string; tools: Anthropic.Tool[] }[] = [
  { name: 'file', tools: fileTools },
  { name: 'computer', tools: computerUseTools },
  { name: 'memu', tools: memuTools },
  { name: 'service', tools: serviceTools },
  { name: 'yumi', tools: yumiTools },
  { name: 'slack', tools: slackTools },
  { name: 'telegram', tools: telegramTools },
  { name: 'discord', tools: discordTools },
  { name: 'whatsapp', tools: whatsappTools },
  { name: 'line', tools: lineTools },
  { name: 'feishu', tools: feishuTools },
  { name: 'macos', tools: macosTools },
  { name: 'macos_visual', tools: macosVisualTools }
]

// Valid JSON Schema types
const VALID_TYPES = ['string', 'number', 'boolean', 'object', 'array', 'integer', 'null']

/**
 * Recursively validate a JSON Schema property
 */
function validateSchemaProperty(
  prop: Record<string, unknown>,
  path: string
): string[] {
  const errors: string[] = []

  if (!prop.type) {
    errors.push(`${path}: missing 'type'`)
    return errors
  }

  if (!VALID_TYPES.includes(prop.type as string)) {
    errors.push(`${path}: invalid type '${prop.type}'`)
  }

  // Validate array items
  if (prop.type === 'array' && prop.items) {
    const items = prop.items as Record<string, unknown>
    errors.push(...validateSchemaProperty(items, `${path}.items`))
  }

  // Validate nested object properties
  if (prop.type === 'object' && prop.properties) {
    const properties = prop.properties as Record<string, Record<string, unknown>>
    for (const [key, value] of Object.entries(properties)) {
      errors.push(...validateSchemaProperty(value, `${path}.properties.${key}`))
    }
  }

  return errors
}

describe('Tool definitions schema validation', () => {
  // Global uniqueness check across ALL tool groups
  describe('global constraints', () => {
    it('should have unique tool names across all groups', () => {
      const allNames: string[] = []
      for (const group of allToolGroups) {
        allNames.push(...group.tools.map((t) => t.name))
      }
      const duplicates = allNames.filter((name, idx) => allNames.indexOf(name) !== idx)
      expect(duplicates).toEqual([])
    })

    it('should have at least one tool in each group', () => {
      for (const group of allToolGroups) {
        expect(group.tools.length).toBeGreaterThan(0)
      }
    })
  })

  // Per-group validation
  for (const { name: groupName, tools } of allToolGroups) {
    describe(`${groupName} tools`, () => {
      it('should have unique names within group', () => {
        const names = tools.map((t) => t.name)
        expect(new Set(names).size).toBe(names.length)
      })

      for (const tool of tools) {
        describe(`${tool.name}`, () => {
          it('should have a non-empty name', () => {
            expect(tool.name).toBeTruthy()
            expect(typeof tool.name).toBe('string')
            expect(tool.name.length).toBeGreaterThan(0)
          })

          it('should have a non-empty description', () => {
            expect(tool.description).toBeTruthy()
            expect(typeof tool.description).toBe('string')
            expect(tool.description!.length).toBeGreaterThan(0)
          })

          it('should have a valid input_schema', () => {
            expect(tool.input_schema).toBeDefined()
            expect(tool.input_schema.type).toBe('object')
          })

          it('should have valid property types in schema', () => {
            const schema = tool.input_schema as {
              properties?: Record<string, Record<string, unknown>>
            }
            if (schema.properties) {
              const errors: string[] = []
              for (const [key, value] of Object.entries(schema.properties)) {
                errors.push(...validateSchemaProperty(value, key))
              }
              expect(errors).toEqual([])
            }
          })

          it('should have descriptions for all properties', () => {
            const schema = tool.input_schema as {
              properties?: Record<string, { description?: string }>
            }
            if (schema.properties) {
              for (const [key, value] of Object.entries(schema.properties)) {
                expect(value.description, `property '${key}' missing description`).toBeTruthy()
              }
            }
          })

          it('should only require properties that exist', () => {
            const schema = tool.input_schema as {
              properties?: Record<string, unknown>
              required?: string[]
            }
            if (schema.required && schema.required.length > 0) {
              const propertyNames = Object.keys(schema.properties || {})
              for (const req of schema.required) {
                expect(
                  propertyNames,
                  `required property '${req}' not found in properties`
                ).toContain(req)
              }
            }
          })

          it('should use snake_case for tool name', () => {
            expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/)
          })
        })
      }
    })
  }
})

// Count verification
describe('Tool count verification', () => {
  it('file tools should have 7 tools', () => {
    expect(fileTools).toHaveLength(7)
  })

  it('computer tools should have 4 tools (bash, editor, download, search)', () => {
    expect(computerUseTools).toHaveLength(4)
  })

  it('memu tools should have 1 tool', () => {
    expect(memuTools).toHaveLength(1)
  })

  it('service tools should have 7 tools', () => {
    expect(serviceTools).toHaveLength(7)
  })

  it('yumi tools should have 4 tools', () => {
    expect(yumiTools).toHaveLength(4)
  })

  it('slack tools should have 6 tools', () => {
    expect(slackTools).toHaveLength(6)
  })

  it('telegram tools should have 12 tools', () => {
    expect(telegramTools).toHaveLength(12)
  })

  it('discord tools should have 8 tools', () => {
    expect(discordTools).toHaveLength(8)
  })

  it('whatsapp tools should have 6 tools', () => {
    expect(whatsappTools).toHaveLength(6)
  })

  it('line tools should have 7 tools', () => {
    expect(lineTools).toHaveLength(7)
  })

  it('feishu tools should have 5 tools', () => {
    expect(feishuTools).toHaveLength(5)
  })

  it('macOS tools should have 4 tools (launcher, mail, calendar, contacts)', () => {
    expect(macosTools).toHaveLength(4)
  })

  it('macOS visual tools should have 2 tools (show, close)', () => {
    expect(macosVisualTools).toHaveLength(2)
  })
})

// Platform naming convention checks
describe('Platform naming conventions', () => {
  const platformPrefixes: Record<string, string> = {
    yumi: 'yumi_',
    slack: 'slack_',
    telegram: 'telegram_',
    discord: 'discord_',
    whatsapp: 'whatsapp_',
    line: 'line_',
    feishu: 'feishu_',
    macos: 'macos_',
    macos_visual: 'macos_'
  }

  for (const [platform, prefix] of Object.entries(platformPrefixes)) {
    const group = allToolGroups.find((g) => g.name === platform)!

    it(`${platform} tools should all start with '${prefix}'`, () => {
      for (const tool of group.tools) {
        expect(tool.name.startsWith(prefix), `${tool.name} should start with ${prefix}`).toBe(
          true
        )
      }
    })
  }

  // Each messaging platform should have a delete_chat_history tool
  const messagingPlatforms = ['yumi', 'slack', 'telegram', 'discord', 'whatsapp', 'line', 'feishu']
  for (const platform of messagingPlatforms) {
    const group = allToolGroups.find((g) => g.name === platform)!

    it(`${platform} should have a delete_chat_history tool`, () => {
      const deleteTool = group.tools.find((t) => t.name.endsWith('_delete_chat_history'))
      expect(deleteTool, `${platform} missing delete_chat_history tool`).toBeDefined()
    })
  }
})
