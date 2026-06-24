import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { detectAndParse } from '../core/registry'
import { parseJsonlText } from '../core/jsonl'
import { codexRolloutAdapter } from './codex-rollout'

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '../fixtures')
const sampleText = readFileSync(join(fixtureDir, 'codex-rollout.sample.jsonl'), 'utf8')
const largeSamplePath =
  '/Users/cyandev/Downloads/ktiays-codex-2026/04/03/rollout-2026-04-03T13-30-19-019d51d2-2328-7f31-b4dd-812ff6a13aae.jsonl'

function line(data: Record<string, unknown>, lineIndex = 1) {
  return {
    lineIndex,
    raw: JSON.stringify(data),
    data,
  }
}

describe('codexRolloutAdapter.detect', () => {
  it('returns high confidence for Codex rollout samples', () => {
    const { lines } = parseJsonlText(sampleText)
    expect(codexRolloutAdapter.detect(lines)).toBe(1)
  })

  it('returns zero for Claude transcript samples', () => {
    const claudeSample = readFileSync(
      join(fixtureDir, 'claude-transcript.sample.jsonl'),
      'utf8',
    )
    const { lines } = parseJsonlText(claudeSample)
    expect(codexRolloutAdapter.detect(lines)).toBe(0)
  })
})

describe('codexRolloutAdapter.parse', () => {
  it('parses session metadata and turn context from the guardian sample', () => {
    const { lines } = parseJsonlText(sampleText)
    const session = codexRolloutAdapter.parse(lines, 'guardian.jsonl')

    expect(session.fileType).toBe('Codex')
    expect(session.meta.sessionId).toBe('019e9d2d-3639-75b2-b26e-be6650102fea')
    expect(session.meta.cwd).toContain('youdesktop')
    expect(session.meta.version).toBe('0.137.0-alpha.4')
    expect(session.meta.model).toBe('codex-auto-review')
    expect(session.meta.turnCount).toBe(1)
    expect(session.events).toHaveLength(12)
  })

  it('maps response_item messages and reasoning into conversation items', () => {
    const session = codexRolloutAdapter.parse(
      [
        line({
          timestamp: '2026-06-06T13:44:06.581Z',
          type: 'event_msg',
          payload: {
            type: 'task_started',
            turn_id: 'turn-1',
          },
        }),
        line(
          {
            timestamp: '2026-06-06T13:44:07.964Z',
            type: 'response_item',
            payload: {
              type: 'message',
              role: 'user',
              content: [{ type: 'input_text', text: 'Archive tracked files only' }],
            },
          },
          2,
        ),
        line(
          {
            timestamp: '2026-06-06T13:44:12.824Z',
            type: 'response_item',
            payload: {
              type: 'reasoning',
              summary: [{ text: 'Assess archive risk as low.' }],
            },
          },
          3,
        ),
        line(
          {
            timestamp: '2026-06-06T13:44:13.027Z',
            type: 'response_item',
            payload: {
              type: 'message',
              role: 'assistant',
              content: [{ type: 'output_text', text: '{"outcome":"allow"}' }],
            },
          },
          4,
        ),
      ],
      'mini.jsonl',
    )

    expect(session.conversationItems.map((item) => item.role)).toEqual([
      'user',
      'thinking',
      'assistant',
    ])
    expect(session.events[2]?.category).toBe('thinking')
    expect(session.conversationItems[0]?.preview).toContain('Archive tracked files')
  })

  it('links function_call and function_call_output by call id', () => {
    const callId = 'call_rdg6jvibCi1HZNzPAIISkZC9'
    const session = codexRolloutAdapter.parse(
      [
        line({
          timestamp: '2026-04-03T13:30:19.000Z',
          type: 'event_msg',
          payload: { type: 'task_started', turn_id: 'turn-1' },
        }),
        line(
          {
            timestamp: '2026-04-03T13:30:20.000Z',
            type: 'response_item',
            payload: {
              type: 'function_call',
              name: 'exec_command',
              arguments: JSON.stringify({ cmd: 'rg --files' }),
              call_id: callId,
            },
          },
          2,
        ),
        line(
          {
            timestamp: '2026-04-03T13:30:21.000Z',
            type: 'response_item',
            payload: {
              type: 'function_call_output',
              call_id: callId,
              output: 'file.txt\n',
            },
          },
          3,
        ),
      ],
      'tools.jsonl',
    )

    const toolCall = session.conversationItems.find((item) => item.role === 'tool_call')
    const toolResult = session.conversationItems.find((item) => item.role === 'tool_result')

    expect(toolCall?.toolCallId).toBe(callId)
    expect(toolCall?.blocks?.[0]?.toolName).toBe('exec_command')
    expect(toolResult?.toolCallId).toBe(callId)
    expect(toolResult?.preview).toContain('file.txt')
    expect(session.events[1]?.label).toBe('tool_use exec_command')
    expect(session.events[2]?.category).toBe('tool')
  })

  it('parses a real rollout file with custom tool calls when available locally', () => {
    try {
      readFileSync(largeSamplePath, 'utf8')
    } catch {
      return
    }

    const text = readFileSync(largeSamplePath, 'utf8')
    const session = detectAndParse(text, 'rollout.jsonl')

    expect(session.fileType).toBe('Codex')
    expect(session.meta.turnCount).toBeGreaterThanOrEqual(2)
    expect(session.conversationItems.some((item) => item.role === 'tool_call')).toBe(true)
    expect(session.conversationItems.some((item) => item.role === 'tool_result')).toBe(true)
    expect(session.conversationItems.some((item) => item.role === 'thinking')).toBe(true)
  })
})

describe('detectAndParse with Codex rollout', () => {
  it('selects the Codex adapter for rollout files', () => {
    const session = detectAndParse(sampleText, 'rollout.jsonl')
    expect(session.fileType).toBe('Codex')
    expect(session.events.length).toBeGreaterThan(0)
  })
})