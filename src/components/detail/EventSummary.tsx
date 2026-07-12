import type { Selection } from '../../core/types'
import { SummaryRow } from './SummaryRow'

export function EventSummary({ selection }: { selection: Selection }) {
  const { event } = selection
  if (!event) {
    return null;
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Line', value: String(event.lineIndex) },
    { label: 'Type', value: event.kind },
  ]

  if (event.uuid) rows.push({ label: 'UUID', value: event.uuid })
  if (event.requestId) rows.push({ label: 'Request ID', value: event.requestId })
  if (event.sessionId) rows.push({ label: 'Session', value: event.sessionId })
  if (event.timestampLabel) rows.push({ label: 'Timestamp', value: event.timestampLabel })
  if (event.cwd) rows.push({ label: 'CWD', value: event.cwd })
  if (event.model) rows.push({ label: 'Model', value: event.model })
  if (event.role) rows.push({ label: 'Role', value: event.role })
  if (event.stopReason) rows.push({ label: 'Stop reason', value: event.stopReason })

  if (event.raw && typeof event.raw === 'object' && !Array.isArray(event.raw)) {
    const raw = event.raw as Record<string, unknown>
    if (typeof raw.session_type === 'string') {
      rows.push({ label: 'Session type', value: raw.session_type })
    }
    if (typeof raw.turn === 'number') rows.push({ label: 'Turn', value: String(raw.turn) })
    if (typeof raw.level === 'string') rows.push({ label: 'Level', value: raw.level })
    if (typeof raw.scope === 'string') rows.push({ label: 'Scope', value: raw.scope })
    if (typeof raw.branch_type === 'string') rows.push({ label: 'Branch type', value: raw.branch_type })
    if (typeof raw.event_type === 'string') rows.push({ label: 'Event type', value: raw.event_type })
    if (typeof raw.round === 'number') rows.push({ label: 'Round', value: String(raw.round) })
    if (typeof raw.__episodeInputKind === 'string') {
      rows.push({ label: 'Input kind', value: raw.__episodeInputKind })
    }
    if (raw.subagent && typeof raw.subagent === 'object' && !Array.isArray(raw.subagent)) {
      const subagent = raw.subagent as Record<string, unknown>
      if (typeof subagent.id === 'string') rows.push({ label: 'Subagent', value: subagent.id })
      if (typeof subagent.status === 'string') rows.push({ label: 'Status', value: subagent.status })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <SummaryRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  )
}
