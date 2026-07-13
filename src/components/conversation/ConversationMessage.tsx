import type { ConversationListItem } from '../../core/types'
import { AssistantBubble, SystemMessage, UserBubble } from './MessageBubble'
import { ThinkingBlock } from './ThinkingBlock'
import { BranchActivityCard } from './BranchActivityCard'
import { BranchEventCard } from './BranchEventCard'
import { RuntimeActivityCard } from './RuntimeActivityCard'
import { ToolCallCard } from './ToolCallCard'

interface ConversationMessageProps {
  item: ConversationListItem
  selected: boolean
  pairHighlighted: boolean
  onSelect: (item: ConversationListItem) => void
}

export function ConversationMessage({
  item,
  selected,
  pairHighlighted,
  onSelect,
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
        />
      )
    case 'branch_activity':
      return <BranchActivityCard item={item} selected={selected} onSelect={onSelect} />
    case 'branch_event':
      return <BranchEventCard item={item} selected={selected} onSelect={onSelect} />
    case 'runtime_activity':
      return <RuntimeActivityCard item={item} selected={selected} onSelect={onSelect} />
    case 'tool_call':
    case 'tool_result':
      return (
        <ToolCallCard
          item={item}
          selected={selected}
          pairHighlighted={pairHighlighted}
          onSelect={onSelect}
        />
      )
    case 'system':
      return <SystemMessage item={item} selected={selected} onSelect={onSelect} />
    default:
      return <AssistantBubble item={item} selected={selected} onSelect={onSelect} />
  }
}
