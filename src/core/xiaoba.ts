import type { ExplorerSession, TimelineEvent } from './types'

export type XiaoBaTimelineScope = 'all' | 'workflow' | 'runtime' | 'prompt' | 'subagent'

export interface XiaoBaRuntimeToolMessage {
  phase: 'call' | 'result'
  turn: number
  name: string
  input?: string
  result?: string
  durationMs?: number
}

export function parseXiaoBaRuntimeToolMessage(
  message: string,
): XiaoBaRuntimeToolMessage | undefined {
  const call = message.match(/^\[[^\]]+ Turn (\d+)\] 执行工具:\s*([^|]+?)\s*\|\s*参数:\s*([\s\S]*)$/)
  if (call) {
    return {
      phase: 'call',
      turn: Number(call[1]),
      name: call[2]!.trim(),
      input: call[3]!.trim(),
    }
  }

  const result = message.match(
    /^\[[^\]]+ Turn (\d+)\] 工具完成:\s*([^|]+?)\s*\|\s*耗时:\s*(\d+)ms\s*\|\s*结果:\s*([\s\S]*)$/,
  )
  if (!result) return undefined
  return {
    phase: 'result',
    turn: Number(result[1]),
    name: result[2]!.trim(),
    durationMs: Number(result[3]),
    result: result[4]!.trim(),
  }
}

export function isXiaoBaSession(session: ExplorerSession | null | undefined): boolean {
  return session?.fileType.startsWith('XiaoBa') ?? false
}

export function xiaobaTimelineScope(event: TimelineEvent): XiaoBaTimelineScope {
  if (event.kind === 'runtime') return 'runtime'
  if (event.kind === 'prompt_trace') return 'prompt'
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
