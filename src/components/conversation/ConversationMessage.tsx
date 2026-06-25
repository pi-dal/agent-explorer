import type { ConversationListItem } from '../../core/types'
import { AssistantBubble, SystemMessage, UserBubble } from './MessageBubble'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallCard } from './ToolCallCard'
import { ToolResultCard } from './ToolResultCard'

interface ConversationMessageProps {
  item: ConversationListItem
  selected: boolean
  pairHighlighted: boolean
  onSelect: (item: ConversationListItem) => void
  onHoverStart?: () => void
  onHoverEnd?: () => void
  onLayoutChange?: () => void
}

export function ConversationMessage({
  item,
  selected,
  pairHighlighted,
  onSelect,
  onHoverStart,
  onHoverEnd,
  onLayoutChange,
}: ConversationMessageProps) {
  switch (item.role) {
    case 'user':
      return <UserBubble item={item} selected={selected} onSelect={onSelect} />
    case 'assistant':
      return <AssistantBubble item={item} selected={selected} onSelect={onSelect} />
    case 'thinking':
      return (
        <ThinkingBlock
          item={item}
          selected={selected}
          onSelect={onSelect}
          onLayoutChange={onLayoutChange}
        />
      )
    case 'tool_call':
      return (
        <ToolCallCard
          item={item}
          selected={selected}
          pairHighlighted={pairHighlighted}
          onSelect={onSelect}
          onHoverStart={onHoverStart}
          onHoverEnd={onHoverEnd}
          onLayoutChange={onLayoutChange}
        />
      )
    case 'tool_result':
      return (
        <ToolResultCard
          item={item}
          selected={selected}
          pairHighlighted={pairHighlighted}
          onSelect={onSelect}
          onHoverStart={onHoverStart}
          onHoverEnd={onHoverEnd}
          onLayoutChange={onLayoutChange}
        />
      )
    case 'system':
      return <SystemMessage item={item} selected={selected} onSelect={onSelect} />
    default:
      return <AssistantBubble item={item} selected={selected} onSelect={onSelect} />
  }
}