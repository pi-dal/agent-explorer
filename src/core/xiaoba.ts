import type { ExplorerSession, TimelineEvent } from './types'

export type XiaoBaTimelineScope = 'all' | 'workflow' | 'tool' | 'branch' | 'runtime' | 'prompt' | 'subagent'

export interface XiaoBaRuntimeToolMessage {
  phase: 'call' | 'result'
  turn: number
  name: string
  branchType?: string
  branchId?: string
  input?: string
  result?: string
  durationMs?: number
}

export type XiaoBaBranchActivityPhase =
  | 'context'
  | 'reasoning'
  | 'reasoning_complete'
  | 'model_output'
  | 'tool_selection'
  | 'tool_call'
  | 'tool_result'
  | 'context_update'
  | 'completed'
  | 'status'

export interface XiaoBaBranchActivity {
  branchType: string
  branchId: string
  turn: number
  phase: XiaoBaBranchActivityPhase
  text: string
  toolNames?: string[]
}

export type XiaoBaRuntimeActivityPhase =
  | 'connection'
  | 'startup'
  | 'scheduler'
  | 'tool_registry'
  | 'model_call'
  | 'model_context'
  | 'model_complete'
  | 'token_usage'
  | 'context_update'
  | 'tool_selection'
  | 'assistant_text'
  | 'final_response'
  | 'metrics'
  | 'prompt_trace'
  | 'cancelled'
  | 'error'
  | 'tool_transport'
  | 'upload'
  | 'skill'
  | 'observation'
  | 'truncation'
  | 'session'
  | 'status'

export interface XiaoBaRuntimeActivity {
  phase: XiaoBaRuntimeActivityPhase
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

export interface XiaoBaBranchIdentity {
  branchType: string
  branchId: string
}

export function parseXiaoBaBranchIdentity(value: string): XiaoBaBranchIdentity | undefined {
  const match = value.match(/^branch:([^:]+):(.+)$/)
  if (!match) return undefined
  return { branchType: match[1]!, branchId: match[2]! }
}

export function parseXiaoBaRuntimeToolMessage(
  message: string,
): XiaoBaRuntimeToolMessage | undefined {
  const call = message.match(/^\[([^\]]+) Turn (\d+)\] 执行工具:\s*([^|]+?)\s*\|\s*参数:\s*([\s\S]*)$/)
  if (call) {
    const branch = parseXiaoBaBranchIdentity(call[1]!)
    return {
      phase: 'call',
      turn: Number(call[2]),
      name: call[3]!.trim(),
      input: call[4]!.trim(),
      ...branch,
    }
  }

  const result = message.match(
    /^\[([^\]]+) Turn (\d+)\] 工具完成:\s*([^|]+?)\s*\|\s*耗时:\s*(\d+)ms\s*\|\s*结果:\s*([\s\S]*)$/,
  )
  if (!result) return undefined
  const branch = parseXiaoBaBranchIdentity(result[1]!)
  return {
    phase: 'result',
    turn: Number(result[2]),
    name: result[3]!.trim(),
    durationMs: Number(result[4]),
    result: result[5]!.trim(),
    ...branch,
  }
}

export function parseXiaoBaBranchActivity(
  message: string,
): XiaoBaBranchActivity | undefined {
  const match = message.match(/^\[branch:([^:]+):(.+?)\s+Turn\s+(\d+)\]\s*(.*)$/i)
  if (!match) return undefined

  const text = match[4]!.trim()
  const phase: XiaoBaBranchActivityPhase = text.startsWith('上下文:')
    ? 'context'
    : text.startsWith('调用AI推理')
      ? 'reasoning'
      : text.startsWith('AI推理完成')
        ? 'reasoning_complete'
        : text.startsWith('AI返回 tokens:')
          ? 'model_output'
          : text.startsWith('AI选择工具:')
            ? 'tool_selection'
            : text.startsWith('执行工具:')
              ? 'tool_call'
              : text.startsWith('工具完成:')
                ? 'tool_result'
                : text.startsWith('tool_result ')
                  ? 'context_update'
                  : text.includes('pause_turn 已触发')
                    ? 'completed'
                    : 'status'
  const toolNames = phase === 'tool_selection'
    ? [...text.matchAll(/\[([^\]]+)\]/g)].map(entry => entry[1]!.trim()).filter(Boolean)
    : undefined

  return {
    branchType: match[1]!,
    branchId: match[2]!,
    turn: Number(match[3]),
    phase,
    text,
    ...(toolNames && toolNames.length > 0 ? { toolNames } : {}),
  }
}

