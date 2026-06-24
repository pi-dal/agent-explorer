import { CircleCheck, CircleX } from 'lucide-react'
import { useState } from 'react'
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
  onSelect: () => void
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
  const isFailed = item.status === 'failed'
  const text = item.blocks?.[0]?.text ?? item.preview
  const shortId = shortToolId(item.toolCallId)

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
        className={`rounded-lg border bg-zinc-50 transition-colors dark:bg-zinc-900/50 ${
          expanded ? 'max-w-2xl' : 'inline-flex w-fit max-w-full'
        } ${toolCardBorderClass({ selected, pairHighlighted, isFailed })}`}
        onClick={onSelect}
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
          <ChevronToggle expanded={expanded} className="text-zinc-400" />
          {isFailed ? (
            <CircleX
              className="shrink-0 text-red-500 dark:text-red-400"
              size={14}
              strokeWidth={1.75}
              aria-hidden
            />
          ) : (
            <CircleCheck
              className="shrink-0 text-emerald-600 dark:text-emerald-400"
              size={14}
              strokeWidth={1.75}
              aria-hidden
            />
          )}
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Result
          </span>
          {shortId && (
            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              {shortId}
            </span>
          )}
        </button>
        {expanded && (
          <ExpandablePre
            text={text}
            className="border-t border-zinc-200 dark:border-zinc-700"
          />
        )}
      </div>
    </div>
  )
}