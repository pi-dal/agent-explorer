import { Download } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { downloadRawJson, rawExportFileName } from '../../core/exportRaw'
import { useSessionStore } from '../../store/sessionStore'
import { CollapsibleJson } from './CollapsibleJson'
import { EventSummary } from './EventSummary'
import { SessionMetaPanel } from './SessionMetaPanel'

export function DetailPanel() {
  const session = useSessionStore((s) => s.session)
  const selection = useSessionStore((s) => s.selection)
  const [tab, setTab] = useState<'summary' | 'raw'>('summary')

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-zinc-500">
        No session loaded
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Session
        </div>
        <SessionMetaPanel session={session} />
      </div>

      {selection ? (
        <>
          <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800">
            <TabButton active={tab === 'summary'} onClick={() => setTab('summary')}>
              Summary
            </TabButton>
            <TabButton active={tab === 'raw'} onClick={() => setTab('raw')}>
              Raw JSON
            </TabButton>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() =>
                downloadRawJson(selection.raw, rawExportFileName(selection.lineIndex))
              }
              className="mr-2 inline-flex h-7 items-center gap-1 rounded border border-zinc-200 px-2 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              title="Export raw JSON"
            >
              <Download size={12} strokeWidth={1.75} aria-hidden />
              Export
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3">
            {tab === 'summary' ? (
              <EventSummary selection={selection} />
            ) : (
              <CollapsibleJson value={selection.raw} />
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center p-4 text-xs text-zinc-500">
          Select an event or message to inspect details
        </div>
      )}
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