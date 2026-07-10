import { useState } from 'react'
import { selectedRing } from '../../styles/uiClasses'
import type { ConversationListItem } from '../../core/types'
import { ChevronToggle } from '../shared/ChevronToggle'
import { ExpandablePre } from '../shared/ExpandablePre'
import { AnimatedExpander } from '../shared/AnimatedExpander'

interface ThinkingBlockProps {
  item: ConversationListItem
  selected: boolean
  onSelect: (item: ConversationListItem) => void
}

export function ThinkingBlock({
  item,
  selected,
  onSelect,
}: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const text = item.block?.text ?? item.event.preview

  function toggle() {
    setExpanded((value) => !value)
  }

  return (
    <div className="px-4" onClick={() => { onSelect(item) }}>
      <div
        className={`flex flex-col rounded-lg px-2 py-1 w-fit ${
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
          <span className="text-xs font-medium text-tertiary">Thinking</span>
          <ChevronToggle expanded={expanded} className="text-tertiary" />
        </button>
        <AnimatedExpander expanded={expanded}>
          <ExpandablePre
            text={text}
            mono={false}
            className="mt-2 text-sm italic text-tertiary"
          />
        </AnimatedExpander>
      </div>
    </div>
  )
}
