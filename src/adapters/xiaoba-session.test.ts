import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detectAndParse } from '../core/registry'
import type { ParsedLine } from '../core/types'
import { parseXiaoBaRuntimeToolMessage } from '../core/xiaoba'
import { xiaobaSessionAdapter } from './xiaoba-session'

function line(data: Record<string, unknown>, lineIndex = 1): ParsedLine {
  return { lineIndex, raw: JSON.stringify(data), data }
}

function turn(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    entry_type: 'turn',
    turn: 1,
    timestamp: '2026-07-08T05:00:39.675Z',
    session_id: 'cli',
    session_type: 'chat',
    episode_id: 'episode-1',
    user: { text: 'Inspect the repository' },
    assistant: {
      text: 'The repository is ready.',
      tool_calls: [
        {
          id: 'tool-1',
          name: 'bash',
          arguments: { command: 'rg --files' },
          result: 'src/main.ts\n',
          duration_ms: 12,
        },
      ],
    },
    tokens: { prompt: 120, completion: 30 },
    ...overrides,
  }
}

describe('xiaobaSessionAdapter.detect', () => {
  it('detects files whose first entries are prompt traces', () => {
    const samples = Array.from({ length: 20 }, (_, index) => line({
      entry_type: 'prompt_trace',
      timestamp: `2026-07-08T05:00:${String(index).padStart(2, '0')}.000Z`,
      session_id: 'cli',
      session_type: 'chat',
      prompt: { source: 'session-provider', prompt_version: 'local' },
    }, index + 1))

    expect(xiaobaSessionAdapter.detect(samples)).toBe(1)
  })

  it('detects legacy turn entries without entry_type', () => {
    const legacy = turn()
    delete legacy.entry_type
    expect(xiaobaSessionAdapter.detect([line(legacy)])).toBe(1)
  })

  it('detects persisted XiaoBa context messages', () => {
    expect(xiaobaSessionAdapter.detect([
      line({
        role: 'user',
        content: 'Hello',
        __episodeId: 'episode:1',
        __episodeInputKind: 'root',
      }),
      line({ role: 'assistant', content: 'Hi', __episodeId: 'episode:1' }, 2),
    ])).toBe(1)
  })

  it('detects XiaoBa branch execution logs', () => {
    expect(xiaobaSessionAdapter.detect([line({
      entry_type: 'branch',
      branch_type: 'distillation',
      branch_id: 'distillation-1',
      event_type: 'review_result',
      timestamp: '2026-07-11T10:57:58.324Z',
      decision: 'promote',
    })])).toBe(1)
  })
})

describe('XiaoBa built-in sample', () => {
  it('loads as a XiaoBa trace with tools, memory, and distillation', () => {
    const sample = readFileSync(fileURLToPath(
      new URL('../fixtures/xiaoba-session.sample.jsonl', import.meta.url),
    ), 'utf8')
    const session = detectAndParse(sample, 'xiaoba-session.sample.jsonl')

    expect(session.fileType).toBe('XiaoBa')
    expect(session.conversationItems.some(item => item.block?.toolName === 'memory_search')).toBe(true)
    expect(session.events.some(event => (
      typeof event.raw === 'object'
      && event.raw !== null
      && !Array.isArray(event.raw)
      && (event.raw as Record<string, unknown>).branch_type === 'distillation'
    ))).toBe(true)
  })
})

