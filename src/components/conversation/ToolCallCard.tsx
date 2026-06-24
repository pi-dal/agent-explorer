import { Wrench } from 'lucide-react'
import { useState } from 'react'
import type { ConversationListItem } from '../../core/types'
import { ChevronToggle } from '../shared/ChevronToggle'
import { shortToolId } from './toolCardUtils'
import { toolCardBorderClass } from './toolCardStyles'
import { useRowResize } from './useRowResize'

interface ToolCallCardProps {
  item: ConversationListItem
  selected: boolean
  pairHighlighted: boolean
  onSelect: () => void
  onHoverStart?: () => void
  onHoverEnd?: () => void
  onLayoutChange?: () => void
}

export function ToolCallCard({
  item,
  selected,
  pairHighlighted,
  onSelect,
  onHoverStart,
  onHoverEnd,
  onLayoutChange,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const block = item.blocks?.[0]
  const toolName = block?.toolName ?? 'tool'
  const inputText = block?.text ?? item.preview
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
        } ${toolCardBorderClass({ selected, pairHighlighted })}`}
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
          <Wrench
            className="shrink-0 text-zinc-500 dark:text-zinc-400"
            size={14}
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="font-mono text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {toolName}
          </span>
          {shortId && (
            <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
              {shortId}
            </span>
          )}
        </button>
        {expanded && (
          <pre className="max-h-64 overflow-auto border-t border-zinc-200 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            {inputText}
          </pre>
        )}
      </div>
    </div>
  )
}