import { computeSessionStats } from '../../core/filter'
import type { ExplorerSession } from '../../core/types'
import { SummaryRow } from './SummaryRow'

export function SessionMetaPanel({ session }: { session: ExplorerSession }) {
  const stats = computeSessionStats(session)
  const { meta } = session

  const rows: Array<{ label: string; value: string }> = [
    { label: 'File', value: session.fileName },
    { label: 'File type', value: session.fileType },
    { label: 'Events', value: String(meta.eventCount) },
    { label: 'Turns', value: String(meta.turnCount) },
    { label: 'Tool calls', value: String(stats.toolCallCount) },
    { label: 'Tool results', value: String(stats.toolResultCount) },
    { label: 'Thinking', value: String(stats.thinkingCount) },
  ]

  if (session.sourcePath && session.sourcePath !== session.fileName) {
    rows.splice(1, 0, { label: 'Source path', value: session.sourcePath })
  }

  if (meta.sessionId) rows.push({ label: 'Session ID', value: meta.sessionId })
  if (meta.model) rows.push({ label: 'Model', value: meta.model })
  if (meta.cwd) rows.push({ label: 'CWD', value: meta.cwd })
  if (meta.version) rows.push({ label: 'Version', value: meta.version })
  if (session.parseWarnings.length > 0) {
    rows.push({ label: 'Warnings', value: String(session.parseWarnings.length) })
  }

  if (session.fileType === 'XiaoBa') {
    const runtimeEvents = session.events.filter(event => event.kind === 'runtime').length
    const promptEvents = session.events.filter(event => event.kind === 'prompt_trace').length
    const subagentEvents = session.events.filter(event => event.kind === 'subagent_event').length
    const inputTokens = session.events.reduce(
      (total, event) => total + (event.usage?.inputTokens ?? 0),
      0,
    )
    const outputTokens = session.events.reduce(
      (total, event) => total + (event.usage?.outputTokens ?? 0),
      0,
    )
    rows.push(
      { label: 'Runtime events', value: runtimeEvents.toLocaleString() },
      { label: 'Prompt snapshots', value: promptEvents.toLocaleString() },
      { label: 'Subagent events', value: subagentEvents.toLocaleString() },
    )
    if (inputTokens > 0 || outputTokens > 0) {
      rows.push(
        { label: 'Input tokens', value: inputTokens.toLocaleString() },
        { label: 'Output tokens', value: outputTokens.toLocaleString() },
      )
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
