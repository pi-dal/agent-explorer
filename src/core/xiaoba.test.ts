import { describe, expect, it } from 'vitest'
import type { TimelineEvent } from './types'
import {
  countXiaoBaTimelineScopes,
  filterXiaoBaTimeline,
  parseXiaoBaBranchActivity,
  parseXiaoBaRuntimeActivity,
  parseXiaoBaRuntimeToolMessage,
  xiaobaBranchActivityLabel,
  xiaobaRuntimeActivityLabel,
  xiaobaTimelineScope,
  resolveXiaoBaPromptResources,
  isXiaoBaSession,
} from './xiaoba'

function event(kind: string, lineIndex: number, category: TimelineEvent['category'] = 'meta'): TimelineEvent {
  return {
    id: `line-${lineIndex}`,
    lineIndex,
    category,
    kind,
    label: kind,
    preview: '',
    raw: {},
  }
}

describe('XiaoBa timeline scopes', () => {
  const events = [
    event('turn', 1),
    event('user', 2),
    event('tool_call', 3, 'tool'),
    event('runtime', 4),
    event('prompt_trace', 5),
    event('subagent_event', 6),
  ]

  it('classifies execution records into workflow-oriented scopes', () => {
    expect(events.map(xiaobaTimelineScope)).toEqual([
      'workflow',
      'workflow',
      'tool',
      'runtime',
      'prompt',
      'subagent',
    ])
  })

  it('filters and counts scopes consistently', () => {
    expect(filterXiaoBaTimeline(events, 'workflow')).toHaveLength(2)
    expect(filterXiaoBaTimeline(events, 'tool')).toEqual([events[2]])
    expect(filterXiaoBaTimeline(events, 'runtime')).toEqual([events[3]])
    expect(countXiaoBaTimelineScopes(events)).toEqual({
      all: 6,
      workflow: 2,
      tool: 1,
      branch: 0,
      runtime: 1,
      prompt: 1,
      subagent: 1,
    })
  })

  it('keeps branch records in their own scope', () => {
    const branch = event('review_result', 7, 'tool')
    branch.raw = { entry_type: 'branch', branch_type: 'distillation' }
    expect(xiaobaTimelineScope(branch)).toBe('branch')
    expect(filterXiaoBaTimeline([...events, branch], 'branch')).toEqual([branch])
  })

  it('keeps branch activity out of the generic runtime scope', () => {
    const branchActivity = event('branch_activity', 8)
    branchActivity.branchActivity = {
      branchType: 'memory',
      branchId: 'memory-1',
      turn: 1,
      phase: 'context',
      text: '上下文: 1 条消息',
    }
    expect(xiaobaTimelineScope(branchActivity)).toBe('branch')
    expect(filterXiaoBaTimeline([...events, branchActivity], 'branch')).toEqual([branchActivity])
  })

  it('keeps runtime prompt traces in the prompt scope', () => {
    const prompt = event('runtime_activity', 9, 'meta')
    prompt.runtimeActivity = {
      phase: 'prompt_trace',
      text: 'system=abc, bundle=def',
    }
    expect(xiaobaTimelineScope(prompt)).toBe('prompt')
  })
})

describe('parseXiaoBaRuntimeToolMessage', () => {
  it('extracts branch identity from runtime tool messages', () => {
    expect(parseXiaoBaRuntimeToolMessage(
      '[branch:memory:memory-1 Turn 2] 执行工具: memory_search | 参数: {"q":"skills"}',
    )).toMatchObject({
      phase: 'call',
      turn: 2,
      name: 'memory_search',
      branchType: 'memory',
      branchId: 'memory-1',
    })
  })
})

describe('parseXiaoBaBranchActivity', () => {
  it('normalizes branch context and tool-selection status lines', () => {
    const context = parseXiaoBaBranchActivity(
      '[branch:memory:memory-1 Turn 2] 上下文: 3 条消息',
    )
    expect(context).toMatchObject({
      branchType: 'memory',
      branchId: 'memory-1',
      turn: 2,
      phase: 'context',
      text: '上下文: 3 条消息',
    })
    expect(xiaobaBranchActivityLabel(context!)).toBe('Branch context · memory')

    expect(parseXiaoBaBranchActivity(
      '[branch:memory:memory-1 Turn 2] AI选择工具: [memory_search]',
    )).toMatchObject({
      phase: 'tool_selection',
      toolNames: ['memory_search'],
    })
  })
})

