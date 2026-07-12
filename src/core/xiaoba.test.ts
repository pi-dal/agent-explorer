import { describe, expect, it } from 'vitest'
import type { TimelineEvent } from './types'
import {
  countXiaoBaTimelineScopes,
  filterXiaoBaTimeline,
  xiaobaTimelineScope,
  resolveXiaoBaPromptResources,
  isXiaoBaSession,
} from './xiaoba'

function event(kind: string, lineIndex: number): TimelineEvent {
  return {
    id: `line-${lineIndex}`,
    lineIndex,
    category: 'meta',
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
    event('runtime', 3),
    event('prompt_trace', 4),
    event('subagent_event', 5),
  ]

  it('classifies execution records into workflow-oriented scopes', () => {
    expect(events.map(xiaobaTimelineScope)).toEqual([
      'workflow',
      'workflow',
      'runtime',
      'prompt',
      'subagent',
    ])
  })

  it('filters and counts scopes consistently', () => {
    expect(filterXiaoBaTimeline(events, 'workflow')).toHaveLength(2)
    expect(filterXiaoBaTimeline(events, 'runtime')).toEqual([events[2]])
    expect(countXiaoBaTimelineScopes(events)).toEqual({
      all: 5,
      workflow: 2,
      runtime: 1,
      prompt: 1,
      subagent: 1,
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
