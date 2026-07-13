import { GitBranch } from 'lucide-react'
import { useState } from 'react'
import { selectedRing } from '../../styles/uiClasses'
import type { ConversationListItem } from '../../core/types'
import { ChevronToggle } from '../shared/ChevronToggle'
import { ExpandablePre } from '../shared/ExpandablePre'
import { AnimatedExpander } from '../shared/AnimatedExpander'

function summary(text: string): string {
  return text.split('\n').find(Boolean) ?? text
}

export function BranchEventCard({
  item,
  selected,
  onSelect,
}: {
  item: ConversationListItem
  selected: boolean
  onSelect: (item: ConversationListItem) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const branch = item.event.branchEvent
  const text = item.block?.text ?? item.event.preview

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
          className="flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left"
        >
          <GitBranch size={14} strokeWidth={1.75} className="shrink-0 text-role-tool" aria-hidden />
          <span className="shrink-0 font-mono text-[10px] font-medium uppercase text-tertiary">
            {branch?.branchType ?? 'Branch'} · {branch?.eventType ?? item.event.label}
          </span>
          {branch?.branchId && (
            <span className="min-w-0 truncate font-mono text-[10px] text-tertiary">
              {branch.branchId}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-secondary">
            {summary(text)}
          </span>
          <ChevronToggle expanded={expanded} className="shrink-0 text-tertiary" />
        </button>
        <AnimatedExpander expanded={expanded}>
          <ExpandablePre text={text} className="mx-1 mb-1 rounded border border-separator bg-background px-3 py-2" />
        </AnimatedExpander>
      </div>
    </div>
  )
}
