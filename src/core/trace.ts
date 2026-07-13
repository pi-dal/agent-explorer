import { truncateBlockText, truncatePreview } from './text'
import { parseXiaoBaBranchActivity, parseXiaoBaRuntimeToolMessage } from './xiaoba'
import type {
  ConversationListItem,
  ExplorerSession,
  TraceGraph,
  TraceLifecycle,
  TraceRelation,
  TraceRelationRef,
  TimelineEvent,
} from './types'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(record: JsonRecord | undefined, key: string): string | undefined {
  const value = record?.[key]
  return typeof value === 'string' ? value : undefined
}

function numberValue(record: JsonRecord | undefined, key: string): number | undefined {
  const value = record?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function arrayNumbers(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry))
    : []
}

function rawRecord(event: TimelineEvent): JsonRecord | undefined {
  return isRecord(event.raw) ? event.raw : undefined
}

export function traceSessionKey(session: ExplorerSession): string {
  return session.sourcePath ?? session.sourceFilePath ?? session.fileName
}

export interface TraceTranscriptEntry {
  kind: 'message' | 'tool'
  item: ConversationListItem
  result?: ConversationListItem
}

export function traceTranscriptEntries(session: ExplorerSession): TraceTranscriptEntry[] {
  const results = new Map<string, ConversationListItem>()
  for (const item of session.conversationItems) {
    if (item.role === 'tool_result' && item.block?.toolCallId) {
      results.set(item.block.toolCallId, item)
    }
  }

  return session.conversationItems.flatMap((item): TraceTranscriptEntry[] => {
    if (item.role === 'tool_result' && item.block?.toolCallId && results.has(item.block.toolCallId)) {
      const call = session.conversationItems.find(candidate => (
        candidate.role === 'tool_call'
        && candidate.block?.toolCallId === item.block?.toolCallId
      ))
      return call ? [] : [{ kind: 'message', item }]
    }
    if (item.role === 'tool_call') {
      return [{
        kind: 'tool',
        item,
        result: item.block?.toolCallId ? results.get(item.block.toolCallId) : undefined,
      }]
    }
    return [{ kind: 'message', item }]
  })
}

function pathKey(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.replace(/\\/g, '/').toLowerCase()
  const logsIndex = normalized.indexOf('logs/')
  return logsIndex >= 0 ? normalized.slice(logsIndex) : normalized
}

function branchKey(branchType: string, branchId: string): string {
  return `${branchType}:${branchId}`
}

function branchIdentity(
  branchId: string | undefined,
  branchType?: string,
): { branchType: string; branchId: string } | undefined {
  if (!branchId) return undefined
  const embedded = branchId.includes(':')
    ? (() => {
        const separator = branchId.indexOf(':')
        return {
          branchType: branchId.slice(0, separator),
          branchId: branchId.slice(separator + 1),
        }
      })()
    : undefined
  if (embedded) return embedded
  if (!branchType) return undefined
  return { branchType, branchId }
}

function lifecycleFromRecord(record: JsonRecord | undefined): TraceLifecycle | undefined {
  const event = isRecord(record?.event) ? record.event : undefined
  const payload = isRecord(event?.payload) ? event.payload : undefined
  if (stringValue(event, 'type') !== 'synthetic_observation_lifecycle' || !payload) {
    return undefined
  }
  const refs = Array.isArray(payload.refs)
    ? payload.refs.filter((value): value is string => typeof value === 'string')
    : undefined
  return {
    outcome: stringValue(payload, 'outcome'),
    observationId: stringValue(payload, 'observation_id'),
    originTurn: numberValue(payload, 'origin_turn'),
    timing: stringValue(payload, 'timing'),
    refs,
  }
}

function eventBranchIdentity(event: TimelineEvent): { branchType: string; branchId: string } | undefined {
  const record = rawRecord(event)
  if (!record) return undefined

  if (stringValue(record, 'entry_type') === 'runtime') {
    const runtime = parseXiaoBaRuntimeToolMessage(stringValue(record, 'message') ?? '')
    if (runtime?.branchType && runtime.branchId) {
      return { branchType: runtime.branchType, branchId: runtime.branchId }
    }
    const activity = parseXiaoBaBranchActivity(stringValue(record, 'message') ?? '')
    if (activity) {
      return { branchType: activity.branchType, branchId: activity.branchId }
    }
    const nestedEvent = isRecord(record.event) ? record.event : undefined
    const payload = isRecord(nestedEvent?.payload) ? nestedEvent.payload : undefined
    const nested = branchIdentity(
      stringValue(payload, 'branch_id'),
      stringValue(payload, 'branch_type'),
    )
    if (nested) return nested
  }

  return stringValue(record, 'entry_type') === 'embedded_trace'
    ? branchIdentity(stringValue(record, 'branch_id'), stringValue(record, 'branch_type'))
    : undefined
}

