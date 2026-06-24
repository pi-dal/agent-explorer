import type { EventCategory } from '../../core/types'

const styles: Record<EventCategory, string> = {
  user: 'bg-role-user',
  assistant: 'bg-role-assistant',
  thinking: 'bg-role-thinking',
  tool: 'bg-role-tool',
  system: 'bg-role-system',
  meta: 'bg-role-meta',
  unknown: 'bg-role-meta',
}

export function categoryDotClass(category: EventCategory): string {
  return styles[category]
}