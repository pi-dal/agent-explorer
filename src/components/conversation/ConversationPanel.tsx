import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { emptyState, panelHeader } from '../../styles/uiClasses'
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
  const hideToolCalls = useSettingsStore((s) => s.hideToolCalls)
  const items = useMemo(
    () =>
      filterConversationItems(allItems, {
        searchQuery,
        hideSystem,
        hideThinking,
        hideToolCalls,
      }),
    [allItems, searchQuery, hideSystem, hideThinking, hideToolCalls],
  )
  const selectedItemId = selection?.conversationItem?.id

  const activeToolCallId = useMemo(
    () => resolveActiveToolCallId(items, hoveredItemId, selectedItemId),
    [items, hoveredItemId, selectedItemId],
  )

  const rows: VirtualRow[] = useMemo(() => {
    const result: VirtualRow[] = []
    let lastTurn = -1
    items.forEach((item, itemIndex) => {
      const turnIndex = item.event?.turnIndex ?? 0
      if (turnIndex !== lastTurn) {
        result.push({ kind: 'turn', turnIndex, key: `turn-${turnIndex}` })
        lastTurn = turnIndex
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
    if (selection?.source === 'conversation') {
      return
    }
    if (!selectedItemId) return
    const index = rows.findIndex(
      (row) => row.kind === 'item' && items[row.itemIndex]?.id === selectedItemId,
    )
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'start', behavior: 'smooth' })
  }, [selection, selectedItemId, rows, items, virtualizer])

  if (!session) {
    return (
      <div className={`flex h-full items-center justify-center p-4 ${emptyState}`}>
        Open a Claude Code JSONL file to explore the session
      </div>
    )
  }

  if (allItems.length === 0) {
    return (
      <div className={`flex h-full items-center justify-center p-4 ${emptyState}`}>
        No conversation items in this file
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className={panelHeader}>
          Conversation · 0 / {allItems.length} messages
        </div>
        <div className={`flex flex-1 items-center justify-center p-4 ${emptyState}`}>
          No messages match the current filters
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className={panelHeader}>
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
                    <div className={`h-px flex-1 bg-divider`} />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-faint">
                      Turn {row.turnIndex}
                    </span>
                    <div className={`h-px flex-1 bg-divider`} />
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
                    onSelect={selectConversationItem}
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