describe('xiaobaSessionAdapter.parse', () => {
  it('expands a turn into user, tool, result, and assistant items', () => {
    const session = xiaobaSessionAdapter.parse([line(turn())], 'chat_cli.jsonl')

    expect(session.fileType).toBe('XiaoBa')
    expect(session.meta).toMatchObject({
      sessionId: 'cli',
      eventCount: 1,
      turnCount: 1,
    })
    expect(session.conversationItems.map(item => item.role)).toEqual([
      'user',
      'tool_call',
      'tool_result',
      'assistant',
    ])
    expect(session.conversationItems[1]?.block).toMatchObject({
      toolName: 'bash',
      toolCallId: 'tool-1',
      toolInput: { command: 'rg --files' },
      status: 'pending',
    })
    expect(session.conversationItems[2]?.block).toMatchObject({
      toolCallId: 'tool-1',
      status: 'completed',
    })
    expect(session.events[0]?.usage).toEqual({
      inputTokens: 120,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      outputTokens: 30,
    })
    expect(session.events[0]?.requestId).toBe('episode-1')
  })

  it('keeps runtime, prompt trace, and subagent entries on the timeline', () => {
    const session = xiaobaSessionAdapter.parse([
      line({
        entry_type: 'runtime',
        timestamp: '2026-07-08T05:00:39.533Z',
        session_id: 'cli',
        session_type: 'chat',
        level: 'INFO',
        message: 'Calling model',
      }),
      line({
        entry_type: 'prompt_trace',
        timestamp: '2026-07-08T05:00:39.600Z',
        session_id: 'cli',
        session_type: 'chat',
        prompt: { source: 'prompt-manager', prompt_version: 'local' },
      }, 2),
      line({
        entry_type: 'subagent_event',
        timestamp: '2026-07-08T05:00:39.650Z',
        session_id: 'cli',
        session_type: 'chat',
        subagent: { id: 'worker-1', seq: 1 },
        event: { type: 'completed', summary: 'Worker completed' },
      }, 3),
    ], 'events.jsonl')

    expect(session.events.map(event => event.category)).toEqual(['system', 'meta', 'tool'])
    expect(session.events.map(event => event.kind)).toEqual([
      'runtime',
      'prompt_trace',
      'subagent_event',
    ])
    expect(session.conversationItems.map(item => item.role)).toEqual(['system', 'system', 'system'])
  })

  it('is selected by the registry', () => {
    const session = detectAndParse(`${JSON.stringify(turn())}\n`, 'xiaoba.jsonl')
    expect(session.fileType).toBe('XiaoBa')
  })

  it('parses persisted context messages and links tool results', () => {
    const session = xiaobaSessionAdapter.parse([
      line({ role: 'user', content: 'List files', __episodeId: 'episode:1' }),
      line({
        role: 'assistant',
        content: null,
        __episodeId: 'episode:1',
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: { name: 'bash', arguments: '{"command":"ls"}' },
        }],
      }, 2),
      line({
        role: 'tool',
        name: 'bash',
        content: 'README.md',
        tool_call_id: 'call-1',
        __episodeId: 'episode:1',
      }, 3),
      line({ role: 'assistant', content: 'Done', __episodeId: 'episode:1' }, 4),
      line({ role: 'user', content: 'Continue', __episodeId: 'episode:2' }, 5),
    ], 'cli.jsonl')

    expect(session.meta).toMatchObject({ sessionId: 'cli', eventCount: 5, turnCount: 2 })
    expect(session.events.map(event => event.turnIndex)).toEqual([1, 1, 1, 1, 2])
    expect(session.conversationItems.map(item => item.role)).toEqual([
      'user',
      'tool_call',
      'assistant',
      'tool_result',
      'assistant',
      'user',
    ])
    expect(session.conversationItems[1]?.block).toMatchObject({
      toolName: 'bash',
      toolCallId: 'call-1',
      toolInput: { command: 'ls' },
    })
    expect(session.conversationItems[3]?.block).toMatchObject({
      toolCallId: 'call-1',
      status: 'completed',
    })
  })

  it('does not claim generic role/content JSONL without XiaoBa markers', () => {
    expect(xiaobaSessionAdapter.detect([
      line({ role: 'user', content: 'Hello' }),
      line({ role: 'assistant', content: 'Hi' }, 2),
    ])).toBe(0)
  })

  it('structures legacy runtime tool messages as linked calls and results', () => {
    const session = xiaobaSessionAdapter.parse([
      line({
        entry_type: 'runtime',
        timestamp: '2026-07-08T05:00:39.533Z',
        session_id: 'cli',
        session_type: 'chat',
        level: 'INFO',
        message: '[cli Turn 2] 执行工具: bash | 参数: {"command":"ls"}',
      }),
      line({
        entry_type: 'runtime',
        timestamp: '2026-07-08T05:00:39.534Z',
        session_id: 'cli',
        session_type: 'chat',
        level: 'INFO',
        message: '[cli Turn 2] 工具完成: bash | 耗时: 12ms | 结果: README.md',
      }, 2),
    ], 'legacy-tools.jsonl')

    expect(session.events.map(event => event.kind)).toEqual(['tool_call', 'tool_result'])
    expect(session.events.map(event => event.turnIndex)).toEqual([2, 2])
    expect(session.conversationItems.map(item => item.role)).toEqual(['tool_call', 'tool_result'])
    expect(session.conversationItems[0]?.block).toMatchObject({
      toolName: 'bash',
      toolInput: { command: 'ls' },
    })
    expect(session.conversationItems[1]?.block?.toolCallId).toBe(
      session.conversationItems[0]?.block?.toolCallId,
    )
  })

  it('keeps branch execution events and metadata', () => {
    const session = xiaobaSessionAdapter.parse([line({
      entry_type: 'branch',
      branch_type: 'skill-author',
      branch_id: 'skill-author-1',
      event_type: 'fixture_result',
      timestamp: '2026-07-11T10:57:58.324Z',
      round: 2,
      result: 'passed',
    })], 'branch.jsonl')

    expect(session.meta.sessionId).toBe('skill-author-1')
    expect(session.events[0]).toMatchObject({
      category: 'tool',
      kind: 'fixture_result',
      label: 'skill-author · fixture_result',
      preview: 'passed',
      turnIndex: 2,
    })
    expect(session.conversationItems).toHaveLength(1)
    expect(session.conversationItems[0]).toMatchObject({ role: 'system' })
  })

  it('summarizes distillation payloads instead of dumping large arrays', () => {
    const session = xiaobaSessionAdapter.parse([line({
      entry_type: 'branch',
      branch_type: 'distillation',
      branch_id: 'distillation-1',
      event_type: 'start',
      timestamp: '2026-07-11T10:57:58.324Z',
      source_file_path: '/project/logs/sessions/chat/chat_cli.jsonl',
      byte_range: { start: 0, end: 214410 },
      new_turns: Array.from({ length: 20 }, () => 1),
      continuity_turn_count: 0,
    })], 'distillation.jsonl')

    const text = session.conversationItems[0]?.block?.text
    expect(text).toBe([
      'Source: /project/logs/sessions/chat/chat_cli.jsonl',
      'Bytes: 0–214410',
      'New turns: 1 (20 records)',
      'Continuity: 0 turns',
    ].join('\n'))
    expect(text).not.toContain('"new_turns"')
    expect(text).not.toContain('[\n')
  })

  it('summarizes distillation transcript collection sizes', () => {
    const session = xiaobaSessionAdapter.parse([line({
      entry_type: 'branch',
      branch_type: 'distillation',
      branch_id: 'distillation-1',
      event_type: 'transcript',
      timestamp: '2026-07-11T10:57:58.324Z',
      candidates: [{}, {}],
      reviews: [{}],
      installations: [{}],
      outcomes: [{}],
      unit: { large: 'raw payload remains available in the detail panel' },
    })], 'distillation.jsonl')

    expect(session.conversationItems[0]?.block?.text).toBe([
      'Candidates: 2',
      'Reviews: 1',
      'Installations: 1',
      'Outcomes: 1',
    ].join('\n'))
  })

  it('expands memory transcripts into instructions, request, tools, and results', () => {
    const session = xiaobaSessionAdapter.parse([line({
      entry_type: 'branch',
      branch_type: 'memory',
      branch_id: 'memory-1',
      event_type: 'transcript',
      timestamp: '2026-07-11T10:57:58.324Z',
      messages: [
        { role: 'system', content: 'Search memory safely.' },
        {
          role: 'user',
          content: '{"current_user_input":"hello","recent_completed_turns":[],"memory_source_available":true}',
        },
        {
          role: 'assistant',
          content: 'I will search.',
          tool_calls: [{
            id: 'memory-call-1',
            type: 'function',
            function: { name: 'memory_search', arguments: '{"keywords":["hello"]}' },
          }],
        },
        {
          role: 'tool',
          name: 'memory_search',
          tool_call_id: 'memory-call-1',
          content: '{"refs":[]}',
        },
      ],
    })], 'memory.jsonl')

    expect(session.conversationItems.map(item => item.role)).toEqual([
      'system', 'user', 'tool_call', 'assistant', 'tool_result',
    ])
    expect(session.conversationItems[1]?.block?.text).toBe([
      'Current request: hello',
      'Recent completed turns: 0',
      'Memory source: available',
    ].join('\n'))
    expect(session.conversationItems[2]?.block).toMatchObject({
      toolName: 'memory_search',
      toolInput: { keywords: ['hello'] },
      toolCallId: 'memory-call-1',
    })
    expect(session.conversationItems[4]?.block?.toolCallId).toBe('memory-call-1')
  })

  it('structures subagent tool lifecycle events', () => {
    const session = xiaobaSessionAdapter.parse([
      line({
        entry_type: 'subagent_event',
        timestamp: '2026-07-11T10:57:58.324Z',
        session_id: 'cli',
        session_type: 'chat',
        subagent: { id: 'worker-1', seq: 1 },
        event: { type: 'agent_tool_start', summary: '开始执行工具 read_file', payload: { toolName: 'read_file' } },
      }),
      line({
        entry_type: 'subagent_event',
        timestamp: '2026-07-11T10:57:58.425Z',
        session_id: 'cli',
        session_type: 'chat',
        subagent: { id: 'worker-1', seq: 2 },
        event: { type: 'agent_tool_end', summary: '工具 read_file 完成', payload: { toolName: 'read_file' } },
      }, 2),
    ], 'subagent.jsonl')

    expect(session.events.map(event => event.kind)).toEqual(['tool_call', 'tool_result'])
    expect(session.conversationItems.map(item => item.role)).toEqual(['tool_call', 'tool_result'])
    expect(session.conversationItems[1]?.block?.toolCallId).toBe(
      session.conversationItems[0]?.block?.toolCallId,
    )
  })
})

describe('parseXiaoBaRuntimeToolMessage', () => {
  it('parses calls and completed results', () => {
    expect(parseXiaoBaRuntimeToolMessage(
      '[cli Turn 1] 执行工具: send_text | 参数: {"text":"hello"}',
    )).toMatchObject({ phase: 'call', turn: 1, name: 'send_text' })
    expect(parseXiaoBaRuntimeToolMessage(
      '[cli Turn 1] 工具完成: send_text | 耗时: 1ms | 结果: 已发送',
    )).toEqual({
      phase: 'result',
      turn: 1,
      name: 'send_text',
      durationMs: 1,
      result: '已发送',
    })
  })
})
