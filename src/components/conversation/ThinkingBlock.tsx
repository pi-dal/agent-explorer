import { useState } from 'react'
import { selectedRing } from '../../styles/uiClasses'
import type { ConversationListItem } from '../../core/types'
import { ChevronToggle } from '../shared/ChevronToggle'
import { ExpandablePre } from '../shared/ExpandablePre'
import { useRowResize } from './useRowResize'

interface ThinkingBlockProps {
  item: ConversationListItem
  selected: boolean
  onSelect: (item: ConversationListItem) => void
  onLayoutChange?: () => void
}

export function ThinkingBlock({
  item,
  selected,
  onSelect,
  onLayoutChange,
}: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const text = item.block?.text ?? item.event.preview

  useRowResize(expanded, onLayoutChange)

  function toggle() {
    setExpanded((value) => !value)
  }

  return (
    <div className="px-4" onClick={() => { onSelect(item) }}>
      <div
        className={`rounded-lg px-2 py-1 w-fit ${
          selected
            ? `border ${selectedRing}`
            : 'border border-transparent'
        }`}
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            toggle()
          }}
          className="flex w-full items-center gap-1 text-left"
        >
          <span className="text-xs font-medium text-faint">Thinking</span>
          <ChevronToggle expanded={expanded} className="text-faint" />
        </button>
        {expanded && (
          <ExpandablePre
            text={text}
            mono={false}
            className="mt-2 text-sm italic text-faint"
          />
        )}
      </div>
    </div>
  )
}
