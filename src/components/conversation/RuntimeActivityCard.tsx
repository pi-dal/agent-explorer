import { Activity, Cable, CircleAlert, Clock3, Gauge, ListChecks, MessageSquareText, Power, Upload, Wrench } from 'lucide-react'
import { useState } from 'react'
import { selectedRing } from '../../styles/uiClasses'
import type { ConversationListItem } from '../../core/types'
import { ChevronToggle } from '../shared/ChevronToggle'
import { ExpandablePre } from '../shared/ExpandablePre'
import { AnimatedExpander } from '../shared/AnimatedExpander'

function ActivityIcon({ phase }: { phase?: string }) {
  if (phase === 'connection') return <Cable size={14} strokeWidth={1.75} aria-hidden />
  if (phase === 'startup') return <Power size={14} strokeWidth={1.75} aria-hidden />
  if (phase === 'scheduler') return <Clock3 size={14} strokeWidth={1.75} aria-hidden />
  if (phase === 'tool_registry') return <ListChecks size={14} strokeWidth={1.75} aria-hidden />
  if (phase === 'error' || phase === 'cancelled') return <CircleAlert size={14} strokeWidth={1.75} aria-hidden />
  if (phase === 'token_usage' || phase === 'metrics') return <Gauge size={14} strokeWidth={1.75} aria-hidden />
  if (phase === 'tool_transport') return <Wrench size={14} strokeWidth={1.75} aria-hidden />
  if (phase === 'upload') return <Upload size={14} strokeWidth={1.75} aria-hidden />
  if (phase === 'assistant_text' || phase === 'final_response') return <MessageSquareText size={14} strokeWidth={1.75} aria-hidden />
  return <Activity size={14} strokeWidth={1.75} aria-hidden />
}

export function RuntimeActivityCard({
  item,
  selected,
  onSelect,
}: {
  item: ConversationListItem
  selected: boolean
  onSelect: (item: ConversationListItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const activity = item.event.runtimeActivity
  const text = item.block?.text ?? item.event.preview
  const summary = text.replace(/\s+/g, ' ').trim()

  return (
    <div className="px-4 py-1">
      <div
        className={`w-full rounded border ${selected ? selectedRing : 'border-separator'}`}
        onClick={() => { onSelect(item) }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setExpanded(value => !value)
          }}
          className="flex items-center gap-2 px-2.5 py-1.5 text-left"
        >
          <span className={`shrink-0 ${activity?.phase === 'error' || activity?.phase === 'cancelled' ? 'text-danger' : 'text-role-system'}`}>
            <ActivityIcon phase={activity?.phase} />
          </span>
          <span className={`shrink-0 font-mono text-[10px] font-medium uppercase ${selected ? 'text-primary' : 'text-tertiary'}`}>
            {item.event.label}
          </span>
          {activity?.scope && (
            <span className="max-w-36 shrink-0 truncate font-mono text-[10px] text-tertiary">
              {activity.scope}
            </span>
          )}
          {summary && (
            <span className="min-w-0 flex-1 truncate text-xs text-secondary" title={summary}>
              {summary}
            </span>
          )}
          {activity?.durationMs !== undefined && (
            <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] text-tertiary">
              <Clock3 size={11} strokeWidth={1.75} aria-hidden />
              {activity.durationMs} ms
            </span>
          )}
          <ChevronToggle expanded={expanded} className="text-tertiary" />
        </button>
        <AnimatedExpander expanded={expanded}>
          <ExpandablePre text={text} mono={false} className="mx-1 my-1 rounded border border-separator bg-background px-3 py-2" />
        </AnimatedExpander>
      </div>
    </div>
  )
}
