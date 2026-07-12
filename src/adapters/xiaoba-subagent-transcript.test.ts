import { describe, expect, it } from 'vitest'
import { detectAndParse } from '../core/registry'

describe('XiaoBa subagent transcript', () => {
  it('preserves thinking, tool parameters, and tool lifecycle', () => {
    const entries = [
      {
        version: 1, recordType: 'message', runId: 'run-1', agent: 'reviewer',
        timestamp: '2026-07-08T05:29:41.634Z', ts: 1, role: 'user', text: 'Review code',
      },
      {
        version: 1, recordType: 'message', runId: 'run-1', agent: 'reviewer',
        timestamp: '2026-07-08T05:29:43.980Z', ts: 2, role: 'assistant', model: 'glm',
        message: { role: 'assistant', content: [
          { type: 'thinking', thinking: 'Need inspect files' },
          { type: 'text', text: 'I will inspect it.' },
          { type: 'toolCall', id: 'call-1', name: 'read', arguments: { path: 'src/a.ts' } },
        ] },
      },
      {
        version: 1, recordType: 'tool_start', runId: 'run-1', agent: 'reviewer',
        timestamp: '2026-07-08T05:29:44.000Z', ts: 3, toolName: 'read', argsPreview: 'src/a.ts',
      },
      {
        version: 1, recordType: 'tool_end', runId: 'run-1', agent: 'reviewer',
        timestamp: '2026-07-08T05:29:44.100Z', ts: 4, toolName: 'read',
      },
    ]
    const session = detectAndParse(entries.map(value => JSON.stringify(value)).join('\n'), 'reviewer.jsonl')

    expect(session.fileType).toBe('XiaoBa Subagent')
    expect(session.meta).toMatchObject({ sessionId: 'run-1', model: 'glm', turnCount: 1 })
    expect(session.conversationItems.map(item => item.role)).toEqual([
      'user', 'thinking', 'assistant', 'tool_call', 'tool_result',
    ])
    expect(session.conversationItems[3]?.block).toMatchObject({
      toolName: 'read',
      toolInput: { path: 'src/a.ts' },
      toolCallId: 'call-1',
    })
    expect(session.conversationItems[4]?.block?.toolCallId).toBe('call-1')
  })
})