export function xiaobaBranchActivityLabel(activity: XiaoBaBranchActivity): string {
  const phaseLabel: Record<XiaoBaBranchActivityPhase, string> = {
    context: 'context',
    reasoning: 'reasoning',
    reasoning_complete: 'reasoning complete',
    model_output: 'model output',
    tool_selection: 'tool selection',
    tool_call: 'tool call',
    tool_result: 'tool result',
    context_update: 'context update',
    completed: 'completed',
    status: 'status',
  }
  return `Branch ${phaseLabel[activity.phase]} · ${activity.branchType}`
}

function runtimeActivityLabel(phase: XiaoBaRuntimeActivityPhase, turn?: number): string {
  const labels: Record<XiaoBaRuntimeActivityPhase, string> = {
    connection: 'Connection',
    startup: 'Agent startup',
    scheduler: 'Scheduler',
    tool_registry: 'Tool registry',
    model_call: 'Model call',
    model_context: 'Model context',
    model_complete: 'Model completed',
    token_usage: 'Token usage',
    context_update: 'Context update',
    tool_selection: 'Tool selection',
    assistant_text: 'Assistant text',
    final_response: 'Final response',
    metrics: 'Run metrics',
    prompt_trace: 'Prompt trace',
    cancelled: 'Request cancelled',
    error: 'Runtime error',
    tool_transport: 'Tool transport',
    upload: 'File activity',
    skill: 'Skill activity',
    observation: 'Observation activity',
    truncation: 'Output truncation',
    session: 'Session activity',
    status: 'Runtime status',
  }
  return `${labels[phase]}${turn === undefined ? '' : ` · Turn ${turn}`}`
}

function afterColon(text: string): string {
  const separator = text.indexOf('：') >= 0 ? text.indexOf('：') : text.indexOf(':')
  return separator < 0 ? text : text.slice(separator + 1).trim()
}

interface RuntimePrefix {
  scopes: string[]
  text: string
}

function parseRuntimePrefixes(message: string): RuntimePrefix {
  let text = message.trim()
  const scopes: string[] = []
  while (text.startsWith('[')) {
    const end = text.indexOf(']')
    if (end < 0) break
    scopes.push(text.slice(1, end).trim())
    text = text.slice(end + 1).trim()
  }
  return { scopes, text }
}

function runtimeScope(scopes: string[], defaultScope?: string): string | undefined {
  const normalizedDefault = defaultScope?.toLowerCase()
  const meaningful = scopes.filter((scope) => {
    const normalized = scope.toLowerCase()
    return !/\bturn\s+\d+\b/i.test(scope)
      && !normalized.startsWith('会话 ')
      && normalized !== 'metrics'
      && normalized !== 'runtime'
      && normalized !== normalizedDefault
  })
  return meaningful.join(' · ') || (
    defaultScope && !['runtime', 'info', 'debug', 'warn', 'error'].includes(normalizedDefault ?? '')
      ? defaultScope
      : undefined
  )
}

function transportField(text: string, key: string): string | undefined {
  return text.match(new RegExp(`\\b${key}=([^,\\s]+)`, 'i'))?.[1]
}

function transportDetail(text: string, action: string): {
  text: string
  toolNames?: string[]
} {
  const tool = transportField(text, 'tool')
  const request = transportField(text, 'request')
  const msg = transportField(text, 'msg')
  const timeout = transportField(text, 'timeoutMs')
  const hasError = transportField(text, 'hasError')
  const hasResult = transportField(text, 'hasResult')
  const values = [
    tool,
    request && `request=${request}`,
    msg && `message=${msg}`,
    timeout && `timeout=${timeout}ms`,
    hasError && `error=${hasError}`,
    hasResult && `result=${hasResult}`,
  ].filter(Boolean)
  return {
    text: values.length > 0 ? `${action}: ${values.join(' · ')}` : text,
    ...(tool ? { toolNames: [tool] } : {}),
  }
}

