import { useState } from 'react'
import type { ConversationListItem } from '../../core/types'
import { ChevronToggle } from '../shared/ChevronToggle'
import { useRowResize } from './useRowResize'

interface ThinkingBlockProps {
  item: ConversationListItem
  selected: boolean
  onSelect: () => void
  onLayoutChange?: () => void
}

export function ThinkingBlock({
  item,
  selected,
  onSelect,
  onLayoutChange,
}: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const text = item.blocks?.[0]?.text ?? item.preview

  useRowResize(expanded, onLayoutChange)

  function toggle() {
    setExpanded((value) => !value)
  }

  return (
    <div className="px-4 py-2" onClick={onSelect}>
      <div
        className={`max-w-3xl rounded-lg transition-colors ${
          expanded ? 'w-full' : 'inline-flex w-fit max-w-full'
        } ${
          selected
            ? 'border border-sky-400 px-2.5 py-1.5 ring-1 ring-sky-400/40'
            : 'border border-transparent px-2.5 py-1.5'
        }`}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            toggle()
          }}
          className="flex w-full items-center gap-2 text-left"
        >
          <ChevronToggle
            expanded={expanded}
            className="text-zinc-400 dark:text-zinc-500"
          />
          <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">Thinking</span>
          {!expanded && (
            <span className="min-w-0 flex-1 truncate text-xs italic text-zinc-400 dark:text-zinc-500">
              {item.preview}
            </span>
          )}
        </button>
        {expanded && (
          <p className="mt-2 whitespace-pre-wrap pl-5 text-sm italic leading-relaxed text-zinc-400 dark:text-zinc-500">
            {text}
          </p>
        )}
      </div>
    </div>
  )
}