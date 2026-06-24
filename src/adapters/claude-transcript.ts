import type { SessionAdapter } from './types'
import type {
  ContentBlock,
  ConversationListItem,
  ConversationRole,
  EventCategory,
  ExplorerSession,
  ParsedLine,
  TimelineEvent,
} from '../core/types'

const PREVIEW_LIMIT = 120

function truncate(text: string, limit = PREVIEW_LIMIT): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}…`
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? undefined : ms
  }
  if (typeof value === 'number') return value
  return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function isToolResultUser(record: Record<string, unknown>): boolean {
  if (record.type !== 'user' || !isRecord(record.message)) return false
  const content = record.message.content
  if (!Array.isArray(content) || content.length === 0) return false
  const first = content[0]
  return isRecord(first) && first.type === 'tool_result'
}

function extractUserText(record: Record<string, unknown>): string {
  if (!isRecord(record.message)) return ''
  const content = record.message.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (!isRecord(part)) return ''
      if (part.type === 'text' && typeof part.text === 'string') return part.text
      if (part.type === 'tool_result' && typeof part.content === 'string') {
        return part.content
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function extractContentBlocks(record: Record<string, unknown>): ContentBlock[] {
  if (!isRecord(record.message) || !Array.isArray(record.message.content)) {
    return []
  }

  const blocks: ContentBlock[] = []
  for (const part of record.message.content) {
    if (!isRecord(part)) continue
    if (part.type === 'text' && typeof part.text === 'string') {
      blocks.push({ type: 'text', text: part.text })
    } else if (part.type === 'thinking' && typeof part.thinking === 'string') {
      blocks.push({ type: 'thinking', text: part.thinking })
    } else if (part.type === 'tool_use' && typeof part.name === 'string') {
      const input = isRecord(part.input) ? part.input : {}
      blocks.push({
        type: 'tool_use',
        text: JSON.stringify(input, null, 2),
        toolName: part.name,
        toolInput: input,
      })
    }
  }
  return blocks
}

function blockToRole(block: ContentBlock): ConversationRole {
  if (block.type === 'thinking') return 'thinking'
  if (block.type === 'tool_use') return 'tool_call'
  return 'assistant'
}

function blockLabel(block: ContentBlock): string {
  if (block.type === 'tool_use') return `tool_use ${block.toolName ?? 'unknown'}`
  if (block.type === 'thinking') return 'thinking'
  return 'text'
}

function blockPreview(block: ContentBlock): string {
  if (block.type === 'tool_use') {
    return truncate(`${block.toolName}: ${block.text}`)
  }
  return truncate(block.text)
}

function timelineCategory(
  type: string,
  record: Record<string, unknown>,
): EventCategory {
  if (type === 'user') {
    return isToolResultUser(record) ? 'tool' : 'user'
  }
  if (type === 'assistant') return 'assistant'
  if (type === 'file-history-snapshot') return 'meta'
  return 'unknown'
}

function timelineLabel(type: string, record: Record<string, unknown>): string {
  if (type === 'user') {
    if (isToolResultUser(record)) {
      const content = record.message as Record<string, unknown>
      const parts = content.content as unknown[]
      const first = parts?.[0] as Record<string, unknown> | undefined
      const toolId = first?.tool_use_id
      return typeof toolId === 'string' ? `tool_result ${toolId.slice(0, 12)}` : 'tool_result'
    }
    return 'user'
  }
  if (type === 'assistant') {
    const blocks = extractContentBlocks(record)
    if (blocks.length === 1) return blockLabel(blocks[0]!)
    if (blocks.length > 1) return `assistant (${blocks.length} blocks)`
    return 'assistant'
  }
  if (type === 'file-history-snapshot') return 'file-history-snapshot'
  return type
}

function timelinePreview(type: string, record: Record<string, unknown>): string {
  if (type === 'user') return truncate(extractUserText(record))
  if (type === 'assistant') {
    const blocks = extractContentBlocks(record)
    if (blocks.length > 0) return blockPreview(blocks[0]!)
    return ''
  }
  return ''
}

export const claudeTranscriptAdapter: SessionAdapter = {
  id: 'claude-code-transcript',
  label: 'Claude Code Transcript',

  detect(samples: ParsedLine[]): number {
    if (samples.length === 0) return 0
    let hits = 0
    for (const sample of samples) {
      if (!isRecord(sample.data)) continue
      const type = getString(sample.data, 'type')
      const uuid = getString(sample.data, 'uuid')
      const hasMessage = isRecord(sample.data.message)
      if ((type === 'user' || type === 'assistant') && uuid && hasMessage) {
        hits++
      }
    }
    return hits / samples.length
  },

  parse(lines: ParsedLine[], fileName: string): ExplorerSession {
    const events: TimelineEvent[] = []
    const conversationItems: ConversationListItem[] = []

    let turnIndex = 0
    let sessionId: string | undefined
    let model: string | undefined
    let cwd: string | undefined
    let version: string | undefined
    const turnSet = new Set<number>()

    for (const line of lines) {
      const record = line.data
      if (!isRecord(record)) continue

      const type = getString(record, 'type') ?? 'unknown'
      const eventId = `line-${line.lineIndex}`

      sessionId ??= getString(record, 'sessionId')
      cwd ??= getString(record, 'cwd')
      version ??= getString(record, 'version')

      if (type === 'user' && !isToolResultUser(record)) {
        turnIndex++
        turnSet.add(turnIndex)
      } else if (turnIndex === 0) {
        turnIndex = 1
        turnSet.add(1)
      }

      const linkedItemIds: string[] = []

      if (type === 'user') {
        if (isToolResultUser(record)) {
          const content = record.message as Record<string, unknown>
          const parts = content.content as unknown[]
          const first = parts?.[0] as Record<string, unknown> | undefined
          const toolCallId =
            typeof first?.tool_use_id === 'string' ? first.tool_use_id : undefined
          const isError = first?.is_error === true
          const text = extractUserText(record)

          const itemId = `conv-${line.lineIndex}-tool-result`
          conversationItems.push({
            id: itemId,
            turnIndex,
            role: 'tool_result',
            preview: truncate(text || '(empty tool result)'),
            toolCallId,
            status: isError ? 'failed' : 'completed',
            linkedEventIds: [eventId],
            raw: record,
          })
          linkedItemIds.push(itemId)
        } else {
          const text = extractUserText(record)
          const itemId = `conv-${line.lineIndex}-user`
          conversationItems.push({
            id: itemId,
            turnIndex,
            role: 'user',
            preview: truncate(text),
            blocks: text ? [{ type: 'text', text }] : [],
            linkedEventIds: [eventId],
            raw: record,
          })
          linkedItemIds.push(itemId)
        }
      } else if (type === 'assistant') {
        const blocks = extractContentBlocks(record)
        if (isRecord(record.message) && typeof record.message.model === 'string') {
          model = record.message.model
        }

        if (blocks.length === 0) {
          const itemId = `conv-${line.lineIndex}-assistant`
          conversationItems.push({
            id: itemId,
            turnIndex,
            role: 'assistant',
            preview: '(empty assistant message)',
            linkedEventIds: [eventId],
            raw: record,
          })
          linkedItemIds.push(itemId)
        } else {
          blocks.forEach((block, blockIndex) => {
            const itemId = `conv-${line.lineIndex}-block-${blockIndex}`
            const role = blockToRole(block)
            conversationItems.push({
              id: itemId,
              turnIndex,
              role,
              preview: blockPreview(block),
              blocks: [block],
              toolCallId:
                block.type === 'tool_use' && isRecord(record.message)
                  ? undefined
                  : undefined,
              status: block.type === 'tool_use' ? 'pending' : undefined,
              linkedEventIds: [eventId],
              raw: record,
            })
            linkedItemIds.push(itemId)

            if (block.type === 'tool_use' && isRecord(record.message)) {
              const content = record.message.content as unknown[]
              const part = content?.[blockIndex] as Record<string, unknown> | undefined
              if (part && typeof part.id === 'string') {
                const item = conversationItems[conversationItems.length - 1]!
                item.toolCallId = part.id
              }
            }
          })
        }
      }

      events.push({
        id: eventId,
        lineIndex: line.lineIndex,
        timestamp: parseTimestamp(record.timestamp),
        category: timelineCategory(type, record),
        kind: type,
        label: timelineLabel(type, record),
        preview: timelinePreview(type, record),
        turnIndex,
        conversationItemId: linkedItemIds[0],
        raw: record,
      })
    }

    return {
      adapterId: 'claude-code-transcript',
      fileName,
      meta: {
        sessionId,
        model,
        cwd,
        version,
        eventCount: events.length,
        turnCount: turnSet.size,
      },
      events,
      conversationItems,
      parseWarnings: [],
    }
  },
}