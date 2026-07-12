import { describe, expect, it } from 'vitest'
import { isLogCandidate, workspaceNameFromPaths } from './workspace'

describe('workspace log discovery', () => {
  it('accepts logs regardless of the selected directory depth', () => {
    expect(isLogCandidate('xiaoba-cli/logs/sessions/chat/2026-07-10/chat_cli.jsonl')).toBe(true)
    expect(isLogCandidate('chat/2026-07-10/chat_cli.jsonl')).toBe(true)
    expect(isLogCandidate('2026-07-10/chat_cli.jsonl')).toBe(true)
    expect(isLogCandidate('09-02-26_cli.log')).toBe(true)
    expect(isLogCandidate('prompts/system-prompt.md')).toBe(false)
  })

  it('uses the selected directory root as the workspace name', () => {
    expect(workspaceNameFromPaths(['xiaoba-cli/logs/a.jsonl'])).toBe('xiaoba-cli')
    expect(workspaceNameFromPaths(['2026-07-10/chat_cli.jsonl'])).toBe('2026-07-10')
  })
})
