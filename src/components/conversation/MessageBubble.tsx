import { selectedRing } from '../../styles/uiClasses'
import type { ConversationListItem } from '../../core/types'

interface MessageBubbleProps {
  item: ConversationListItem
  selected: boolean
  onSelect: (item: ConversationListItem) => void
}

export function UserBubble({ item, selected, onSelect }: MessageBubbleProps) {
  const text = item.block?.text ?? item.event.preview

  return (
    <div className="flex justify-end px-4 pt-2 pb-8">
      <button
        type="button"
        onClick={() => { onSelect(item) }}
        className={`max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-left text-sm leading-relaxed text-foreground border ${
          selected
            ? `bg-surface-elevated ${selectedRing}`
            : 'bg-surface-elevated border-transparent'
        }`}
      >
        <p className="whitespace-pre-wrap wrap-break-word">{text}</p>
      </button>
    </div>
  )
}

export function AssistantBubble({ item, selected, onSelect }: MessageBubbleProps) {
  const text = item.block?.text ?? item.event.preview

  return (
    <div className="flex justify-start px-4">
      <button
        type="button"
        onClick={() => { onSelect(item) }}
        className={`px-2 py-1 rounded-lg text-left text-sm leading-relaxed text-foreground border ${
          selected
            ? `border-accent-border ${selectedRing}`
            : 'border-transparent'
        }`}
      >
        <p className="whitespace-pre-wrap wrap-break-word">{text}</p>
      </button>
    </div>
  )
}

export function SystemMessage({ item, selected, onSelect }: MessageBubbleProps) {
  return (
    <div className="flex justify-center px-4 py-2">
      <button
        type="button"
        onClick={() => { onSelect(item) }}
        className={`max-w-[90%] rounded-lg border border-dashed px-3 py-2 text-center text-xs text-muted-foreground ${
          selected ? selectedRing : 'border-border-subtle'
        }`}
      >
        <span className="font-medium uppercase tracking-wide">System</span>
        <p className="mt-1 whitespace-pre-wrap">{item.event.preview}</p>
      </button>
    </div>
  )
}
