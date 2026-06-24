import { Wrench } from 'lucide-react'
import { useState } from 'react'
import {
  surfaceCard,
  textFaint,
  textMono,
  textMonoMuted,
  textMuted,
} from '../../styles/uiClasses'
import type { ConversationListItem } from '../../core/types'
import { ChevronToggle } from '../shared/ChevronToggle'
import { ExpandablePre } from '../shared/ExpandablePre'
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
        className={`${surfaceCard} ${
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
          <ChevronToggle expanded={expanded} className={textFaint} />
          <Wrench
            className={`shrink-0 ${textMuted}`}
            size={14}
            strokeWidth={1.75}
            aria-hidden
          />
          <span className={`text-sm font-medium ${textMono}`}>{toolName}</span>
          {shortId && <span className={`text-[10px] ${textMonoMuted}`}>{shortId}</span>}
        </button>
        {expanded && <ExpandablePre text={inputText} className="border-t border-border" />}
      </div>
    </div>
  )
}