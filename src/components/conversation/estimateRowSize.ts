import type { ConversationListItem } from '../../core/types'

type VirtualRow =
  | { kind: 'turn'; turnIndex: number; key: string }
  | { kind: 'item'; key: string; itemIndex: number }

export function estimateRowSize(
  row: VirtualRow | undefined,
  items: ConversationListItem[],
): number {
  if (!row) return 64
  if (row.kind === 'turn') return 40

  const item = items[row.itemIndex]
  if (!item) return 64

  switch (item.role) {
    case 'user':
    case 'assistant':
      const text = item.block?.text ?? item.event.preview
      return Math.min(320, 72 + Math.ceil(text?.length ?? 0 / 48) * 20)
    case 'thinking':
      return 44
    case 'tool_call':
      return 44
    case 'tool_result':
      return 44
    case 'system':
      return 80
    default:
      return 64
  }
}