import type { ConversationListItem } from '../../core/types'

interface MessageBubbleProps {
  item: ConversationListItem
  selected: boolean
  onSelect: () => void
}

export function UserBubble({ item, selected, onSelect }: MessageBubbleProps) {
  const text = item.blocks?.[0]?.text ?? item.preview

  return (
    <div className="flex justify-end px-4 py-2">
      <button
        type="button"
        onClick={onSelect}
        className={`max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-left text-sm leading-relaxed transition-colors ${
          selected
            ? 'bg-sky-600 text-white ring-2 ring-sky-400/50'
            : 'bg-sky-500 text-white hover:bg-sky-600 dark:bg-sky-600 dark:hover:bg-sky-500'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </button>
    </div>
  )
}

export function AssistantBubble({ item, selected, onSelect }: MessageBubbleProps) {
  const text = item.blocks?.[0]?.text ?? item.preview

  return (
    <div className="flex justify-start px-4 py-2">
      <button
        type="button"
        onClick={onSelect}
        className={`max-w-[85%] rounded-2xl rounded-bl-md border px-4 py-2.5 text-left text-sm leading-relaxed transition-colors ${
          selected
            ? 'border-sky-400 bg-white ring-2 ring-sky-400/30 dark:bg-zinc-900'
            : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{text}</p>
      </button>
    </div>
  )
}

export function SystemMessage({ item, selected, onSelect }: MessageBubbleProps) {
  return (
    <div className="flex justify-center px-4 py-2">
      <button
        type="button"
        onClick={onSelect}
        className={`max-w-[90%] rounded-lg border border-dashed px-3 py-2 text-center text-xs text-zinc-500 ${
          selected ? 'border-sky-400 bg-sky-50/50 dark:bg-sky-950/20' : 'border-zinc-300 dark:border-zinc-700'
        }`}
      >
        <span className="font-medium uppercase tracking-wide">System</span>
        <p className="mt-1 whitespace-pre-wrap">{item.preview}</p>
      </button>
    </div>
  )
}