describe('parseXiaoBaRuntimeActivity', () => {
  it('normalizes model lifecycle, token, and prompt runtime lines', () => {
    expect(parseXiaoBaRuntimeActivity(
      '[cli Turn 2] 调用AI推理 (可用工具: 18个)',
    )).toMatchObject({
      phase: 'model_call',
      turn: 2,
      text: '18 tools available',
    })
    expect(parseXiaoBaRuntimeActivity(
      '[cli Turn 2] AI返回 tokens: 100+20=120',
    )).toMatchObject({
      phase: 'token_usage',
      tokenUsage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      text: 'input 100 · output 20 · total 120 tokens',
    })
    const prompt = parseXiaoBaRuntimeActivity(
      '[会话 cli] Prompt trace: system=abc, bundle=def, files=33, version=local',
    )
    expect(prompt).toMatchObject({ phase: 'prompt_trace', text: 'system=abc, bundle=def, files=33, version=local' })
    expect(xiaobaRuntimeActivityLabel(prompt!)).toBe('Prompt trace')

    expect(parseXiaoBaRuntimeActivity(
      '[cc_group:grp_734 Turn 2] tool_result context: before=1 results/1257 chars/315 tokens_est; after=1 results/1257 chars/315 tokens_est; saved=0 chars/0 tokens_est',
    )).toMatchObject({
      phase: 'context_update',
      turn: 2,
      text: 'before=1 results/1257 chars/315 tokens_est; after=1 results/1257 chars/315 tokens_est; saved=0 chars/0 tokens_est',
    })
    expect(parseXiaoBaRuntimeActivity(
      '[cc_group:grp_734 Turn 2] 模型上下文: gpt-5 window=128000',
    )).toMatchObject({
      phase: 'model_context',
      text: 'gpt-5 window=128000',
    })
  })

  it('normalizes multi-scope transport and startup messages', () => {
    expect(parseXiaoBaRuntimeActivity(
      '[CatsCompany][thin_tool_rpc] executeTool request: request=req-1, tool=execute_shell, targetOwner=usr-1',
    )).toMatchObject({
      phase: 'tool_transport',
      scope: 'CatsCompany · thin_tool_rpc',
      toolNames: ['execute_shell'],
      text: 'request: execute_shell · request=req-1',
    })
    expect(parseXiaoBaRuntimeActivity('正在连接：wss://example.test/v0/channels', {
      defaultScope: 'catscompany',
    })).toMatchObject({
      phase: 'connection',
      scope: 'catscompany',
      text: 'wss://example.test/v0/channels',
    })
    expect(parseXiaoBaRuntimeActivity('unclassified runtime message')).toMatchObject({
      phase: 'status',
      text: 'unclassified runtime message',
    })
  })
})

describe('isXiaoBaSession', () => {
  it('recognizes all XiaoBa log families', () => {
    for (const fileType of ['XiaoBa', 'XiaoBa Log', 'XiaoBa Subagent']) {
      expect(isXiaoBaSession({ fileType } as never)).toBe(true)
    }
    expect(isXiaoBaSession({ fileType: 'Claude Code' } as never)).toBe(false)
  })
})

describe('resolveXiaoBaPromptResources', () => {
  it('matches loaded prompt files from an opened XiaoBa folder', () => {
    const resources = {
      'xiaoba-cli/app/prompts/system-prompt.md': 'system body',
      'app/prompts/runtime-context.md': 'runtime body',
    }
    expect(resolveXiaoBaPromptResources(
      resources,
      'app/prompts',
      ['runtime-context.md', 'system-prompt.md'],
    )).toEqual([
      { path: 'app/prompts/runtime-context.md', content: 'runtime body' },
      { path: 'xiaoba-cli/app/prompts/system-prompt.md', content: 'system body' },
    ])
  })
})
