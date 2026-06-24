import type { ConversationListItem } from '../../core/types'

export function resolveActiveToolCallId(
  items: ConversationListItem[],
  hoveredItemId: string | null,
  selectedItemId: string | null | undefined,
): string | null {
  if (hoveredItemId) {
    const hovered = items.find((item) => item.id === hoveredItemId)
    if (
      hovered?.toolCallId &&
      (hovered.role === 'tool_call' || hovered.role === 'tool_result')
    ) {
      return hovered.toolCallId
    }
  }

  if (selectedItemId) {
    const selected = items.find((item) => item.id === selectedItemId)
    if (
      selected?.toolCallId &&
      (selected.role === 'tool_call' || selected.role === 'tool_result')
    ) {
      return selected.toolCallId
    }
  }

  return null
}

export function isToolPairHighlighted(
  item: ConversationListItem,
  activeToolCallId: string | null,
  hoveredItemId: string | null,
  selectedItemId: string | null | undefined,
): boolean {
  if (!activeToolCallId || !item.toolCallId) return false
  if (item.toolCallId !== activeToolCallId) return false
  if (item.role !== 'tool_call' && item.role !== 'tool_result') return false
  if (item.id === hoveredItemId || item.id === selectedItemId) return false
  return true
}