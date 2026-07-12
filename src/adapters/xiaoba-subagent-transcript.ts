import type { SessionAdapter } from './types'
import { truncateBlockText, truncatePreview } from '../core/text'
import type { ConversationListItem, ExplorerSession, ParsedLine, TimelineEvent } from '../core/types'

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === 'string' ? value[key] : undefined
}

function number(value: Record<string, unknown>, key: string): number | undefined {
  return typeof value[key] === 'number' ? value[key] : undefined
}

function isTranscriptRecord(value: unknown): value is Record<string, unknown> {
  if (!record(value)) return false
  return value.version === 1
    && typeof value.recordType === 'string'
    && typeof value.runId === 'string'
    && typeof value.agent === 'string'
    && typeof value.timestamp === 'string'
}

function addItem(
  items: ConversationListItem[],
  event: TimelineEvent,
  role: ConversationListItem['role'],
  suffix: string,
  block?: ConversationListItem['block'],
): void {
  const item = { id: `conv-${event.lineIndex}-${suffix}`, event, role, block }
  items.push(item)
  event.conversationItem ??= item
}

export const xiaobaSubagentTranscriptAdapter: SessionAdapter = {
  detect(samples: ParsedLine[]): number {
    if (samples.length === 0) return 0
    const hits = samples.filter(sample => isTranscriptRecord(sample.data)).length
    return hits / samples.length
  },

  parse(lines: ParsedLine[], fileName: string): ExplorerSession {
    const events: TimelineEvent[] = []
    const conversationItems: ConversationListItem[] = []
    const pendingByName = new Map<string, string[]>()
    let runId: string | undefined
    let model: string | undefined
    let cwd: string | undefined
    let turn = 0
    let sequence = 0

    for (const line of lines) {
      if (!isTranscriptRecord(line.data)) continue
      const entry = line.data
      const recordType = text(entry, 'recordType') ?? 'event'
      const role = text(entry, 'role')
      runId ??= text(entry, 'runId')
      cwd ??= text(entry, 'cwd')
      model ??= text(entry, 'model')
      if (recordType === 'message' && role === 'user') turn++

      const toolName = text(entry, 'toolName')
      const isTool = recordType === 'tool_start' || recordType === 'tool_end'
      const event: TimelineEvent = {
        id: `line-${line.lineIndex}`,
        lineIndex: line.lineIndex,
        timestamp: number(entry, 'ts') ?? Date.parse(text(entry, 'timestamp') ?? ''),
        timestampLabel: text(entry, 'timestamp'),
        category: isTool ? 'tool' : role === 'user' ? 'user' : 'assistant',
        kind: recordType === 'tool_start' ? 'tool_call' : recordType === 'tool_end' ? 'tool_result' : role ?? recordType,
        label: isTool
          ? `${recordType === 'tool_start' ? 'tool_use' : 'tool_result'} ${toolName ?? 'tool'}`
          : `${text(entry, 'agent') ?? 'subagent'} ${role ?? recordType}`,
        preview: truncatePreview(text(entry, 'text') ?? text(entry, 'argsPreview') ?? ''),
        turnIndex: turn || 1,
        requestId: text(entry, 'runId'),
        sessionId: text(entry, 'runId'),
        cwd: text(entry, 'cwd'),
        model: text(entry, 'model'),
        role,
        stopReason: text(entry, 'stopReason'),
        raw: entry,
      }

      if (recordType === 'message') {
        const message = record(entry.message) ? entry.message : undefined
        const content = message && Array.isArray(message.content) ? message.content : []
        for (let index = 0; index < content.length; index++) {
          const block = content[index]
          if (!record(block)) continue
          const type = text(block, 'type')
          if (type === 'thinking') {
            const value = text(block, 'thinking') ?? ''
            addItem(conversationItems, event, 'thinking', `thinking-${index}`, value
              ? { type: 'thinking', text: truncateBlockText(value) }
              : undefined)
          } else if (type === 'text') {
            const value = text(block, 'text') ?? ''
            addItem(
              conversationItems,
              event,
              role === 'user' ? 'user' : 'assistant',
              `text-${index}`,
              value ? { type: 'text', text: truncateBlockText(value) } : undefined,
            )
          } else if (type === 'toolCall') {
            const name = text(block, 'name') ?? 'tool'
            const callId = text(block, 'id') ?? `subagent-call-${sequence++}`
            const args = block.arguments
            const queue = pendingByName.get(name) ?? []
            queue.push(callId)
            pendingByName.set(name, queue)
            addItem(conversationItems, event, 'tool_call', `tool-${index}`, {
              type: 'tool_use',
              text: truncateBlockText(JSON.stringify(args ?? {}, null, 2)),
              toolName: name,
              toolInput: record(args) ? args : { raw: args },
              toolCallId: callId,
              status: 'pending',
            })
          }
        }
        if (content.length === 0) {
          const value = text(entry, 'text') ?? ''
          addItem(
            conversationItems,
            event,
            role === 'user' ? 'user' : 'assistant',
            role ?? 'message',
            value ? { type: 'text', text: truncateBlockText(value) } : undefined,
          )
        }
      } else if (recordType === 'tool_end' && toolName) {
        const queue = pendingByName.get(toolName) ?? []
        const callId = queue.shift() ?? `subagent-call-${sequence++}`
        if (queue.length > 0) pendingByName.set(toolName, queue)
        else pendingByName.delete(toolName)
        addItem(conversationItems, event, 'tool_result', 'tool-result', {
          type: 'text',
          text: 'Tool completed; this transcript did not record the result body.',
          toolName,
          toolCallId: callId,
          status: 'completed',
        })
      }
      events.push(event)
    }

    return {
      fileType: 'XiaoBa Subagent',
      fileName,
      meta: {
        sessionId: runId ?? fileName.replace(/\.jsonl$/i, ''),
        model,
        cwd,
        eventCount: events.length,
        turnCount: turn,
      },
      events,
      conversationItems,
      parseWarnings: [],
    }
  },
}
