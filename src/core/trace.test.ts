import { describe, expect, it } from 'vitest'
import { xiaobaSessionAdapter } from '../adapters/xiaoba-session'
import type { ParsedLine } from './types'
import { composeTraceGraph, traceTranscriptEntries } from './trace'

function line(data: Record<string, unknown>, lineIndex: number): ParsedLine {
  return { lineIndex, raw: JSON.stringify(data), data }
}

function sourceTurn(): Record<string, unknown> {
  return {
    entry_type: 'turn',
    turn: 1,
    timestamp: '2026-07-09T07:11:00.000Z',
    session_id: 'distillation-smoke',
    session_type: 'chat',
    user: { text: 'How should the parser handle partial JSONL lines?' },
    assistant: {
      text: 'Use a cursor-backed append-only reader.',
      tool_calls: [],
    },
    tokens: { prompt: 20, completion: 12 },
  }
}

describe('composeTraceGraph', () => {
  it('embeds a distillation run back into its source session', () => {
    const parent = xiaobaSessionAdapter.parse([
      line(sourceTurn(), 1),
    ], 'chat_distillation_smoke.jsonl')
    parent.sourcePath = 'xiaoba-cli/logs/sessions/chat/chat_distillation_smoke.jsonl'

    const child = xiaobaSessionAdapter.parse([
      line({
        entry_type: 'branch',
        branch_type: 'distillation',
        branch_id: 'distillation-1',
        event_type: 'start',
        timestamp: '2026-07-09T07:12:00.000Z',
        source_file_path: '/Users/pi/XiaoBa-CLI/logs/sessions/chat/chat_distillation_smoke.jsonl',
        byte_range: { start: 0, end: 1203 },
        new_turns: [1],
        continuity_turn_count: 0,
      }, 1),
      line({
        entry_type: 'branch',
        branch_type: 'distillation',
        branch_id: 'distillation-1',
        event_type: 'distiller_output',
        timestamp: '2026-07-09T07:12:00.001Z',
        candidate_count: 1,
        candidates: [{ capability_id: 'cap-1', title: 'Safe JSONL cursor processing' }],
      }, 2),
      line({
        entry_type: 'branch',
        branch_type: 'distillation',
        branch_id: 'distillation-1',
        event_type: 'run_result',
        timestamp: '2026-07-09T07:12:00.002Z',
        candidate_count: 1,
        installation_count: 1,
        review_counts: { promote: 1, needs_review: 0, reject: 0 },
      }, 3),
    ], 'distillation-1.jsonl')
    child.sourcePath = 'xiaoba-cli/logs/branches/distillation/2026-07-09/distillation-1.jsonl'

    const graph = composeTraceGraph([parent, child])
    const anchor = parent.events.find(event => event.kind === 'branch_anchor')

    expect(graph.relations).toHaveLength(1)
    expect(graph.relations[0]).toMatchObject({
      kind: 'distillation',
      branchType: 'distillation',
      branchId: 'distillation-1',
      confidence: 'exact',
      anchorTurn: 1,
      sourceByteRange: { start: 0, end: 1203 },
    })
    expect(anchor).toMatchObject({
      kind: 'branch_anchor',
      label: 'Distillation · distillation-1',
      turnIndex: 1,
    })
    expect(anchor?.traceRefs?.[0]?.childSessionKey).toBe(child.sourcePath)
    expect(anchor?.conversationItem?.block?.text).toContain('candidates 1 · installed 1 · promoted 1')
  })

  it('links explicit branch runtime events by branch identity', () => {
    const parent = xiaobaSessionAdapter.parse([
      line({
        entry_type: 'runtime',
        timestamp: '2026-07-13T07:00:00.000Z',
        session_id: 'main',
        session_type: 'chat',
        level: 'INFO',
        message: '[branch:memory:memory-1 Turn 1] 执行工具: memory_search | 参数: {"q":"skills"}',
      }, 1),
    ], 'main.jsonl')
    parent.sourcePath = 'xiaoba-cli/logs/sessions/chat/main.jsonl'

    const child = xiaobaSessionAdapter.parse([
      line({
        entry_type: 'branch',
        branch_type: 'memory',
        branch_id: 'memory-1',
        event_type: 'start',
        timestamp: '2026-07-13T07:00:00.001Z',
        message_count: 2,
      }, 1),
    ], 'memory-1.jsonl')
    child.sourcePath = 'xiaoba-cli/logs/branches/memory/memory-1.jsonl'

    const graph = composeTraceGraph([parent, child])

    expect(graph.relations).toMatchObject([{
      kind: 'branch',
      branchType: 'memory',
      branchId: 'memory-1',
      anchorEventId: 'line-1',
      confidence: 'exact',
    }])
    expect(parent.events[0]?.traceRefs?.[0]).toMatchObject({
      kind: 'branch',
      childSessionKey: child.sourcePath,
    })
  })
})

describe('traceTranscriptEntries', () => {
  it('keeps child system messages and pairs every child tool result', () => {
    const child = xiaobaSessionAdapter.parse([
      line({
        entry_type: 'branch',
        branch_type: 'memory',
        branch_id: 'memory-1',
        event_type: 'transcript',
        timestamp: '2026-07-13T07:00:00.000Z',
        messages: [
          { role: 'system', content: 'You are a memory branch.' },
          { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', name: 'memory_search', arguments: '{"q":"skills"}' }] },
          { role: 'tool', name: 'memory_search', content: '{"count":0}', tool_call_id: 'call-1' },
        ],
      }, 1),
    ], 'memory-1.jsonl')

    const entries = traceTranscriptEntries(child)

    expect(entries.map(entry => entry.kind)).toEqual(['message', 'tool'])
    expect(entries[0]?.item.block?.text).toContain('You are a memory branch.')
    expect(entries[1]).toMatchObject({
      item: { block: { toolName: 'memory_search' } },
      result: { block: { text: '{"count":0}' } },
    })
  })
})
