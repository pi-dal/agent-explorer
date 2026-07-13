import { useEffect, useState, type ReactNode } from 'react'
import {
  chipActive,
  chipInactive,
  emptyState,
  sectionDivider,
} from '../../styles/uiClasses'
import { useSessionStore } from '../../store/sessionStore'
import { CollapsibleJson } from './CollapsibleJson'
import { EventSummary } from './EventSummary'
import { SessionMetaPanel } from './SessionMetaPanel'
import { UsagePanel } from './UsagePanel'
import { XiaoBaExecutionPanel } from './XiaoBaExecutionPanel'
import { isXiaoBaSession } from '../../core/xiaoba'

type DetailTab = 'session' | 'execution' | 'summary' | 'usage' | 'raw'

export function DetailPanel() {
  const session = useSessionStore((s) => s.session)
  const selection = useSessionStore((s) => s.selection)
  const [lastSelectedEventId, setLastSelectedEventId] = useState<string | undefined>(undefined)
  const [tab, setTab] = useState<DetailTab>('session')

  const selectedEventId = selection?.event?.id
  const hasEvent = !!(selection?.event)
  const hasUsage = !!(selection?.event?.usage)
  const hasExecution = isXiaoBaSession(session) && hasEvent

  // FIXME: we don't need these `useEffect` hooks maybe.
  useEffect(() => {
    setLastSelectedEventId(selectedEventId)
    if (hasEvent) {
      if (tab === 'session' && lastSelectedEventId !== selectedEventId) {
        setTab(hasExecution ? 'execution' : 'summary');
      }
    } else {
      if (tab === 'execution' || tab === 'summary' || tab === 'raw') {
        setTab('session')
      }
    }
  }, [lastSelectedEventId, setLastSelectedEventId, tab, selectedEventId, hasEvent, hasExecution])

  useEffect(() => {
    if (tab === 'usage' && !hasUsage) {
      if (hasEvent) {
        setTab('summary')
      } else {
        setTab('session')
      }
    }
  }, [tab, hasEvent, hasUsage])

  if (!session) {
    return (
      <div className={`flex h-full items-center justify-center p-4 ${emptyState}`}>
        No session loaded
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className={`flex items-center gap-1 px-1 ${sectionDivider}`}>
        <TabButton active={tab === 'session'} onClick={() => setTab('session')}>
          Session
        </TabButton>
        {isXiaoBaSession(session) && (
          <TabButton
            active={tab === 'execution'}
            onClick={() => setTab('execution')}
            disabled={!hasExecution}
          >
            Execution
          </TabButton>
        )}
        <TabButton
          active={tab === 'summary'}
          onClick={() => setTab('summary')}
          disabled={!hasEvent}
        >
          Summary
        </TabButton>
        <TabButton
          active={tab === 'usage'}
          onClick={() => setTab('usage')}
          disabled={!hasUsage}
        >
          Usage
        </TabButton>
        <TabButton
          active={tab === 'raw'}
          onClick={() => setTab('raw')}
          disabled={!hasEvent}
        >
          Raw JSON
        </TabButton>
      </div>
      <div data-testid="detail-scroll" className="min-h-0 flex-1 overflow-auto overscroll-contain p-3">
        {tab === 'session' && <SessionMetaPanel session={session} />}
        {tab === 'execution' && hasExecution && selection?.event && (
          <XiaoBaExecutionPanel event={selection.event} />
        )}
        {tab === 'summary' && hasEvent && <EventSummary selection={selection} />}
        {tab === 'usage' && hasUsage && <UsagePanel selection={selection} />}
        {tab === 'raw' && selection?.event && <CollapsibleJson value={selection.event.raw} />}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`my-1 rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? chipActive : chipInactive
      }`}
    >
      {children}
    </button>
  )
}
