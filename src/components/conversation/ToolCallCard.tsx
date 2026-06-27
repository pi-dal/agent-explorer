import { CircleCheck, CircleX, Wrench } from 'lucide-react'
import { useState } from 'react'
import { selectedRing } from '../../styles/uiClasses'
import type { ConversationListItem } from '../../core/types'
import { ChevronToggle } from '../shared/ChevronToggle'
import { ExpandablePre } from '../shared/ExpandablePre'
import { useRowResize } from './useRowResize'

interface ToolCallCardProps {
  item: ConversationListItem
  selected: boolean
  pairHighlighted: boolean
  onSelect: (item: ConversationListItem) => void
  onHoverStart?: () => void
  onHoverEnd?: () => void
  onLayoutChange?: () => void
}

function shortToolId(id?: string): string | null {
  if (!id) return null
  if (id.length <= 64) return id
  return `${id.slice(0, 64)}…`
}

export function ToolCallCard({
  item,
  selected,
  pairHighlighted,
  onSelect,
  onLayoutChange,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const block = item.block
  const toolName = block?.toolName ?? 'tool'
  const text = block?.text ?? item.event.preview
  const status = block?.status
  const isResult = item.role === 'tool_result'
  const shortId = shortToolId(block?.toolCallId)

  useRowResize(expanded, onLayoutChange)

  function toggle() {
    setExpanded((value) => !value)
  }

  return (
    <div className="px-4">
      <div
        className={`rounded-lg border w-fit ${
          selected ? selectedRing : 'border-transparent'
        }`}
        onClick={() => { onSelect(item) }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            toggle()
          }}
          className={`flex items-center gap-2 text-left px-2.5 py-1.5`}
        >
          {status === "completed" ? (
            <CircleCheck
              className="shrink-0 text-success"
              size={14}
              strokeWidth={1.75}
              aria-hidden
            />
          ) : status === "failed" ? (
            <CircleX
              className="shrink-0 text-danger"
              size={14}
              strokeWidth={1.75}
              aria-hidden
            />
          ) : (
            <Wrench
              className="shrink-0 text-muted-foreground"
              size={14}
              strokeWidth={1.75}
              aria-hidden
            />
          )}
          <span
            className={`text-xs font-medium font-mono ${
              pairHighlighted ? 'text-body' : 'text-faint'
            }`}
          >
            {isResult ? 'Result' : toolName}
          </span>
          {shortId && <span className="text-xs font-mono text-faint">({shortId})</span>}
          <ChevronToggle expanded={expanded} className="text-faint" />
        </button>
        {expanded && <ExpandablePre text={text} className="rounded bg-surface mx-1 my-1 px-3 py-2 border border-border" />}
      </div>
    </div>
  )
}
