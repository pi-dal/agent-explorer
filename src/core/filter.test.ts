import { describe, expect, it } from 'vitest'
import type { ConversationListItem, TimelineEvent } from './types'
import { filterConversationItems, filterTimelineEvents } from './filter'

const baseEvent = (overrides: Partial<TimelineEvent>): TimelineEvent => ({
  id: 'line-1',
  lineIndex: 1,
  category: 'user',
  kind: 'user',
  label: 'user',
  preview: '',
  raw: {},
  ...overrides,
})

function conversationItem(
  event: TimelineEvent,
  overrides: Pick<ConversationListItem, 'id' | 'role'> &
    Partial<Pick<ConversationListItem, 'block'>>,
): ConversationListItem {
  return { event, ...overrides }
}

describe('filterTimelineEvents', () => {
  const events = [
    baseEvent({ id: 'e1', category: 'user', label: 'user', preview: 'mkdir folder' }),
    baseEvent({
      id: 'e2',
      lineIndex: 2,
      category: 'meta',
      kind: 'file-history-snapshot',
      label: 'file-history-snapshot',
      preview: '',
    }),
    baseEvent({
      id: 'e3',
      lineIndex: 3,
      category: 'tool',
      kind: 'user',
      label: 'tool_result abc',
      preview: 'done',
    }),
  ]

  it('filters by search query', () => {
    const result = filterTimelineEvents(events, {
      searchQuery: 'mkdir',
      timelineCategoryFilter: 'all',
      hideSystem: false,
      hideToolCalls: false,
    })
    expect(result.map((event) => event.id)).toEqual(['e1'])
  })

  it('filters by category', () => {
    const result = filterTimelineEvents(events, {
      searchQuery: '',
      timelineCategoryFilter: 'tool',
      hideSystem: false,
      hideToolCalls: false,
    })
    expect(result.map((event) => event.id)).toEqual(['e3'])
  })

  it('hides meta/system categories when hideSystem is enabled', () => {
    const result = filterTimelineEvents(events, {
      searchQuery: '',
      timelineCategoryFilter: 'all',
      hideSystem: true,
      hideToolCalls: false,
    })
    expect(result.map((event) => event.id)).toEqual(['e1', 'e3'])
  })

  it('hides tool events when hideToolCalls is enabled', () => {
    const toolEvents = [
      ...events,
      baseEvent({
        id: 'e4',
        lineIndex: 4,
        category: 'assistant',
        label: 'tool_use Bash',
        preview: 'mkdir foo',
      }),
    ]
    const result = filterTimelineEvents(toolEvents, {
      searchQuery: '',
      timelineCategoryFilter: 'all',
      hideSystem: false,
      hideToolCalls: true,
    })
    expect(result.map((event) => event.id)).toEqual(['e1', 'e2'])
  })
})

describe('filterConversationItems', () => {
  const userEvent = baseEvent({ id: 'line-1', preview: 'Create folder', turnIndex: 1 })
  const thinkingEvent = baseEvent({
    id: 'line-2',
    lineIndex: 2,
    category: 'thinking',
    kind: 'assistant',
    label: 'thinking',
    preview: 'planning next step',
    turnIndex: 1,
  })
  const systemEvent = baseEvent({
    id: 'line-3',
    lineIndex: 3,
    category: 'system',
    kind: 'message',
    label: 'system',
    preview: 'system notice',
    turnIndex: 1,
  })
  const toolCallEvent = baseEvent({
    id: 'line-4',
    lineIndex: 4,
    category: 'tool',
    kind: 'tool_use',
    label: 'tool_use Bash',
    preview: 'Bash: ls',
    turnIndex: 1,
  })
  const toolResultEvent = baseEvent({
    id: 'line-5',
    lineIndex: 5,
    category: 'tool',
    kind: 'tool_result',
    label: 'tool_result',
    preview: 'done',
    turnIndex: 1,
  })

  const items = [
    conversationItem(userEvent, { id: 'i1', role: 'user' }),
    conversationItem(thinkingEvent, {
      id: 'i2',
      role: 'thinking',
      block: { type: 'thinking', text: 'planning next step' },
    }),
    conversationItem(systemEvent, { id: 'i3', role: 'system' }),
    conversationItem(toolCallEvent, {
      id: 'i4',
      role: 'tool_call',
      block: { type: 'tool_use', text: 'ls', toolName: 'Bash' },
    }),
    conversationItem(toolResultEvent, {
      id: 'i5',
      role: 'tool_result',
      block: { type: 'text', text: 'done' },
    }),
  ]

  it('filters by search query', () => {
    const result = filterConversationItems(items, {
      searchQuery: 'planning',
      hideSystem: false,
      hideThinking: false,
      hideToolCalls: false,
    })
    expect(result.map((item) => item.id)).toEqual(['i2'])
  })

  it('hides thinking when enabled', () => {
    const result = filterConversationItems(items, {
      searchQuery: '',
      hideSystem: false,
      hideThinking: true,
      hideToolCalls: false,
    })
    expect(result.map((item) => item.id)).toEqual(['i1', 'i3', 'i4', 'i5'])
  })

  it('hides system messages when enabled', () => {
    const result = filterConversationItems(items, {
      searchQuery: '',
      hideSystem: true,
      hideThinking: false,
      hideToolCalls: false,
    })
    expect(result.map((item) => item.id)).toEqual(['i1', 'i2', 'i4', 'i5'])
  })

  it('hides tool call items when enabled', () => {
    const result = filterConversationItems(items, {
      searchQuery: '',
      hideSystem: false,
      hideThinking: false,
      hideToolCalls: true,
    })
    expect(result.map((item) => item.id)).toEqual(['i1', 'i2', 'i3'])
  })
})