export function parseXiaoBaRuntimeActivity(
  message: string,
  options: { defaultScope?: string } = {},
): XiaoBaRuntimeActivity | undefined {
  const prefix = parseRuntimePrefixes(message)
  const scope = runtimeScope(prefix.scopes, options.defaultScope)
  const turnScope = prefix.scopes.find(value => /\bTurn\s+\d+\b/i.test(value))
  let text = prefix.text
  const turn = turnScope?.match(/\bTurn\s+(\d+)\b/i)?.[1]
  const turnNumber = turn ? Number(turn) : undefined
  let phase: XiaoBaRuntimeActivityPhase | undefined
  let detail = text
  let durationMs: number | undefined
  let tokenUsage: XiaoBaRuntimeActivity['tokenUsage']
  let toolNames: string[] | undefined

  const thinToolRpc = prefix.scopes.some(value => value.toLowerCase() === 'thin_tool_rpc')
  if (thinToolRpc && /executeTool request/i.test(text)) {
    phase = 'tool_transport'
    const transport = transportDetail(text, 'request')
    detail = transport.text
    toolNames = transport.toolNames
  } else if (thinToolRpc && /^send request:/i.test(text)) {
    phase = 'tool_transport'
    const transport = transportDetail(text, 'send')
    detail = transport.text
    toolNames = transport.toolNames
  } else if (thinToolRpc && /request acked by server/i.test(text)) {
    phase = 'tool_transport'
    const transport = transportDetail(text, 'ack')
    detail = transport.text
    toolNames = transport.toolNames
  } else if (thinToolRpc && /executeTool response/i.test(text)) {
    phase = 'tool_transport'
    const transport = transportDetail(text, 'response')
    detail = transport.text
    toolNames = transport.toolNames
  } else if (text.startsWith('调用AI推理')) {
    phase = 'model_call'
    const available = text.match(/可用工具:\s*(\d+)个/)
    detail = available ? `${available[1]} tools available` : text
  } else if (text.startsWith('模型上下文:')) {
    phase = 'model_context'
    detail = afterColon(text)
  } else if (text.startsWith('AI推理完成')) {
    phase = 'model_complete'
    const duration = text.match(/耗时:\s*(\d+)ms/)
    durationMs = duration ? Number(duration[1]) : undefined
    detail = durationMs === undefined ? text : `${durationMs} ms`
  } else if (text.startsWith('AI返回 tokens:')) {
    phase = 'token_usage'
    const usage = text.match(/tokens:\s*(\d+)\+(\d+)\s*=\s*(\d+)/i)
    if (usage) {
      tokenUsage = {
        inputTokens: Number(usage[1]),
        outputTokens: Number(usage[2]),
        totalTokens: Number(usage[3]),
      }
      detail = `input ${usage[1]} · output ${usage[2]} · total ${usage[3]} tokens`
    } else {
      detail = afterColon(text)
    }
  } else if (text.startsWith('AI选择工具:')) {
    phase = 'tool_selection'
    toolNames = [...text.matchAll(/\[([^\]]+)\]/g)].map(match => match[1]!.trim()).filter(Boolean)
    detail = toolNames.length > 0 ? toolNames.join(' · ') : afterColon(text)
  } else if (text.startsWith('AI文本:')) {
    phase = 'assistant_text'
    detail = afterColon(text)
  } else if (text.startsWith('AI最终回复:')) {
    phase = 'final_response'
    detail = afterColon(text)
  } else if (text.startsWith('AI调用:')) {
    phase = 'metrics'
    detail = afterColon(text)
  } else if (text.startsWith('tool_result ')) {
    phase = 'context_update'
    detail = afterColon(text)
  } else if (text.startsWith('Prompt trace:')) {
    phase = 'prompt_trace'
    detail = afterColon(text)
  } else if (text.includes('当前请求已取消')) {
    phase = 'cancelled'
    detail = afterColon(text)
  } else if (text.includes('处理失败')) {
    phase = 'error'
    detail = afterColon(text)
  } else if (text.startsWith('Tool use 已发送') || text.startsWith('Tool result 已发送')) {
    phase = 'tool_transport'
    detail = afterColon(text)
  } else if (text.startsWith('正在连接')) {
    phase = 'connection'
    detail = afterColon(text)
  } else if (text.includes('agent 已启动') || text.includes('agent started')) {
    phase = 'startup'
    detail = text
  } else if (/scheduler started/i.test(text)) {
    phase = 'scheduler'
    detail = text
  } else if (text.startsWith('已注册') && text.includes('工具')) {
    phase = 'tool_registry'
    detail = text
  } else if (text.includes('运行时可用工具数量')) {
    phase = 'tool_registry'
    detail = text
  } else if (text.startsWith('开始上传') || text.startsWith('上传成功') || text.startsWith('文件上传成功') || text.startsWith('CatsCo 文件已发送') || text.startsWith('已发送')) {
    phase = 'upload'
    detail = afterColon(text)
  } else if (text.startsWith('执行 Skill') || text.startsWith('已加载') && text.includes('skills')) {
    phase = 'skill'
    detail = afterColon(text)
  } else if (text.startsWith('injected ') && text.includes('synthetic runtime observation')) {
    phase = 'observation'
    detail = afterColon(text)
  } else if (text.startsWith('read_file truncation')) {
    phase = 'truncation'
    detail = afterColon(text)
  } else if (text.startsWith('新建会话') || text.startsWith('会话已保存')) {
    phase = 'session'
    detail = afterColon(text)
  }

  if (!phase) {
    phase = 'status'
    detail = text
  }
  if (!detail.trim()) return undefined
  return {
    phase,
    scope,
    turn: turnNumber,
    text: detail,
    ...(toolNames && toolNames.length > 0 ? { toolNames } : {}),
    ...(durationMs !== undefined && Number.isFinite(durationMs) ? { durationMs } : {}),
    ...(tokenUsage ? { tokenUsage } : {}),
  }
}

