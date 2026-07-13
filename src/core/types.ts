export type EventCategory =
  | 'user'
  | 'assistant'
  | 'thinking'
  | 'tool'
  | 'system'
  | 'meta'
  | 'unknown'

export type ConversationRole =
  | 'user'
  | 'assistant'
  | 'system'
  | 'thinking'
  | 'branch_activity'
  | 'branch_event'
  | 'runtime_activity'
  | 'tool_call'
  | 'tool_result'

export interface SessionMeta {
  sessionId?: string
  model?: string
  cwd?: string
  version?: string
  eventCount: number
  turnCount: number
}

export interface ParseWarning {
  lineIndex: number
  message: string
}

export interface TokenUsage {
  inputTokens: number
  cacheCreationInputTokens: number
  cacheReadInputTokens: number
  outputTokens: number
}

export interface ContentBlock {
  type: 'text' | 'thinking' | 'tool_use'
  text: string
  toolName?: string
  toolInput?: Record<string, unknown>
  toolCallId?: string
  status?: 'pending' | 'completed' | 'failed'
}

export type TraceRelationKind = 'branch' | 'distillation'
export type TraceRelationConfidence = 'exact' | 'inferred'

export interface TraceLifecycle {
  outcome?: string
  observationId?: string
  originTurn?: number
  timing?: string
  refs?: string[]
}

export interface TraceRelationRef {
  relationId: string
  kind: TraceRelationKind
  branchType: string
  branchId: string
  childSessionKey: string
  confidence: TraceRelationConfidence
  sourceFilePath?: string
  sourceByteRange?: { start: number; end: number }
  anchorTurn?: number
  lifecycle?: TraceLifecycle
}

export interface TraceRelation extends TraceRelationRef {
  parentSessionKey: string
  anchorEventId?: string
}

export interface TraceGraph {
  relations: TraceRelation[]
}

export interface TimelineEvent {
  id: string
  lineIndex: number
  timestamp?: number
  category: EventCategory
  kind: string
  label: string
  preview: string
  turnIndex?: number
  requestId?: string
  model?: string
  usage?: TokenUsage
  uuid?: string
  sessionId?: string
  cwd?: string
  timestampLabel?: string
  role?: string
  stopReason?: string
  branchActivity?: {
    branchType: string
    branchId: string
    turn: number
    phase: string
    text: string
    toolNames?: string[]
  }
  branchEvent?: {
    branchType: string
    branchId: string
    eventType: string
    text: string
  }
  runtimeActivity?: {
    phase: string
    scope?: string
    turn?: number
    text: string
    toolNames?: string[]
    durationMs?: number
    tokenUsage?: {
      inputTokens: number
      outputTokens: number
      totalTokens: number
    }
  }
  traceRefs?: TraceRelationRef[]
  conversationItem?: ConversationListItem
  raw: unknown
}

export interface ConversationListItem {
  id: string
  event: TimelineEvent
  role: ConversationRole
  block?: ContentBlock
}

export interface ExplorerSession {
  fileType: string
  fileName: string
  sourcePath?: string
  sourceFilePath?: string
  resources?: Record<string, string>
  meta: SessionMeta
  events: TimelineEvent[]
  conversationItems: ConversationListItem[]
  parseWarnings: ParseWarning[]
}

export interface WorkspaceStats {
  candidateCount: number
  loadedCount: number
  skippedCount: number
  skippedFiles: Array<{ path: string; reason: string }>
}

export interface WorkspaceProgress {
  completed: number
  total: number
}

export interface ParsedLine {
  lineIndex: number
  raw: string
  data: unknown
}

export type SelectionSource = 'timeline' | 'conversation'

export interface Selection {
  source: SelectionSource
  event?: TimelineEvent
  conversationItem?: ConversationListItem
}
