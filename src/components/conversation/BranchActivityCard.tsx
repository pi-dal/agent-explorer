import { GitBranch } from 'lucide-react'
import { useState } from 'react'
import { selectedRing } from '../../styles/uiClasses'
import type { ConversationListItem } from '../../core/types'
import { ChevronToggle } from '../shared/ChevronToggle'
import { ExpandablePre } from '../shared/ExpandablePre'
import { AnimatedExpander } from '../shared/AnimatedExpander'

export function BranchActivityCard({
  item,
  selected,
  onSelect,
}: {
  item: ConversationListItem
  selected: boolean
  onSelect: (item: ConversationListItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const activity = item.event.branchActivity
  const text = item.block?.text ?? item.event.preview
  const branch = activity ? `${activity.branchType} · ${activity.branchId}` : 'branch'
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
          <GitBranch className="shrink-0 text-role-tool" size={14} strokeWidth={1.75} aria-hidden />
          <span className={`shrink-0 font-mono text-[10px] font-medium uppercase ${selected ? 'text-primary' : 'text-tertiary'}`}>
            {item.event.label}
          </span>
          <span className="max-w-48 shrink-0 truncate font-mono text-[10px] text-tertiary">{branch}</span>
          {summary && <span className="min-w-0 flex-1 truncate text-xs text-secondary" title={summary}>{summary}</span>}
          <ChevronToggle expanded={expanded} className="text-tertiary" />
        </button>
        <AnimatedExpander expanded={expanded}>
          <ExpandablePre text={text} className="mx-1 my-1 rounded border border-separator bg-background px-3 py-2" />
        </AnimatedExpander>
      </div>
    </div>
  )
}
