import type { KeyboardEvent } from 'react'
import type { TimelineEvent } from '../../core/types'
import { categoryDotClass } from './categoryStyle'
import { Activity, Bot, Braces, Circle, GitBranch, TerminalSquare, Wrench } from 'lucide-react'

export const TIMELINE_ITEM_HEIGHT = 44

interface TimelineItemProps {
  event: TimelineEvent
  selected: boolean
  requestHighlighted?: boolean
  onSelect: (event: TimelineEvent) => void
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
}

export function TimelineItem({
  event,
  selected,
  requestHighlighted = false,
  onSelect,
  onKeyDown,
}: TimelineItemProps) {
  const isBranch = event.raw
    && typeof event.raw === 'object'
    && !Array.isArray(event.raw)
    && ((event.raw as Record<string, unknown>).entry_type === 'branch'
      || (event.raw as Record<string, unknown>).entry_type === 'embedded_trace')
    || event.kind === 'branch_anchor'
    || event.kind === 'branch_lifecycle'
    || event.branchActivity
    || event.traceRefs?.some(ref => ref.kind === 'branch')
  const isToolEvent = event.kind === 'tool_call' || event.kind === 'tool_result'
  const KindIcon = event.kind === 'runtime'
    ? TerminalSquare
    : event.kind === 'runtime_activity'
      ? Activity
    : event.kind === 'prompt_trace'
      ? Braces
      : isToolEvent
        ? Wrench
        : event.branchActivity
          ? GitBranch
          : event.kind === 'subagent_event' || isBranch
            ? Bot
            : Circle

  return (
    <button
      type="button"
      role="option"
      id={`timeline-event-${event.id}`}
      data-event-kind={event.kind}
      data-event-label={event.label}
      aria-selected={selected}
      onClick={() => { onSelect(event) }}
      onKeyDown={onKeyDown}
      className={`flex h-full w-full min-h-0 shrink-0 items-center gap-2 overflow-hidden border-l-2 px-2 text-left text-xs ${
        selected
          ? 'border-accent bg-overlay-emphasized'
          : 'border-transparent hover:bg-overlay'
      }`}
    >
      <span
        className={`w-8 shrink-0 font-mono ${(requestHighlighted || selected) ? 'text-primary' : 'text-tertiary'}`}
      >
        #{event.lineIndex}
      </span>
      {event.kind === 'runtime' || event.kind === 'runtime_activity' || event.kind === 'prompt_trace' || event.kind === 'subagent_event' || isBranch || isToolEvent ? (
        <KindIcon
          size={13}
          strokeWidth={1.75}
          className={`shrink-0 ${
            event.kind === 'runtime' || event.kind === 'runtime_activity'
              ? 'text-role-system'
              : event.kind === 'prompt_trace'
                ? 'text-role-thinking'
                : 'text-role-tool'
          }`}
          aria-hidden
        />
      ) : (
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${categoryDotClass(event.category)}`}
        />
      )}
      <span className="flex h-8 min-w-0 flex-1 flex-col justify-center overflow-hidden">
        <span className={`block h-4 truncate leading-4 font-medium text-primary`}>
          {event.label}
        </span>
        <span className={`block h-4 truncate leading-4 text-tertiary`}>
          {event.preview || '\u00a0'}
        </span>
      </span>
    </button>
  )
}
