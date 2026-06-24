import type { SessionAdapter } from './types'
import { truncateBlockText, truncatePreview } from '../core/text'
import type {
  ConversationListItem,
  ConversationRole,
  EventCategory,
  ExplorerSession,
  ParsedLine,
  TimelineEvent,
} from '../core/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? undefined : ms
  }
  if (typeof value === 'number') return value
  return undefined
}

function extractMessageText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (!isRecord(part)) return ''
      if (
        (part.type === 'input_text' || part.type === 'output_text') &&
        typeof part.text === 'string'
      ) {
        return part.text
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function shortCallId(callId: string | undefined): string | undefined {
  if (!callId) return undefined
  return callId.length > 12 ? callId.slice(0, 12) : callId
}

function messageRoleToConversationRole(role: string | undefined): ConversationRole {
  if (role === 'developer') return 'system'
  if (role === 'user') return 'user'
  if (role === 'assistant') return 'assistant'
  return 'system'
}

function messageRoleToCategory(role: string | undefined): EventCategory {
  if (role === 'developer') return 'system'
  if (role === 'user') return 'user'
  if (role === 'assistant') return 'assistant'
  return 'unknown'
}

function eventMsgCategory(kind: string): EventCategory {
  if (kind === 'user_message') return 'user'
  if (kind === 'agent_message') return 'assistant'
  if (kind === 'task_started' || kind === 'task_complete' || kind === 'token_count') {
    return 'meta'
  }
  return 'unknown'
}

function eventMsgLabel(kind: string): string {
  return kind
}

function eventMsgPreview(payload: Record<string, unknown>): string {
  const message = getString(payload, 'message')
  if (message) return truncatePreview(message)
  const turnId = getString(payload, 'turn_id')
  if (turnId) return truncatePreview(turnId)
  return ''
}

function parseToolArguments(argumentsJson: string | undefined): Record<string, unknown> {
  if (!argumentsJson) return {}
  try {
    const parsed: unknown = JSON.parse(argumentsJson)
    return isRecord(parsed) ? parsed : { raw: argumentsJson }
  } catch {
    return { raw: argumentsJson }
  }
}

function toolOutputText(output: unknown): string {
  if (typeof output === 'string') return output
  if (output === undefined || output === null) return ''
  return JSON.stringify(output, null, 2)
}

function isFailedToolOutput(payload: Record<string, unknown>): boolean {
  const output = getString(payload, 'output')
  if (!output) return false
  try {
    const parsed: unknown = JSON.parse(output)
    if (!isRecord(parsed)) return false
    const metadata = parsed.metadata
    if (isRecord(metadata) && typeof metadata.exit_code === 'number') {
      return metadata.exit_code !== 0
    }
  } catch {
    return false
  }
  return getString(payload, 'status') === 'failed'
}

export const codexRolloutAdapter: SessionAdapter = {
  detect(samples: ParsedLine[]): number {
    if (samples.length === 0) return 0
    let hits = 0
    for (const sample of samples) {
      if (!isRecord(sample.data)) continue
      const type = getString(sample.data, 'type')
      const payload = sample.data.payload
      if (
        (type === 'session_meta' ||
          type === 'event_msg' ||
          type === 'response_item' ||
          type === 'turn_context') &&
        isRecord(payload)
      ) {
        hits++
      }
    }
    return hits / samples.length
  },

  parse(lines: ParsedLine[], fileName: string): ExplorerSession {
    const events: TimelineEvent[] = []
    const conversationItems: ConversationListItem[] = []

    let sessionId: string | undefined
    let cwd: string | undefined
    let version: string | undefined
    let model: string | undefined
    let currentTurnId: string | undefined
    let defaultTurnIndex = 1
    const turnIdToIndex = new Map<string, number>()

    function registerTurn(turnId: string): number {
      const existing = turnIdToIndex.get(turnId)
      if (existing !== undefined) return existing
      const nextIndex = turnIdToIndex.size + 1
      turnIdToIndex.set(turnId, nextIndex)
      return nextIndex
    }

    function currentTurnIndex(): number {
      if (currentTurnId) return registerTurn(currentTurnId)
      return defaultTurnIndex
    }

    for (const line of lines) {
      const envelope = line.data
      if (!isRecord(envelope)) continue

      const envelopeType = getString(envelope, 'type') ?? 'unknown'
      const payload = envelope.payload
      if (!isRecord(payload)) continue

      const eventId = `line-${line.lineIndex}`
      const timestamp = parseTimestamp(envelope.timestamp)
      const linkedItemIds: string[] = []

      if (envelopeType === 'session_meta') {
        sessionId ??= getString(payload, 'id')
        cwd ??= getString(payload, 'cwd')
        version ??= getString(payload, 'cli_version')
      }

      if (envelopeType === 'turn_context') {
        const turnId = getString(payload, 'turn_id')
        if (turnId) currentTurnId = turnId
        cwd ??= getString(payload, 'cwd')
        model = getString(payload, 'model') ?? model
      }

      if (envelopeType === 'event_msg') {
        const kind = getString(payload, 'type') ?? 'event_msg'
        if (kind === 'task_started') {
          const turnId = getString(payload, 'turn_id')
          if (turnId) currentTurnId = turnId
        }
      }

      const turnIndex = currentTurnIndex()

      if (envelopeType === 'response_item') {
        const itemType = getString(payload, 'type') ?? 'response_item'

        if (itemType === 'message') {
          const role = getString(payload, 'role')
          const text = extractMessageText(payload.content)
          const conversationRole = messageRoleToConversationRole(role)

          const itemId = `conv-${line.lineIndex}-${conversationRole}`
          conversationItems.push({
            id: itemId,
            turnIndex,
            role: conversationRole,
            preview: truncatePreview(text || `(${role ?? 'message'})`),
            blocks: text ? [{ type: 'text', text: truncateBlockText(text) }] : [],
            linkedEventIds: [eventId],
            raw: envelope,
          })
          linkedItemIds.push(itemId)
        } else if (itemType === 'reasoning') {
          const summary = Array.isArray(payload.summary)
            ? payload.summary
                .map((entry) => (isRecord(entry) ? getString(entry, 'text') ?? '' : ''))
                .filter(Boolean)
                .join('\n')
            : ''
          const text = summary || '(encrypted reasoning)'

          const itemId = `conv-${line.lineIndex}-thinking`
          conversationItems.push({
            id: itemId,
            turnIndex,
            role: 'thinking',
            preview: truncatePreview(text),
            blocks: [{ type: 'thinking', text: truncateBlockText(text) }],
            linkedEventIds: [eventId],
            raw: envelope,
          })
          linkedItemIds.push(itemId)
        } else if (itemType === 'function_call' || itemType === 'custom_tool_call') {
          const toolName = getString(payload, 'name') ?? 'tool'
          const callId = getString(payload, 'call_id')
          const argsSource =
            itemType === 'function_call'
              ? getString(payload, 'arguments')
              : getString(payload, 'input')
          const toolInput = parseToolArguments(argsSource)
          const inputText = truncateBlockText(
            argsSource ? toolOutputText(argsSource) : JSON.stringify(toolInput, null, 2),
          )

          const itemId = `conv-${line.lineIndex}-tool-call`
          conversationItems.push({
            id: itemId,
            turnIndex,
            role: 'tool_call',
            preview: truncatePreview(`${toolName}: ${inputText}`),
            blocks: [
              {
                type: 'tool_use',
                text: inputText,
                toolName,
                toolInput,
              },
            ],
            toolCallId: callId,
            status: 'pending',
            linkedEventIds: [eventId],
            raw: envelope,
          })
          linkedItemIds.push(itemId)
        } else if (
          itemType === 'function_call_output' ||
          itemType === 'custom_tool_call_output'
        ) {
          const callId = getString(payload, 'call_id')
          const text = truncateBlockText(toolOutputText(payload.output))
          const failed = isFailedToolOutput(payload)

          const itemId = `conv-${line.lineIndex}-tool-result`
          conversationItems.push({
            id: itemId,
            turnIndex,
            role: 'tool_result',
            preview: truncatePreview(text || '(empty tool result)'),
            blocks: text ? [{ type: 'text', text }] : [],
            toolCallId: callId,
            status: failed ? 'failed' : 'completed',
            linkedEventIds: [eventId],
            raw: envelope,
          })
          linkedItemIds.push(itemId)
        }
      }

      let category: EventCategory = 'unknown'
      let kind = envelopeType
      let label = envelopeType
      let preview = ''

      if (envelopeType === 'session_meta') {
        category = 'meta'
        label = 'session_meta'
        preview = truncatePreview(sessionId ?? cwd ?? '')
      } else if (envelopeType === 'turn_context') {
        category = 'meta'
        label = 'turn_context'
        preview = truncatePreview(
          [getString(payload, 'model'), getString(payload, 'cwd')].filter(Boolean).join(' · '),
        )
      } else if (envelopeType === 'event_msg') {
        kind = getString(payload, 'type') ?? 'event_msg'
        category = eventMsgCategory(kind)
        label = eventMsgLabel(kind)
        preview = eventMsgPreview(payload)
      } else if (envelopeType === 'response_item') {
        const itemType = getString(payload, 'type') ?? 'response_item'
        kind = itemType

        if (itemType === 'message') {
          const role = getString(payload, 'role')
          category = messageRoleToCategory(role)
          label = role ?? 'message'
          preview = truncatePreview(extractMessageText(payload.content))
        } else if (itemType === 'reasoning') {
          category = 'thinking'
          label = 'reasoning'
          preview = truncatePreview(
            Array.isArray(payload.summary)
              ? payload.summary
                  .map((entry) => (isRecord(entry) ? getString(entry, 'text') ?? '' : ''))
                  .filter(Boolean)
                  .join(' ')
              : '(encrypted reasoning)',
          )
        } else if (itemType === 'function_call' || itemType === 'custom_tool_call') {
          category = 'tool'
          const toolName = getString(payload, 'name') ?? 'tool'
          label = `tool_use ${toolName}`
          preview = truncatePreview(
            getString(payload, 'arguments') ?? getString(payload, 'input') ?? '',
          )
        } else if (
          itemType === 'function_call_output' ||
          itemType === 'custom_tool_call_output'
        ) {
          category = 'tool'
          label = `tool_result ${shortCallId(getString(payload, 'call_id')) ?? 'unknown'}`
          preview = truncatePreview(toolOutputText(payload.output))
        } else {
          label = itemType
        }
      }

      events.push({
        id: eventId,
        lineIndex: line.lineIndex,
        timestamp,
        category,
        kind,
        label,
        preview,
        turnIndex,
        conversationItemId: linkedItemIds[0],
        raw: envelope,
      })
    }

    const turnCount =
      turnIdToIndex.size > 0 ? turnIdToIndex.size : conversationItems.length > 0 ? 1 : 0

    return {
      fileType: 'Codex',
      fileName,
      meta: {
        sessionId,
        model,
        cwd,
        version,
        eventCount: events.length,
        turnCount,
      },
      events,
      conversationItems,
      parseWarnings: [],
    }
  },
}