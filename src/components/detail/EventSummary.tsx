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

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <SummaryRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  )
}