export function xiaobaRuntimeActivityLabel(activity: XiaoBaRuntimeActivity): string {
  return runtimeActivityLabel(activity.phase, activity.turn)
}

export function isXiaoBaSession(session: ExplorerSession | null | undefined): boolean {
  return session?.fileType.startsWith('XiaoBa') ?? false
}

export function xiaobaTimelineScope(event: TimelineEvent): XiaoBaTimelineScope {
  const raw = event.raw
  const isBranch = typeof raw === 'object'
    && raw !== null
    && !Array.isArray(raw)
    && ((raw as Record<string, unknown>).entry_type === 'branch'
      || (raw as Record<string, unknown>).entry_type === 'embedded_trace')
  if (
    isBranch
    || event.kind === 'branch_anchor'
    || event.kind === 'branch_lifecycle'
    || event.branchActivity
    || event.traceRefs?.some(ref => ref.kind === 'branch')
  ) return 'branch'
  if (event.kind === 'prompt_trace' || event.runtimeActivity?.phase === 'prompt_trace') return 'prompt'
  if (event.runtimeActivity || event.kind === 'runtime_activity') return 'runtime'
  if (event.category === 'tool' || event.kind === 'tool_call' || event.kind === 'tool_result') {
    return 'tool'
  }
  if (event.kind === 'runtime') return 'runtime'
  if (event.kind === 'subagent_event') return 'subagent'
  return 'workflow'
}

export function filterXiaoBaTimeline(
  events: TimelineEvent[],
  scope: XiaoBaTimelineScope,
): TimelineEvent[] {
  if (scope === 'all') return events
  return events.filter(event => xiaobaTimelineScope(event) === scope)
}

export function countXiaoBaTimelineScopes(
  events: TimelineEvent[],
): Record<XiaoBaTimelineScope, number> {
  const counts: Record<XiaoBaTimelineScope, number> = {
    all: events.length,
    workflow: 0,
    tool: 0,
    branch: 0,
    runtime: 0,
    prompt: 0,
    subagent: 0,
  }
  for (const event of events) counts[xiaobaTimelineScope(event)]++
  return counts
}

export interface XiaoBaPromptResource {
  path: string
  content: string
}

export function resolveXiaoBaPromptResources(
  resources: Record<string, string> | undefined,
  promptsDir: string | undefined,
  loadedFiles: string[],
): XiaoBaPromptResource[] {
  if (!resources) return []
  const entries = Object.entries(resources)
  return loadedFiles.flatMap((loadedFile) => {
    const normalizedFile = loadedFile.replace(/^\.\//, '')
    const expected = promptsDir
      ? `${promptsDir.replace(/\/$/, '')}/${normalizedFile}`
      : normalizedFile
    const match = entries.find(([path]) => path === expected)
      ?? entries.find(([path]) => path.endsWith(`/${expected}`))
      ?? entries.find(([path]) => path.endsWith(`/${normalizedFile}`))
    return match ? [{ path: match[0], content: match[1] }] : []
  })
}
