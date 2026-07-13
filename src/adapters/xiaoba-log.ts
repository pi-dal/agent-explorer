import {
  parseXiaoBaRuntimeActivity,
  parseXiaoBaRuntimeToolMessage,
  xiaobaRuntimeActivityLabel,
} from '../core/xiaoba'
import { truncateBlockText, truncatePreview } from '../core/text'
import type {
  ConversationListItem,
  ExplorerSession,
  TimelineEvent,
} from '../core/types'

const LOG_LINE = /^\[(?<timestamp>[^\]]+)]\s+\[(?<level>[^\]]+)](?:\s+\[(?<scope>[^\]]+)])?\s*(?<message>.*)$/

export function isXiaoBaPlainLog(text: string): boolean {
  const nonEmpty = text.split(/\r?\n/).filter(line => line.trim()).slice(0, 30)
  if (nonEmpty.length === 0) return false
  const matches = nonEmpty.filter(line => LOG_LINE.test(line.trim())).length
  return matches >= Math.min(3, nonEmpty.length)
}

export function parseXiaoBaPlainLog(text: string, fileName: string): ExplorerSession {
  const events: TimelineEvent[] = []
  const conversationItems: ConversationListItem[] = []
  const pendingTools = new Map<string, string[]>()
  let toolSequence = 0

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const raw = rawLine.trim()
    if (!raw) return
    const match = LOG_LINE.exec(raw)
    if (!match?.groups) return

    const { timestamp, level, scope, message } = match.groups
    const runtimeTool = parseXiaoBaRuntimeToolMessage(message ?? '')
    const runtimeActivity = runtimeTool
      ? undefined
      : parseXiaoBaRuntimeActivity(message ?? '', { defaultScope: scope })
    const event: TimelineEvent = {
      id: `line-${index + 1}`,
      lineIndex: index + 1,
      timestamp: timestamp ? Date.parse(timestamp.replace(' ', 'T')) : undefined,
      timestampLabel: timestamp,
      category: runtimeTool
        ? 'tool'
        : runtimeActivity?.phase === 'prompt_trace' ? 'meta' : 'system',
      kind: runtimeTool
        ? (runtimeTool.phase === 'call' ? 'tool_call' : 'tool_result')
        : runtimeActivity?.phase === 'prompt_trace'
          ? 'prompt_trace'
          : runtimeActivity ? 'runtime_activity' : 'runtime',
      label: runtimeTool
        ? `${runtimeTool.phase === 'call' ? 'tool_use' : 'tool_result'} ${runtimeTool.name}`
        : runtimeActivity
          ? xiaobaRuntimeActivityLabel(runtimeActivity)
          : [level, scope ?? 'runtime'].filter(Boolean).join(' '),
      preview: runtimeActivity ? truncatePreview(runtimeActivity.text) : truncatePreview(message ?? ''),
      turnIndex: runtimeTool?.turn ?? runtimeActivity?.turn,
      runtimeActivity,
      role: scope,
      raw: { timestamp, level, scope, message, raw },
    }

    if (runtimeTool) {
      const key = `${runtimeTool.turn}:${runtimeTool.name}`
      if (runtimeTool.phase === 'call') {
        const callId = `plain-log-tool-${runtimeTool.turn}-${toolSequence++}`
        const queue = pendingTools.get(key) ?? []
        queue.push(callId)
        pendingTools.set(key, queue)
        const input = runtimeTool.input ?? ''
        const item: ConversationListItem = {
          id: `conv-${index + 1}-tool-call`,
          event,
          role: 'tool_call',
          block: {
            type: 'tool_use',
            text: truncateBlockText(input),
            toolName: runtimeTool.name,
            toolInput: parseToolInput(input),
            toolCallId: callId,
            status: 'pending',
          },
        }
        conversationItems.push(item)
        event.conversationItem = item
      } else {
        const queue = pendingTools.get(key) ?? []
        const callId = queue.shift() ?? `plain-log-tool-${runtimeTool.turn}-${toolSequence++}`
        if (queue.length > 0) pendingTools.set(key, queue)
        else pendingTools.delete(key)
        const item: ConversationListItem = {
          id: `conv-${index + 1}-tool-result`,
          event,
          role: 'tool_result',
          block: {
            type: 'text',
            text: truncateBlockText(runtimeTool.result ?? ''),
            toolName: runtimeTool.name,
            toolCallId: callId,
            status: 'completed',
          },
        }
        conversationItems.push(item)
        event.conversationItem = item
      }
    } else if (runtimeActivity) {
      const item: ConversationListItem = {
        id: `conv-${index + 1}-runtime-activity`,
        event,
        role: 'runtime_activity',
        block: {
          type: 'text',
          text: truncateBlockText(runtimeActivity.text),
        },
      }
      conversationItems.push(item)
      event.conversationItem = item
    } else {
      const item: ConversationListItem = {
        id: `conv-${index + 1}-runtime`,
        event,
        role: 'system',
        block: {
          type: 'text',
          text: truncateBlockText(message ?? ''),
        },
      }
      conversationItems.push(item)
      event.conversationItem = item
    }

    events.push(event)
  })

  return {
    fileType: 'XiaoBa Log',
    fileName,
    meta: {
      sessionId: fileName.replace(/\.log$/i, ''),
      eventCount: events.length,
      turnCount: new Set(events.map(event => event.turnIndex).filter(Boolean)).size,
    },
    events,
    conversationItems,
    parseWarnings: [],
  }
}

function parseToolInput(value: string): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : { raw: value }
  } catch {
    return { raw: value }
  }
}
