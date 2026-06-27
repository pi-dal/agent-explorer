import { CircleCheck, CircleX } from 'lucide-react'
import { useState } from 'react'
import { surfaceCard } from '../../styles/uiClasses'
import type { ConversationListItem } from '../../core/types'
import { ChevronToggle } from '../shared/ChevronToggle'
import { ExpandablePre } from '../shared/ExpandablePre'
import { shortToolId } from './toolCardUtils'
import { toolCardBorderClass } from './toolCardStyles'
import { useRowResize } from './useRowResize'

interface ToolResultCardProps {
  item: ConversationListItem
  selected: boolean
  pairHighlighted: boolean
  onSelect: (item: ConversationListItem) => void
  onHoverStart?: () => void
  onHoverEnd?: () => void
  onLayoutChange?: () => void
}

export function ToolResultCard({
  item,
  selected,
  pairHighlighted,
  onSelect,
  onHoverStart,
  onHoverEnd,
  onLayoutChange,
}: ToolResultCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isFailed = item?.block?.status === 'failed'
  const text = item.block?.text ?? item.event.preview
  const shortId = shortToolId(item?.block?.toolCallId)

  useRowResize(expanded, onLayoutChange)

  function toggle() {
    setExpanded((value) => !value)
  }

  return (
    <div
      className="px-4 py-1.5"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <div
        className={`${surfaceCard} ${
          expanded ? 'max-w-2xl' : 'inline-flex w-fit max-w-full'
        } ${toolCardBorderClass({ selected, pairHighlighted, isFailed })}`}
        onClick={() => { onSelect(item) }}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            toggle()
          }}
          className={`flex items-center gap-2 text-left ${
            expanded ? 'w-full px-3 py-2' : 'px-2.5 py-1.5'
          }`}
        >
          <ChevronToggle expanded={expanded} className="text-faint" />
          {isFailed ? (
            <CircleX
              className="shrink-0 text-danger"
              size={14}
              strokeWidth={1.75}
              aria-hidden
            />
          ) : (
            <CircleCheck
              className="shrink-0 text-success"
              size={14}
              strokeWidth={1.75}
              aria-hidden
            />
          )}
          <span className="text-sm font-medium text-muted-foreground">Result</span>
          {shortId && <span className="text-[10px] font-mono text-faint">{shortId}</span>}
        </button>
        {expanded && <ExpandablePre text={text} className="border-t border-border" />}
      </div>
    </div>
  )
}
