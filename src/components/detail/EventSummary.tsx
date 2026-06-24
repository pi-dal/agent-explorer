import type { Selection } from '../../core/types'
import { SummaryRow } from './SummaryRow'

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}

export function EventSummary({ selection }: { selection: Selection }) {
  const record = asRecord(selection.raw)
  const rows: Array<{ label: string; value: string }> = []

  if (selection.lineIndex !== undefined) {
    rows.push({ label: 'Line', value: String(selection.lineIndex) })
  }
  rows.push({ label: 'Source', value: selection.source })

  if (record) {
    if (typeof record.type === 'string') rows.push({ label: 'Type', value: record.type })
    if (typeof record.uuid === 'string') rows.push({ label: 'UUID', value: record.uuid })
    if (typeof record.sessionId === 'string') {
      rows.push({ label: 'Session', value: record.sessionId })
    }
    if (typeof record.timestamp === 'string') {
      rows.push({ label: 'Timestamp', value: record.timestamp })
    }
    if (typeof record.cwd === 'string') rows.push({ label: 'CWD', value: record.cwd })

    const message = asRecord(record.message)
    if (message) {
      if (typeof message.model === 'string') rows.push({ label: 'Model', value: message.model })
      if (typeof message.role === 'string') rows.push({ label: 'Role', value: message.role })
      if (typeof message.stop_reason === 'string') {
        rows.push({ label: 'Stop reason', value: message.stop_reason })
      }
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