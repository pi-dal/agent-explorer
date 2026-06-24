import { useState } from 'react'
import { accentSelectedRing, textFaint } from '../../styles/uiClasses'
import type { ConversationListItem } from '../../core/types'
import { ChevronToggle } from '../shared/ChevronToggle'
import { ExpandablePre } from '../shared/ExpandablePre'
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
        className={`max-w-3xl rounded-lg ${
          expanded ? 'w-full' : 'inline-flex w-fit max-w-full'
        } ${
          selected
            ? `border px-2.5 py-1.5 ${accentSelectedRing}`
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
          <ChevronToggle expanded={expanded} className={textFaint} />
          <span className={`text-xs font-medium ${textFaint}`}>Thinking</span>
          {!expanded && (
            <span className={`min-w-0 flex-1 truncate text-xs italic ${textFaint}`}>
              {item.preview}
            </span>
          )}
        </button>
        {expanded && (
          <ExpandablePre
            text={text}
            mono={false}
            className={`mt-2 pl-5 text-sm italic ${textFaint}`}
          />
        )}
      </div>
    </div>
  )
}