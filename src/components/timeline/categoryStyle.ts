import type { EventCategory } from '../../core/types'

const styles: Record<EventCategory, string> = {
  user: 'bg-blue-500',
  assistant: 'bg-violet-500',
  thinking: 'bg-amber-500',
  tool: 'bg-emerald-500',
  system: 'bg-zinc-400',
  meta: 'bg-zinc-300 dark:bg-zinc-600',
  unknown: 'bg-zinc-300 dark:bg-zinc-600',
}

export function categoryDotClass(category: EventCategory): string {
  return styles[category]
}