function branchSessionInfo(session: ExplorerSession): {
  branchType: string
  branchId: string
  start?: JsonRecord
} | undefined {
  const records = session.events
    .map(rawRecord)
    .filter((record): record is JsonRecord => record !== undefined)
  const branch = records.find(record => stringValue(record, 'entry_type') === 'branch')
  if (!branch) return undefined
  const branchType = stringValue(branch, 'branch_type')
  const branchId = stringValue(branch, 'branch_id')
  if (!branchType || !branchId) return undefined
  return {
    branchType,
    branchId,
    start: records.find(record => stringValue(record, 'event_type') === 'start'),
  }
}

function branchSummary(session: ExplorerSession): string {
  const records = session.events
    .map(rawRecord)
    .filter((record): record is JsonRecord => record !== undefined)
  const output = records.find(record => stringValue(record, 'event_type') === 'distiller_output')
  const result = records.find(record => stringValue(record, 'event_type') === 'run_result')
  const candidates = numberValue(output, 'candidate_count')
  const installed = numberValue(result, 'installation_count')
  const reviews = isRecord(result?.review_counts) ? result.review_counts : undefined
  const promoted = numberValue(reviews, 'promote')
  const parts = [
    candidates !== undefined && `candidates ${candidates}`,
    installed !== undefined && `installed ${installed}`,
    promoted !== undefined && `promoted ${promoted}`,
  ].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(' · ') : `${session.events.length} events`
}

function appendRef(event: TimelineEvent, ref: TraceRelationRef): void {
  event.traceRefs = [...(event.traceRefs ?? []), ref]
}

function makeConversationItem(
  event: TimelineEvent,
  text: string,
): ConversationListItem {
  return {
    id: `conv-${event.id}-trace`,
    event,
    role: 'branch_event',
    block: { type: 'text', text: truncateBlockText(text) },
  }
}

function makeDistillationAnchor(
  parent: ExplorerSession,
  child: ExplorerSession,
  relation: TraceRelation,
  lineIndex: number,
): TimelineEvent {
  const start = relation.sourceFilePath
  const sourceRange = relation.sourceByteRange
  const summary = branchSummary(child)
  const event: TimelineEvent = {
    id: `trace-${relation.relationId}`,
    lineIndex,
    timestamp: child.events.find(event => event.timestamp !== undefined)?.timestamp,
    category: 'meta',
    kind: 'branch_anchor',
    label: `Distillation · ${relation.branchId}`,
    preview: truncatePreview(summary),
    turnIndex: relation.anchorTurn,
    traceRefs: [relation],
    branchEvent: {
      branchType: relation.branchType,
      branchId: relation.branchId,
      eventType: 'embedded',
      text: [
        `Background distillation for ${start ?? traceSessionKey(parent)}`,
        sourceRange && `Bytes: ${sourceRange.start}–${sourceRange.end}`,
        relation.anchorTurn !== undefined && `Source turns: through ${relation.anchorTurn}`,
        summary,
      ].filter(Boolean).join('\n'),
    },
    raw: {
      entry_type: 'embedded_trace',
      trace_kind: relation.kind,
      branch_type: relation.branchType,
      branch_id: relation.branchId,
      source_file_path: start,
      byte_range: sourceRange,
      child_session_key: traceSessionKey(child),
      summary,
    },
  }
  event.conversationItem = makeConversationItem(
    event,
    [
      `Background distillation for ${start ?? traceSessionKey(parent)}`,
      sourceRange && `Bytes: ${sourceRange.start}–${sourceRange.end}`,
      relation.anchorTurn !== undefined && `Source turns: through ${relation.anchorTurn}`,
      summary,
    ].filter(Boolean).join('\n'),
  )
  return event
}

function insertAfterEvent(
  parent: ExplorerSession,
  anchorEvent: TimelineEvent | undefined,
  event: TimelineEvent,
): void {
  if (!anchorEvent) {
    parent.events.push(event)
    parent.conversationItems.push(event.conversationItem!)
    return
  }
  const eventIndex = parent.events.findIndex(candidate => candidate.id === anchorEvent.id)
  parent.events.splice(eventIndex < 0 ? parent.events.length : eventIndex + 1, 0, event)
  const conversationIndex = parent.conversationItems.findIndex(item => item.event.id === anchorEvent.id)
  parent.conversationItems.splice(
    conversationIndex < 0 ? parent.conversationItems.length : conversationIndex + 1,
    0,
    event.conversationItem!,
  )
}

function addRelation(
  graph: TraceGraph,
  relation: TraceRelation,
  relationByKey: Map<string, TraceRelation>,
): TraceRelation {
  const key = `${relation.parentSessionKey}:${relation.childSessionKey}`
  const existing = relationByKey.get(key)
  if (existing) return existing
  relationByKey.set(key, relation)
  graph.relations.push(relation)
  return relation
}

