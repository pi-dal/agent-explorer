import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { filterConversationItems } from '../../core/filter'
import { useSessionStore } from '../../store/sessionStore'
import { useSettingsStore } from '../../store/settingsStore'
import type { ConversationListItem } from '../../core/types'
import { ConversationMessage } from './ConversationMessage'
import { estimateRowSize } from './estimateRowSize'
import {
  isToolPairHighlighted,
  resolveActiveToolCallId,
} from './toolPairHighlight'

const EMPTY_ITEMS: ConversationListItem[] = []

type VirtualRow =
  | { kind: 'turn'; turnIndex: number; key: string }
  | { kind: 'item'; key: string; itemIndex: number }

function measureRowElement(element: HTMLElement): number {
  return element.getBoundingClientRect().height
}

export function ConversationPanel() {
  const session = useSessionStore((s) => s.session)
  const selection = useSessionStore((s) => s.selection)
  const selectConversationItem = useSessionStore((s) => s.selectConversationItem)
  const parentRef = useRef<HTMLDivElement>(null)
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)

  const allItems = session?.conversationItems ?? EMPTY_ITEMS
  const searchQuery = useSettingsStore((s) => s.searchQuery)
  const hideSystem = useSettingsStore((s) => s.hideSystem)
  const hideThinking = useSettingsStore((s) => s.hideThinking)
  const items = useMemo(
    () => filterConversationItems(allItems, { searchQuery, hideSystem, hideThinking }),
    [allItems, searchQuery, hideSystem, hideThinking],
  )
  const selectedItemId = selection?.conversationItemId

  const activeToolCallId = useMemo(
    () => resolveActiveToolCallId(items, hoveredItemId, selectedItemId),
    [items, hoveredItemId, selectedItemId],
  )

  const rows: VirtualRow[] = useMemo(() => {
    const result: VirtualRow[] = []
    let lastTurn = -1
    items.forEach((item, itemIndex) => {
      if (item.turnIndex !== lastTurn) {
        result.push({ kind: 'turn', turnIndex: item.turnIndex, key: `turn-${item.turnIndex}` })
        lastTurn = item.turnIndex
      }
      result.push({ kind: 'item', key: item.id, itemIndex })
    })
    return result
  }, [items])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    getItemKey: (index) => rows[index]?.key ?? String(index),
    estimateSize: (index) => estimateRowSize(rows[index], items),
    overscan: 8,
    measureElement: (element) => measureRowElement(element as HTMLElement),
  })

  const remeasureRow = useCallback(
    (rowIndex: number) => {
      const element = parentRef.current?.querySelector(
        `[data-index="${rowIndex}"]`,
      ) as HTMLElement | null
      if (!element) return
      virtualizer.resizeItem(rowIndex, measureRowElement(element))
    },
    [virtualizer],
  )

  useEffect(() => {
    if (
      selection?.source !== 'timeline' ||
      !selection.conversationItemId ||
      !parentRef.current
    ) {
      return
    }
    const index = rows.findIndex(
      (row) =>
        row.kind === 'item' && items[row.itemIndex]?.id === selection.conversationItemId,
    )
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'center' })
  }, [selection?.source, selection?.conversationItemId, rows, items, virtualizer])

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-zinc-500">
        Open a Claude Code JSONL file to explore the session
      </div>
    )
  }

  if (allItems.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-zinc-500">
        No conversation items in this file
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col bg-zinc-100/50 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 bg-white/80 px-4 py-2 text-xs font-medium text-zinc-500 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          Conversation · 0 / {allItems.length} messages
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-sm text-zinc-500">
          No messages match the current filters
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-zinc-100/50 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 bg-white/80 px-4 py-2 text-xs font-medium text-zinc-500 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        Conversation · {items.length}
        {items.length !== allItems.length ? ` / ${allItems.length}` : ''} messages ·{' '}
        {session.meta.turnCount} turns
      </div>
      <div ref={parentRef} className="flex-1 overflow-auto py-3">
        <div
          style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index]!
            return (
              <div
                key={row.key}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.kind === 'turn' ? (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                      Turn {row.turnIndex}
                    </span>
                    <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                ) : (
                  <ConversationMessage
                    item={items[row.itemIndex]!}
                    selected={selectedItemId === items[row.itemIndex]!.id}
                    pairHighlighted={isToolPairHighlighted(
                      items[row.itemIndex]!,
                      activeToolCallId,
                      hoveredItemId,
                      selectedItemId,
                    )}
                    onSelect={() => selectConversationItem(items[row.itemIndex]!.id)}
                    onHoverStart={
                      items[row.itemIndex]!.role === 'tool_call' ||
                      items[row.itemIndex]!.role === 'tool_result'
                        ? () => setHoveredItemId(items[row.itemIndex]!.id)
                        : undefined
                    }
                    onHoverEnd={
                      items[row.itemIndex]!.role === 'tool_call' ||
                      items[row.itemIndex]!.role === 'tool_result'
                        ? () => setHoveredItemId(null)
                        : undefined
                    }
                    onLayoutChange={() => remeasureRow(virtualRow.index)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}