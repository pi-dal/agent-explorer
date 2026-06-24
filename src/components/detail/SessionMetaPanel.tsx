import { computeSessionStats } from '../../core/filter'
import type { ExplorerSession } from '../../core/types'
import { SummaryRow } from './SummaryRow'

export function SessionMetaPanel({ session }: { session: ExplorerSession }) {
  const stats = computeSessionStats(session)
  const { meta } = session

  const rows: Array<{ label: string; value: string }> = [
    { label: 'File', value: session.fileName },
    { label: 'Adapter', value: session.adapterId },
    { label: 'Events', value: String(meta.eventCount) },
    { label: 'Turns', value: String(meta.turnCount) },
    { label: 'Tool calls', value: String(stats.toolCallCount) },
    { label: 'Tool results', value: String(stats.toolResultCount) },
    { label: 'Thinking', value: String(stats.thinkingCount) },
  ]

  if (meta.sessionId) rows.push({ label: 'Session ID', value: meta.sessionId })
  if (meta.model) rows.push({ label: 'Model', value: meta.model })
  if (meta.cwd) rows.push({ label: 'CWD', value: meta.cwd })
  if (meta.version) rows.push({ label: 'Version', value: meta.version })
  if (session.parseWarnings.length > 0) {
    rows.push({ label: 'Warnings', value: String(session.parseWarnings.length) })
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <SummaryRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  )
}