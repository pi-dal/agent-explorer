import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detectAndParse } from '../core/registry'
import { parseJsonlText } from '../core/jsonl'
import { BLOCK_TEXT_LIMIT } from '../core/text'
import { claudeTranscriptAdapter } from './claude-transcript'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')
const sampleText = readFileSync(
  join(fixtureDir, 'claude-transcript.sample.jsonl'),
  'utf8',
)

function line(data: Record<string, unknown>, lineIndex = 1) {
  return {
    lineIndex,
    raw: JSON.stringify(data),
    data,
  }
}

describe('claudeTranscriptAdapter.detect', () => {
  it('returns high confidence for Claude transcript samples', () => {
    const { lines } = parseJsonlText(sampleText)
    expect(claudeTranscriptAdapter.detect(lines)).toBeGreaterThan(0.8)
  })

  it('returns zero for unrelated JSONL', () => {
    const score = claudeTranscriptAdapter.detect([
      line({ foo: 'bar' }),
      line({ hello: 'world' }, 2),
    ])
    expect(score).toBe(0)
  })
})

describe('claudeTranscriptAdapter.parse', () => {
  it('flattens assistant thinking into its own conversation item', () => {
    const session = claudeTranscriptAdapter.parse(
      [
        line({
          type: 'user',
          uuid: 'user-1',
          message: { role: 'user', content: 'Hello' },
        }),
        line(
          {
            type: 'assistant',
            uuid: 'asst-1',
            message: {
              role: 'assistant',
              content: [
                { type: 'thinking', thinking: 'Need to greet the user politely.' },
                { type: 'text', text: 'Hi there!' },
              ],
            },
          },
          2,
        ),
      ],
      'test.jsonl',
    )

    expect(session.conversationItems.map((item) => item.role)).toEqual([
      'user',
      'thinking',
      'assistant',
    ])
    expect(session.events).toHaveLength(2)
    expect(session.events[1]?.label).toBe('assistant (2 blocks)')
    expect(session.conversationItems[1]?.preview).toContain('greet')
  })

  it('links tool_use and tool_result by tool call id', () => {
    const toolId = 'toolu_01HnPnprMr1FrXM4pQDFVEoC'
    const session = claudeTranscriptAdapter.parse(
      [
        line({
          type: 'user',
          uuid: 'user-1',
          message: { role: 'user', content: 'Run it' },
        }),
        line(
          {
            type: 'assistant',
            uuid: 'asst-1',
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: toolId,
                  name: 'Bash',
                  input: { command: 'ls' },
                },
              ],
            },
          },
          2,
        ),
        line(
          {
            type: 'user',
            uuid: 'user-2',
            message: {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolId,
                  content: 'file.txt',
                  is_error: false,
                },
              ],
            },
          },
          3,
        ),
      ],
      'test.jsonl',
    )

    const toolCall = session.conversationItems.find((item) => item.role === 'tool_call')
    const toolResult = session.conversationItems.find((item) => item.role === 'tool_result')

    expect(toolCall?.toolCallId).toBe(toolId)
    expect(toolResult?.toolCallId).toBe(toolId)
    expect(toolResult?.preview).toContain('file.txt')
    expect(session.events[2]?.category).toBe('tool')
    expect(session.events[2]?.label).toContain('tool_result')
  })

  it('extracts requestId onto timeline events', () => {
    const requestId = 'req_011CUJh4afoeKoW8DPCaCwmz'
    const session = claudeTranscriptAdapter.parse(
      [
        line({
          type: 'user',
          uuid: 'user-1',
          message: { role: 'user', content: 'Hello' },
        }),
        line(
          {
            type: 'assistant',
            uuid: 'asst-1',
            requestId,
            message: {
              role: 'assistant',
              content: [{ type: 'text', text: 'Hi there!' }],
            },
          },
          2,
        ),
      ],
      'test.jsonl',
    )

    expect(session.events[0]?.requestId).toBeUndefined()
    expect(session.events[1]?.requestId).toBe(requestId)
  })

  it('truncates very large thinking blocks at parse time', () => {
    const longThinking = 'z'.repeat(BLOCK_TEXT_LIMIT + 500)
    const session = claudeTranscriptAdapter.parse(
      [
        line({
          type: 'user',
          uuid: 'user-1',
          message: { role: 'user', content: 'Think' },
        }),
        line(
          {
            type: 'assistant',
            uuid: 'asst-1',
            message: {
              role: 'assistant',
              content: [{ type: 'thinking', thinking: longThinking }],
            },
          },
          2,
        ),
      ],
      'test.jsonl',
    )

    const thinking = session.conversationItems.find((item) => item.role === 'thinking')
    expect(thinking?.blocks?.[0]?.text.endsWith('… [truncated]')).toBe(true)
    expect(thinking?.blocks?.[0]?.text.length).toBeLessThan(longThinking.length)
  })
})

describe('detectAndParse', () => {
  it('merges malformed line warnings into the session', () => {
    const text = `${sampleText.split('\n')[0]}\nnot valid json\n`
    const session = detectAndParse(text, 'mixed.jsonl')

    expect(session.parseWarnings).toEqual([
      { lineIndex: 2, message: 'Invalid JSON on this line' },
    ])
    expect(session.events.length).toBeGreaterThan(0)
  })

  it('rejects unrecognized formats', () => {
    expect(() => detectAndParse('{"foo":"bar"}\n', 'unknown.jsonl')).toThrow(
      /Unrecognized JSONL format/,
    )
  })
})