function referenceFor(relation: TraceRelation): TraceRelationRef {
  return {
    relationId: relation.relationId,
    kind: relation.kind,
    branchType: relation.branchType,
    branchId: relation.branchId,
    childSessionKey: relation.childSessionKey,
    confidence: relation.confidence,
    sourceFilePath: relation.sourceFilePath,
    sourceByteRange: relation.sourceByteRange,
    anchorTurn: relation.anchorTurn,
    lifecycle: relation.lifecycle,
  }
}

function maxTurn(values: unknown): number | undefined {
  const turns = arrayNumbers(values)
  return turns.length > 0 ? Math.max(...turns) : undefined
}

export function composeTraceGraph(sessions: ExplorerSession[]): TraceGraph {
  const graph: TraceGraph = { relations: [] }
  const relationByKey = new Map<string, TraceRelation>()
  const branchSessions = new Map<string, ExplorerSession>()
  const branchInfos = new Map<string, ReturnType<typeof branchSessionInfo>>()

  for (const session of sessions) {
    const info = branchSessionInfo(session)
    if (!info) continue
    const key = branchKey(info.branchType, info.branchId)
    branchSessions.set(key, session)
    branchInfos.set(key, info)
  }

  for (const parent of sessions) {
    for (const event of parent.events) {
      const identity = eventBranchIdentity(event)
      if (!identity) continue
      const child = branchSessions.get(branchKey(identity.branchType, identity.branchId))
      if (!child || child === parent) continue
      const childKey = traceSessionKey(child)
      const relationKey = `${traceSessionKey(parent)}:${childKey}`
      const relation = addRelation(graph, {
        relationId: `trace-${relationKey}`,
        parentSessionKey: traceSessionKey(parent),
        childSessionKey: childKey,
        kind: identity.branchType === 'distillation' ? 'distillation' : 'branch',
        branchType: identity.branchType,
        branchId: identity.branchId,
        confidence: 'exact',
        anchorEventId: event.id,
        anchorTurn: event.turnIndex,
        lifecycle: lifecycleFromRecord(rawRecord(event)),
      }, relationByKey)
      if (!relation.anchorEventId || lifecycleFromRecord(rawRecord(event))) {
        relation.anchorEventId = event.id
        relation.anchorTurn = event.turnIndex
        relation.lifecycle = lifecycleFromRecord(rawRecord(event)) ?? relation.lifecycle
      }
      appendRef(event, referenceFor(relation))
    }
  }

  const nextLineIndex = new Map<string, number>()
  for (const parent of sessions) {
    const key = traceSessionKey(parent)
    nextLineIndex.set(key, Math.max(0, ...parent.events.map(event => event.lineIndex)) + 1)
  }

  for (const [branchKeyValue, child] of branchSessions) {
    const info = branchInfos.get(branchKeyValue)
    if (!info || info.branchType !== 'distillation' || !info.start) continue
    const sourceKey = pathKey(stringValue(info.start, 'source_file_path'))
    if (!sourceKey) continue
    const parent = sessions.find((candidate) => (
      candidate !== child
      && pathKey(traceSessionKey(candidate)) === sourceKey
    ))
    if (!parent) continue

    const childKey = traceSessionKey(child)
    const relationKey = `${traceSessionKey(parent)}:${childKey}`
    const relation = addRelation(graph, {
      relationId: `trace-${relationKey}`,
      parentSessionKey: traceSessionKey(parent),
      childSessionKey: childKey,
      kind: 'distillation',
      branchType: info.branchType,
      branchId: info.branchId,
      confidence: 'exact',
      sourceFilePath: stringValue(info.start, 'source_file_path'),
      sourceByteRange: isRecord(info.start.byte_range)
        && numberValue(info.start.byte_range, 'start') !== undefined
        && numberValue(info.start.byte_range, 'end') !== undefined
        ? {
            start: numberValue(info.start.byte_range, 'start')!,
            end: numberValue(info.start.byte_range, 'end')!,
          }
        : undefined,
      anchorTurn: maxTurn(info.start.new_turns),
    }, relationByKey)

    const anchor = parent.events
      .filter(event => relation.anchorTurn === undefined || event.turnIndex === relation.anchorTurn)
      .at(-1)
    const synthetic = makeDistillationAnchor(
      parent,
      child,
      relation,
      nextLineIndex.get(traceSessionKey(parent)) ?? parent.events.length + 1,
    )
    nextLineIndex.set(traceSessionKey(parent), synthetic.lineIndex + 1)
    relation.anchorEventId = synthetic.id
    insertAfterEvent(parent, anchor, synthetic)
  }

  return graph
}
