import type { SessionAdapter } from './types'
import { truncateBlockText, truncatePreview } from '../core/text'
import { parseXiaoBaRuntimeToolMessage } from '../core/xiaoba'
import type {
  ContentBlock,
  ConversationListItem,
  EventCategory,
  ExplorerSession,
  ParsedLine,
  TimelineEvent,
  TokenUsage,
} from '../core/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function getNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? undefined : timestamp
}

function isTurnEntry(record: Record<string, unknown>): boolean {
  const entryType = getString(record, 'entry_type')
  if (entryType !== undefined && entryType !== 'turn') return false

  return getNumber(record, 'turn') !== undefined
    && typeof record.timestamp === 'string'
    && typeof record.session_id === 'string'
    && typeof record.session_type === 'string'
    && isRecord(record.user)
    && typeof record.user.text === 'string'
    && isRecord(record.assistant)
    && typeof record.assistant.text === 'string'
    && Array.isArray(record.assistant.tool_calls)
    && isRecord(record.tokens)
}

function isXiaoBaEntry(record: Record<string, unknown>): boolean {
  if (isTurnEntry(record)) return true
  const entryType = getString(record, 'entry_type')
  if (entryType === 'branch') {
    return typeof record.timestamp === 'string'
      && typeof record.branch_type === 'string'
      && typeof record.event_type === 'string'
  }
  return (
    entryType === 'runtime'
    || entryType === 'prompt_trace'
    || entryType === 'subagent_event'
  )
    && typeof record.timestamp === 'string'
    && typeof record.session_id === 'string'
    && typeof record.session_type === 'string'
}

function isContextMessage(record: Record<string, unknown>): boolean {
  const role = getString(record, 'role')
  return (
    role === 'user'
    || role === 'assistant'
    || role === 'system'
    || role === 'tool'
  ) && (
    typeof record.content === 'string'
    || record.content === null
    || Array.isArray(record.content)
  )
}

function hasXiaoBaContextMarker(record: Record<string, unknown>): boolean {
  return Object.keys(record).some(key => key.startsWith('__'))
    || 'runtimeObservationSource' in record
    || 'providerContent' in record
}

function isSupportedEntry(record: Record<string, unknown>): boolean {
  return isXiaoBaEntry(record) || isContextMessage(record)
}

function entryKind(record: Record<string, unknown>): string {
  if (getString(record, 'entry_type') === 'branch') {
    return getString(record, 'event_type') ?? 'branch'
  }
  return getString(record, 'entry_type') ?? (isTurnEntry(record) ? 'turn' : 'unknown')
}

function eventCategory(record: Record<string, unknown>): EventCategory {
  if (getString(record, 'entry_type') === 'branch') return 'tool'
  const kind = entryKind(record)
  if (kind === 'turn') return 'assistant'
  if (kind === 'runtime') return 'system'
  if (kind === 'prompt_trace') return 'meta'
  if (kind === 'subagent_event') return 'tool'
  return 'unknown'
}

function eventLabel(record: Record<string, unknown>): string {
  if (getString(record, 'entry_type') === 'branch') {
    return [getString(record, 'branch_type'), getString(record, 'event_type')]
      .filter(Boolean)
      .join(' · ')
  }
  const kind = entryKind(record)
  if (kind === 'turn') return `turn ${getNumber(record, 'turn') ?? '?'}`
  if (kind === 'runtime') {
    const level = getString(record, 'level')
    const event = isRecord(record.event) ? getString(record.event, 'type') : undefined
    return [level, event ?? 'runtime'].filter(Boolean).join(' ')
  }
  if (kind === 'prompt_trace') return 'prompt_trace'
  if (kind === 'subagent_event') {
    const event = isRecord(record.event) ? getString(record.event, 'type') : undefined
    return event ? `subagent ${event}` : 'subagent_event'
  }
  return kind
}

