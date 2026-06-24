import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  accentTabActive,
  accentTabInactive,
  emptyState,
  sectionDivider,
} from '../../styles/uiClasses'
import { useSessionStore } from '../../store/sessionStore'
import { CollapsibleJson } from './CollapsibleJson'
import { EventSummary } from './EventSummary'
import { SessionMetaPanel } from './SessionMetaPanel'

type DetailTab = 'session' | 'summary' | 'raw'

export function DetailPanel() {
  const session = useSessionStore((s) => s.session)
  const selection = useSessionStore((s) => s.selection)
  const [tab, setTab] = useState<DetailTab>('session')
  const hadSelectionRef = useRef(false)

  useEffect(() => {
    if (selection) {
      if (!hadSelectionRef.current) setTab('summary')
      hadSelectionRef.current = true
      return
    }
    hadSelectionRef.current = false
    setTab('session')
  }, [selection])

  if (!session) {
    return (
      <div className={`flex h-full items-center justify-center p-4 ${emptyState}`}>
        No session loaded
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className={`flex items-center gap-1 px-1 ${sectionDivider}`}>
        <TabButton active={tab === 'session'} onClick={() => setTab('session')}>
          Session
        </TabButton>
        <TabButton
          active={tab === 'summary'}
          onClick={() => setTab('summary')}
          disabled={!selection}
        >
          Summary
        </TabButton>
        <TabButton
          active={tab === 'raw'}
          onClick={() => setTab('raw')}
          disabled={!selection}
        >
          Raw JSON
        </TabButton>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {tab === 'session' && <SessionMetaPanel session={session} />}
        {tab === 'summary' && selection && <EventSummary selection={selection} />}
        {tab === 'raw' && selection && <CollapsibleJson value={selection.raw} />}
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
        active ? accentTabActive : accentTabInactive
      }`}
    >
      {children}
    </button>
  )
}