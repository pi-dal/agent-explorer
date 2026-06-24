import { describe, expect, it } from 'vitest'
import { parseJsonlText } from './jsonl'

describe('parseJsonlText', () => {
  it('parses valid lines and skips empty lines', () => {
    const result = parseJsonlText(
      '{"a":1}\n\n{"b":2}\n',
    )

    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]).toMatchObject({ lineIndex: 1, data: { a: 1 } })
    expect(result.lines[1]).toMatchObject({ lineIndex: 3, data: { b: 2 } })
    expect(result.warnings).toEqual([])
  })

  it('records warnings for malformed JSON lines', () => {
    const result = parseJsonlText(
      '{"ok":true}\nnot json\n{"also":true}\n',
    )

    expect(result.lines).toHaveLength(2)
    expect(result.warnings).toEqual([
      { lineIndex: 2, message: 'Invalid JSON on this line' },
    ])
  })
})