function eventPreview(record: Record<string, unknown>): string {
  if (getString(record, 'entry_type') === 'branch') {
    const summary = getString(record, 'rationale')
      ?? getString(record, 'decision')
      ?? getString(record, 'result')
      ?? getString(record, 'source_file_path')
    if (summary) return truncatePreview(summary)
    const round = getNumber(record, 'round')
    return round === undefined ? '' : `round ${round}`
  }
  const kind = entryKind(record)
  if (kind === 'turn' && isRecord(record.user)) {
    return truncatePreview(getString(record.user, 'text') ?? '')
  }
  if (kind === 'runtime') return truncatePreview(getString(record, 'message') ?? '')
  if (kind === 'prompt_trace' && isRecord(record.prompt)) {
    const source = getString(record.prompt, 'source')
    const version = getString(record.prompt, 'prompt_version')
    return truncatePreview([source, version].filter(Boolean).join(' · '))
  }
  if (kind === 'subagent_event' && isRecord(record.event)) {
    return truncatePreview(getString(record.event, 'summary') ?? '')
  }
  return ''
}

function count(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined
}

function scalar(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}

function compactText(value: string, limit = 360): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit)}…`
}

function numberRange(values: unknown): string | undefined {
  if (!Array.isArray(values)) return undefined
  const numbers = values.filter((value): value is number => typeof value === 'number')
  if (numbers.length === 0) return undefined
  const unique = [...new Set(numbers)].sort((a, b) => a - b)
  const range = unique.length === 1 ? String(unique[0]) : `${unique[0]}–${unique.at(-1)}`
  return numbers.length === unique.length ? range : `${range} (${numbers.length} records)`
}

function branchWorkflowText(record: Record<string, unknown>): string {
  const branchType = getString(record, 'branch_type') ?? 'branch'
  const eventType = getString(record, 'event_type') ?? 'event'
  const lines: Array<string | false | undefined> = []

  if (branchType === 'distillation') {
    if (eventType === 'start') {
      const byteRange = isRecord(record.byte_range) ? record.byte_range : {}
      lines.push(
        getString(record, 'source_file_path') && `Source: ${getString(record, 'source_file_path')}`,
        getNumber(byteRange, 'start') !== undefined && getNumber(byteRange, 'end') !== undefined
          ? `Bytes: ${getNumber(byteRange, 'start')}–${getNumber(byteRange, 'end')}`
          : undefined,
        numberRange(record.new_turns) && `New turns: ${numberRange(record.new_turns)}`,
        getNumber(record, 'continuity_turn_count') !== undefined
          ? `Continuity: ${getNumber(record, 'continuity_turn_count')} turns`
          : undefined,
      )
    } else if (eventType === 'distiller_output') {
      const candidates = Array.isArray(record.candidates) ? record.candidates : []
      lines.push(`Candidates: ${getNumber(record, 'candidate_count') ?? candidates.length}`)
      for (const candidate of candidates.slice(0, 3)) {
        if (!isRecord(candidate)) continue
        const title = getString(candidate, 'title') ?? getString(candidate, 'capability_id')
        if (title) lines.push(`• ${compactText(title, 180)}`)
      }
    } else if (eventType === 'promotion_packet') {
      lines.push(
        getString(record, 'capability_id') && `Capability: ${getString(record, 'capability_id')}`,
        getString(record, 'recommendation') && `Recommendation: ${getString(record, 'recommendation')}`,
        getNumber(record, 'provenance_ref_count') !== undefined
          ? `Evidence refs: ${getNumber(record, 'provenance_ref_count')}`
          : undefined,
        count(record.reviewer_risks) !== undefined ? `Reviewer risks: ${count(record.reviewer_risks)}` : undefined,
      )
    } else if (eventType === 'review_result') {
      lines.push(
        getString(record, 'decision') && `Decision: ${getString(record, 'decision')}`,
        getString(record, 'rationale') && `Rationale: ${compactText(getString(record, 'rationale')!)}`,
        count(record.review_risks) !== undefined ? `Risks: ${count(record.review_risks)}` : undefined,
      )
    } else if (eventType === 'install_result') {
      lines.push(
        getString(record, 'skill_name') && `Skill: ${getString(record, 'skill_name')}`,
        getString(record, 'snapshot_id') && `Snapshot: ${getString(record, 'snapshot_id')}`,
        getString(record, 'skill_file_path') && `File: ${getString(record, 'skill_file_path')}`,
        typeof record.newly_created === 'boolean' ? `Newly created: ${record.newly_created ? 'yes' : 'no'}` : undefined,
      )
    } else if (eventType === 'run_result') {
      const reviews = isRecord(record.review_counts) ? record.review_counts : {}
      lines.push(
        `Candidates: ${getNumber(record, 'candidate_count') ?? 0}`,
        `Installed: ${getNumber(record, 'installation_count') ?? 0}`,
        `Outcomes: ${getNumber(record, 'outcome_count') ?? 0}`,
        `Reviews: ${Object.entries(reviews).map(([key, value]) => `${key} ${String(value)}`).join(' · ') || 'none'}`,
      )
    } else if (eventType === 'transcript') {
      lines.push(
        `Candidates: ${count(record.candidates) ?? 0}`,
        `Reviews: ${count(record.reviews) ?? 0}`,
        `Installations: ${count(record.installations) ?? 0}`,
        `Outcomes: ${count(record.outcomes) ?? 0}`,
      )
    }
  } else if (branchType === 'memory') {
    if (eventType === 'transcript') {
      const messages = Array.isArray(record.messages) ? record.messages : []
      const roles = messages.flatMap(message => isRecord(message) && getString(message, 'role') ? [getString(message, 'role')!] : [])
      lines.push(`Messages: ${messages.length}`, roles.length > 0 && `Roles: ${roles.join(' → ')}`)
    } else {
      lines.push(
        getNumber(record, 'message_count') !== undefined ? `Messages: ${getNumber(record, 'message_count')}` : undefined,
        typeof record.has_finish_payload === 'boolean'
          ? `Finish payload: ${record.has_finish_payload ? 'present' : 'missing'}`
          : undefined,
      )
    }
  } else if (eventType === 'fixture_result') {
    const draft = isRecord(record.draft) ? record.draft : undefined
    const envelope = draft && isRecord(draft.envelope) ? draft.envelope : undefined
    const result = isRecord(record.result) ? record.result : undefined
    lines.push(
      getNumber(record, 'round') !== undefined ? `Round: ${getNumber(record, 'round')}` : undefined,
      envelope && getString(envelope, 'decision') ? `Decision: ${getString(envelope, 'decision')}` : undefined,
      envelope && getString(envelope, 'routingName') ? `Skill: ${getString(envelope, 'routingName')}` : undefined,
      envelope && getString(envelope, 'description') ? compactText(getString(envelope, 'description')!) : undefined,
      result && getString(result, 'decision') ? `Decision: ${getString(result, 'decision')}` : undefined,
      result && getString(result, 'transition') ? `Transition: ${getString(result, 'transition')}` : undefined,
      result && getString(result, 'rationale') ? `Rationale: ${compactText(getString(result, 'rationale')!)}` : undefined,
      result && count(result.issues) !== undefined ? `Issues: ${count(result.issues)}` : undefined,
    )
  }

  const meaningful = lines.filter((line): line is string => typeof line === 'string' && line.length > 0)
  if (meaningful.length > 0) return meaningful.join('\n')

  const omitted = new Set(['entry_type', 'branch_type', 'branch_id', 'event_type', 'timestamp'])
  return Object.entries(record)
    .filter(([key]) => !omitted.has(key))
    .slice(0, 8)
    .map(([key, value]) => {
      const valueText = scalar(value)
      if (valueText !== undefined) return `${key}: ${compactText(valueText, 180)}`
      if (Array.isArray(value)) return `${key}: ${value.length} items`
      if (isRecord(value)) return `${key}: ${Object.keys(value).length} fields`
      return `${key}: empty`
    })
    .join('\n') || eventLabel(record)
}

function workflowText(record: Record<string, unknown>): string {
  if (getString(record, 'entry_type') === 'branch') {
    return branchWorkflowText(record)
  }
  const kind = getString(record, 'entry_type')
  if (kind === 'runtime') return getString(record, 'message') ?? ''
  if (kind === 'prompt_trace') {
    const prompt = isRecord(record.prompt) ? record.prompt : {}
    const source = getString(prompt, 'source')
    const version = getString(prompt, 'prompt_version')
    const files = Array.isArray(prompt.loaded_files) ? prompt.loaded_files.length : undefined
    return [
      'Prompt snapshot loaded',
      source && `source: ${source}`,
      version && `version: ${version}`,
      files !== undefined && `files: ${files}`,
    ].filter(Boolean).join('\n')
  }
  if (kind === 'subagent_event') {
    const subagent = isRecord(record.subagent) ? record.subagent : {}
    const event = isRecord(record.event) ? record.event : {}
    return [
      getString(event, 'summary') ?? eventLabel(record),
      getString(subagent, 'name') ?? getString(subagent, 'id'),
    ].filter(Boolean).join('\n')
  }
  return eventPreview(record)
}

function parseUsage(record: Record<string, unknown>): TokenUsage | undefined {
  if (!isRecord(record.tokens)) return undefined
  const prompt = getNumber(record.tokens, 'prompt')
  const completion = getNumber(record.tokens, 'completion')
  if (prompt === undefined && completion === undefined) return undefined
  return {
    inputTokens: prompt ?? 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    outputTokens: completion ?? 0,
  }
}

function toolInput(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : { raw: value }
}

function toolInputText(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined) return '{}'
  return JSON.stringify(value, null, 2)
}

function parseToolInput(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value
  if (typeof value !== 'string') return { raw: value }
  try {
    const parsed: unknown = JSON.parse(value)
    return isRecord(parsed) ? parsed : { raw: value }
  } catch {
    return { raw: value }
  }
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map(block => isRecord(block) && block.type === 'text' ? getString(block, 'text') ?? '' : '')
    .filter(Boolean)
    .join('\n')
}

function addConversationItem(
  conversationItems: ConversationListItem[],
  event: TimelineEvent,
  id: string,
  role: ConversationListItem['role'],
  block?: ContentBlock,
): ConversationListItem {
  const item: ConversationListItem = { id, event, role, block }
  conversationItems.push(item)
  event.conversationItem = item
  return item
}

function addTurnConversationItems(
  record: Record<string, unknown>,
  event: TimelineEvent,
  conversationItems: ConversationListItem[],
): void {
  const user = record.user as Record<string, unknown>
  const assistant = record.assistant as Record<string, unknown>
  const userText = getString(user, 'text') ?? ''
  const assistantText = getString(assistant, 'text') ?? ''

  addConversationItem(
    conversationItems,
    event,
    `conv-${event.lineIndex}-user`,
    'user',
    userText ? { type: 'text', text: truncateBlockText(userText) } : undefined,
  )

  const calls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : []
  calls.forEach((value, index) => {
    if (!isRecord(value)) return
    const callId = getString(value, 'id') ?? `line-${event.lineIndex}-tool-${index}`
    const name = getString(value, 'name') ?? 'tool'
    const args = value.arguments
    addConversationItem(
      conversationItems,
      event,
      `conv-${event.lineIndex}-tool-call-${index}`,
      'tool_call',
      {
        type: 'tool_use',
        text: truncateBlockText(toolInputText(args)),
        toolName: name,
        toolInput: toolInput(args),
        toolCallId: callId,
        status: 'pending',
      },
    )

    const result = getString(value, 'result') ?? ''
    addConversationItem(
      conversationItems,
      event,
      `conv-${event.lineIndex}-tool-result-${index}`,
      'tool_result',
      result
        ? {
            type: 'text',
            text: truncateBlockText(result),
            toolCallId: callId,
            status: 'completed',
          }
        : undefined,
    )
  })

  addConversationItem(
    conversationItems,
    event,
    `conv-${event.lineIndex}-assistant`,
    'assistant',
    assistantText ? { type: 'text', text: truncateBlockText(assistantText) } : undefined,
  )
}

function contextCategory(role: string): EventCategory {
  if (role === 'user') return 'user'
  if (role === 'assistant') return 'assistant'
  if (role === 'tool') return 'tool'
  if (role === 'system') return 'system'
  return 'unknown'
}

function addContextConversationItems(
  record: Record<string, unknown>,
  event: TimelineEvent,
  conversationItems: ConversationListItem[],
): void {
  const role = getString(record, 'role') ?? 'system'
  const text = messageText(record.content)

  if (role === 'assistant') {
    const calls = Array.isArray(record.tool_calls) ? record.tool_calls : []
    calls.forEach((value, index) => {
      if (!isRecord(value) || !isRecord(value.function)) return
      const callId = getString(value, 'id') ?? `line-${event.lineIndex}-tool-${index}`
      const name = getString(value.function, 'name') ?? 'tool'
      const args = value.function.arguments
      addConversationItem(
        conversationItems,
        event,
        `conv-${event.lineIndex}-tool-call-${index}`,
        'tool_call',
        {
          type: 'tool_use',
          text: truncateBlockText(toolInputText(args)),
          toolName: name,
          toolInput: parseToolInput(args),
          toolCallId: callId,
          status: 'pending',
        },
      )
    })
  }

  const conversationRole: ConversationListItem['role'] = role === 'tool'
    ? 'tool_result'
    : role === 'user' || role === 'assistant' || role === 'system'
      ? role
      : 'system'
  const callId = role === 'tool' ? getString(record, 'tool_call_id') : undefined
  addConversationItem(
    conversationItems,
    event,
    `conv-${event.lineIndex}-${conversationRole}`,
    conversationRole,
    text
      ? {
          type: 'text',
          text: truncateBlockText(text),
          ...(callId && { toolCallId: callId, status: 'completed' as const }),
        }
      : undefined,
  )
}

function addMemoryTranscriptItems(
  record: Record<string, unknown>,
  event: TimelineEvent,
  conversationItems: ConversationListItem[],
): boolean {
  if (getString(record, 'branch_type') !== 'memory') return false
  if (getString(record, 'event_type') !== 'transcript') return false
  if (!Array.isArray(record.messages)) return false

  let added = false
  record.messages.forEach((value, messageIndex) => {
    if (!isRecord(value)) return
    const role = getString(value, 'role')
    const content = memoryMessageText(role, messageText(value.content))

    if (role === 'assistant' && Array.isArray(value.tool_calls)) {
      value.tool_calls.forEach((toolCall, toolIndex) => {
        if (!isRecord(toolCall)) return
        const fn = isRecord(toolCall.function) ? toolCall.function : undefined
        const name = getString(toolCall, 'name') ?? (fn ? getString(fn, 'name') : undefined) ?? 'tool'
        const callId = getString(toolCall, 'id') ?? `memory-${event.lineIndex}-${messageIndex}-${toolIndex}`
        const args = toolCall.arguments ?? fn?.arguments
        addConversationItem(
          conversationItems,
          event,
          `conv-${event.lineIndex}-memory-tool-${messageIndex}-${toolIndex}`,
          'tool_call',
          {
            type: 'tool_use',
            text: truncateBlockText(toolInputText(args)),
            toolName: name,
            toolInput: parseToolInput(args),
            toolCallId: callId,
            status: 'pending',
          },
        )
        added = true
      })
    }

    if (role === 'tool') {
      const callId = getString(value, 'tool_call_id')
        ?? `memory-${event.lineIndex}-result-${messageIndex}`
      addConversationItem(
        conversationItems,
        event,
        `conv-${event.lineIndex}-memory-result-${messageIndex}`,
        'tool_result',
        {
          type: 'text',
          text: truncateBlockText(content),
          toolName: getString(value, 'name'),
          toolCallId: callId,
          status: 'completed',
        },
      )
      added = true
      return
    }

    if (!content) return
    const conversationRole: ConversationListItem['role'] = role === 'system'
      ? 'system'
      : role === 'user'
        ? 'user'
        : 'assistant'
    addConversationItem(
      conversationItems,
      event,
      `conv-${event.lineIndex}-memory-${messageIndex}`,
      conversationRole,
      { type: 'text', text: truncateBlockText(content) },
    )
    added = true
  })
  return added
}

function memoryMessageText(role: string | undefined, content: string): string {
  if (role !== 'user') return content
  try {
    const payload: unknown = JSON.parse(content)
    if (!isRecord(payload)) return content
    const input = getString(payload, 'current_user_input')
    const recentTurns = Array.isArray(payload.recent_completed_turns)
      ? payload.recent_completed_turns.length
      : undefined
    const sourceAvailable = typeof payload.memory_source_available === 'boolean'
      ? payload.memory_source_available
      : undefined
    return [
      input && `Current request: ${input}`,
      recentTurns !== undefined && `Recent completed turns: ${recentTurns}`,
      sourceAvailable !== undefined && `Memory source: ${sourceAvailable ? 'available' : 'unavailable'}`,
    ].filter(Boolean).join('\n') || content
  } catch {
    return content
  }
}

export const xiaobaSessionAdapter: SessionAdapter = {
  detect(samples: ParsedLine[]): number {
    if (samples.length === 0) return 0
    let hits = 0
    let hasContextMarker = false
    let hasSessionLogEntry = false
    for (const sample of samples) {
      if (!isRecord(sample.data) || !isSupportedEntry(sample.data)) continue
      hits++
      if (isXiaoBaEntry(sample.data)) hasSessionLogEntry = true
      if (isContextMessage(sample.data) && hasXiaoBaContextMarker(sample.data)) {
        hasContextMarker = true
      }
    }
    if (!hasSessionLogEntry && !hasContextMarker) return 0
    return hits / samples.length
  },

  parse(lines: ParsedLine[], fileName: string): ExplorerSession {
    const events: TimelineEvent[] = []
    const conversationItems: ConversationListItem[] = []
    let sessionId: string | undefined
    let turnCount = 0
    let currentTurn = 0
    let lastEpisodeId: string | undefined
    let runtimeToolSequence = 0
    const pendingRuntimeTools = new Map<string, string[]>()
    const pendingSubagentTools = new Map<string, string[]>()
    const recordedTurnTools = new Set<string>()

    for (const line of lines) {
      if (!isRecord(line.data) || !isTurnEntry(line.data)) continue
      const assistant = line.data.assistant
      if (!isRecord(assistant) || !Array.isArray(assistant.tool_calls)) continue
      const turn = getNumber(line.data, 'turn')
      if (turn === undefined) continue
      for (const call of assistant.tool_calls) {
        if (isRecord(call)) {
          const name = getString(call, 'name')
          if (name) recordedTurnTools.add(`${turn}:${name}`)
        }
      }
    }

    for (const line of lines) {
      if (!isRecord(line.data) || !isSupportedEntry(line.data)) continue
      const record = line.data
      if (isContextMessage(record)) {
        const role = getString(record, 'role') ?? 'system'
        const episodeId = getString(record, '__episodeId')
        if (
          (episodeId && episodeId !== lastEpisodeId)
          || (!episodeId && role === 'user')
        ) {
          currentTurn++
        }
        if (episodeId) lastEpisodeId = episodeId

        const event: TimelineEvent = {
          id: `line-${line.lineIndex}`,
          lineIndex: line.lineIndex,
          category: contextCategory(role),
          kind: role === 'tool' ? 'tool_result' : role,
          label: role === 'tool'
            ? `tool_result ${getString(record, 'name') ?? 'tool'}`
            : role,
          preview: truncatePreview(messageText(record.content)),
          turnIndex: currentTurn || 1,
          requestId: episodeId,
          role,
          raw: record,
        }
        addContextConversationItems(record, event, conversationItems)
        events.push(event)
        continue
      }

      const kind = entryKind(record)
      const turn = isTurnEntry(record) ? getNumber(record, 'turn') : undefined
      const runtimeTool = kind === 'runtime'
        ? parseXiaoBaRuntimeToolMessage(getString(record, 'message') ?? '')
        : undefined
      sessionId ??= getString(record, 'session_id') ?? getString(record, 'branch_id')
      if (kind === 'turn') turnCount++

      const event: TimelineEvent = {
        id: `line-${line.lineIndex}`,
        lineIndex: line.lineIndex,
        timestamp: parseTimestamp(record.timestamp),
        category: runtimeTool ? 'tool' : eventCategory(record),
        kind: runtimeTool ? (runtimeTool.phase === 'call' ? 'tool_call' : 'tool_result') : kind,
        label: runtimeTool
          ? `${runtimeTool.phase === 'call' ? 'tool_use' : 'tool_result'} ${runtimeTool.name}`
          : eventLabel(record),
        preview: eventPreview(record),
        turnIndex: runtimeTool?.turn ?? turn ?? getNumber(record, 'round'),
        requestId: getString(record, 'episode_id'),
        usage: kind === 'turn' ? parseUsage(record) : undefined,
        sessionId: getString(record, 'session_id') ?? getString(record, 'branch_id'),
        timestampLabel: getString(record, 'timestamp'),
        raw: record,
      }

      if (kind === 'turn') {
        addTurnConversationItems(record, event, conversationItems)
      } else if (addMemoryTranscriptItems(record, event, conversationItems)) {
        // Memory transcripts expand into their underlying message and tool sequence.
      } else if (runtimeTool) {
        const pendingKey = `${runtimeTool.turn}:${runtimeTool.name}`
        if (recordedTurnTools.has(pendingKey)) {
          events.push(event)
          continue
        }
        if (runtimeTool.phase === 'call') {
          const callId = `runtime-tool-${runtimeTool.turn}-${runtimeToolSequence++}`
          const queue = pendingRuntimeTools.get(pendingKey) ?? []
          queue.push(callId)
          pendingRuntimeTools.set(pendingKey, queue)
          const input = runtimeTool.input ?? ''
          addConversationItem(
            conversationItems,
            event,
            `conv-${line.lineIndex}-runtime-tool-call`,
            'tool_call',
            {
              type: 'tool_use',
              text: truncateBlockText(input),
              toolName: runtimeTool.name,
              toolInput: parseToolInput(input),
              toolCallId: callId,
              status: 'pending',
            },
          )
        } else {
          const queue = pendingRuntimeTools.get(pendingKey) ?? []
          const callId = queue.shift() ?? `runtime-tool-${runtimeTool.turn}-${runtimeToolSequence++}`
          if (queue.length > 0) pendingRuntimeTools.set(pendingKey, queue)
          else pendingRuntimeTools.delete(pendingKey)
          addConversationItem(
            conversationItems,
            event,
            `conv-${line.lineIndex}-runtime-tool-result`,
            'tool_result',
            {
              type: 'text',
              text: truncateBlockText(runtimeTool.result ?? ''),
              toolName: runtimeTool.name,
              toolCallId: callId,
              status: 'completed',
            },
          )
        }
      } else if (getString(record, 'entry_type') === 'subagent_event') {
        const subagent = isRecord(record.subagent) ? record.subagent : {}
        const subagentEvent = isRecord(record.event) ? record.event : {}
        const payload = isRecord(subagentEvent.payload) ? subagentEvent.payload : {}
        const eventType = getString(subagentEvent, 'type')
        const toolName = getString(payload, 'toolName')
        const subagentId = getString(subagent, 'id') ?? 'subagent'
        if (toolName && (eventType === 'agent_tool_start' || eventType === 'agent_tool_end')) {
          const key = `${subagentId}:${toolName}`
          event.category = 'tool'
          event.kind = eventType === 'agent_tool_start' ? 'tool_call' : 'tool_result'
          event.label = `${eventType === 'agent_tool_start' ? 'tool_use' : 'tool_result'} ${toolName}`
          if (eventType === 'agent_tool_start') {
            const callId = `subagent-tool-${subagentId}-${runtimeToolSequence++}`
            const queue = pendingSubagentTools.get(key) ?? []
            queue.push(callId)
            pendingSubagentTools.set(key, queue)
            addConversationItem(
              conversationItems,
              event,
              `conv-${line.lineIndex}-subagent-tool-call`,
              'tool_call',
              {
                type: 'tool_use',
                text: '{}',
                toolName,
                toolInput: {},
                toolCallId: callId,
                status: 'pending',
              },
            )
          } else {
            const queue = pendingSubagentTools.get(key) ?? []
            const callId = queue.shift() ?? `subagent-tool-${subagentId}-${runtimeToolSequence++}`
            if (queue.length > 0) pendingSubagentTools.set(key, queue)
            else pendingSubagentTools.delete(key)
            addConversationItem(
              conversationItems,
              event,
              `conv-${line.lineIndex}-subagent-tool-result`,
              'tool_result',
              {
                type: 'text',
                text: truncateBlockText(getString(subagentEvent, 'summary') ?? ''),
                toolName,
                toolCallId: callId,
                status: 'completed',
              },
            )
          }
        }
      }
      if (!event.conversationItem && kind !== 'turn') {
        addConversationItem(
          conversationItems,
          event,
          `conv-${line.lineIndex}-workflow`,
          'system',
          {
            type: 'text',
            text: truncateBlockText(workflowText(record)),
          },
        )
      }
      events.push(event)
    }

    return {
      fileType: 'XiaoBa',
      fileName,
      meta: {
        sessionId: sessionId ?? fileName.replace(/\.jsonl?$/i, ''),
        eventCount: events.length,
        turnCount: turnCount || currentTurn,
      },
      events,
      conversationItems,
      parseWarnings: [],
    }
  },
}
