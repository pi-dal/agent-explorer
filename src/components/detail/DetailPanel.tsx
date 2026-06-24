import { useState, type ReactNode } from 'react'
import { useSessionStore } from '../../store/sessionStore'
import { CollapsibleJson } from './CollapsibleJson'
import { EventSummary } from './EventSummary'

export function DetailPanel() {
  const selection = useSessionStore((s) => s.selection)
  const [tab, setTab] = useState<'summary' | 'raw'>('summary')

  if (!selection) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-zinc-500">
        Select an event or conversation item
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <TabButton active={tab === 'summary'} onClick={() => setTab('summary')}>
          Summary
        </TabButton>
        <TabButton active={tab === 'raw'} onClick={() => setTab('raw')}>
          Raw JSON
        </TabButton>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {tab === 'summary' ? (
          <EventSummary selection={selection} />
        ) : (
          <CollapsibleJson value={selection.raw} />
        )}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium ${
        active
          ? 'border-b-2 border-sky-500 text-sky-600 dark:text-sky-400'
          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}