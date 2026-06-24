import type { TimelineEvent } from '../../core/types'
import { categoryDotClass } from './categoryStyle'

export const TIMELINE_ITEM_HEIGHT = 44

interface TimelineItemProps {
  event: TimelineEvent
  selected: boolean
  onSelect: () => void
}

export function TimelineItem({ event, selected, onSelect }: TimelineItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex h-full w-full min-h-0 shrink-0 items-center gap-2 overflow-hidden border-l-2 px-2 text-left text-xs transition-colors ${
        selected
          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40'
          : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900'
      }`}
    >
      <span className="w-8 shrink-0 font-mono text-zinc-400">#{event.lineIndex}</span>
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${categoryDotClass(event.category)}`}
      />
      <span className="flex h-8 min-w-0 flex-1 flex-col justify-center overflow-hidden">
        <span className="block h-4 truncate leading-4 font-medium text-zinc-800 dark:text-zinc-200">
          {event.label}
        </span>
        <span className="block h-4 truncate leading-4 text-zinc-500">
          {event.preview || '\u00a0'}
        </span>
      </span>
    </button>
  )
}