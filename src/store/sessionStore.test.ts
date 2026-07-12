import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import type { ExplorerSession, Selection, TimelineEvent } from '../core/types'
import { restoreSelection, useSessionStore } from './sessionStore'

const sampleText = readFileSync(
  new URL('../fixtures/xiaoba-session.sample.jsonl', import.meta.url),
  'utf8',
)

afterEach(() => {
  useSessionStore.getState().clearSession()
})

function event(id: string): TimelineEvent {
  return {
    id,
    lineIndex: 1,
    category: 'assistant',
    kind: 'text',
    label: 'assistant',
    preview: id,
    raw: {},
  }
}

function session(events: TimelineEvent[]): ExplorerSession {
  return {
    fileType: 'test',
    fileName: 'test.jsonl',
    meta: { eventCount: events.length, turnCount: 1 },
    events,
    conversationItems: [],
    parseWarnings: [],
  }
}

describe('restoreSelection', () => {
  it('restores an event by stable id after a live refresh', () => {
    const before = event('line-4')
    const after = event('line-4')
    const selection: Selection = { source: 'timeline', event: before }

    expect(restoreSelection(session([after, event('line-5')]), selection)?.event).toBe(after)
  })

  it('clears a selection whose event disappeared after truncation', () => {
    const selection: Selection = { source: 'timeline', event: event('line-4') }
    expect(restoreSelection(session([event('line-1')]), selection)).toBeNull()
  })
})

describe('live file refresh', () => {
  it('retains the last valid session while the file is temporarily empty', () => {
    const store = useSessionStore.getState()
    store.loadText(sampleText, 'live.jsonl', '/tmp/live.jsonl')
    const validSession = useSessionStore.getState().session

    useSessionStore.getState().loadText('', 'live.jsonl', '/tmp/live.jsonl', {
      preserveSelection: true,
      resetFilters: false,
      retainLastValidSession: true,
    })

    expect(useSessionStore.getState().session).toBe(validSession)
    expect(useSessionStore.getState().error).toMatch(/Unrecognized JSONL format/)
  })

  it('replaces the retained snapshot after a later valid refresh', () => {
    const store = useSessionStore.getState()
    store.loadText(sampleText, 'live.jsonl', '/tmp/live.jsonl')
    const firstSession = useSessionStore.getState().session
    useSessionStore.getState().loadText('', 'live.jsonl', '/tmp/live.jsonl', {
      retainLastValidSession: true,
      resetFilters: false,
    })
    useSessionStore.getState().loadText(sampleText, 'live.jsonl', '/tmp/live.jsonl', {
      retainLastValidSession: true,
      resetFilters: false,
    })

    expect(useSessionStore.getState().session).not.toBe(firstSession)
    expect(useSessionStore.getState().error).toBeNull()
  })

  it('still clears the session for an explicitly opened invalid file', () => {
    const store = useSessionStore.getState()
    store.loadText(sampleText, 'valid.jsonl', '/tmp/valid.jsonl')
    useSessionStore.getState().loadText('', 'invalid.jsonl', '/tmp/invalid.jsonl')

    expect(useSessionStore.getState().session).toBeNull()
    expect(useSessionStore.getState().error).toMatch(/Unrecognized JSONL format/)
  })
})
