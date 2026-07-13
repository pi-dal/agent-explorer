import { Bot, Braces, GitBranch, ListTree, MessageSquareText, TerminalSquare, Wrench } from 'lucide-react'
import type { TimelineEvent } from '../../core/types'
import {
  countXiaoBaTimelineScopes,
  type XiaoBaTimelineScope,
} from '../../core/xiaoba'
import { chipActive, chipInactive, sectionDivider } from '../../styles/uiClasses'

const OPTIONS: Array<{
  value: XiaoBaTimelineScope
  label: string
  icon: typeof ListTree
}> = [
  { value: 'all', label: 'All', icon: ListTree },
  { value: 'workflow', label: 'Workflow', icon: MessageSquareText },
  { value: 'tool', label: 'Tools', icon: Wrench },
  { value: 'branch', label: 'Branches', icon: GitBranch },
  { value: 'runtime', label: 'Runtime', icon: TerminalSquare },
  { value: 'prompt', label: 'Prompts', icon: Braces },
  { value: 'subagent', label: 'Subagents', icon: Bot },
]

export function XiaoBaTimelineFilter({
  events,
  value,
  onChange,
}: {
  events: TimelineEvent[]
  value: XiaoBaTimelineScope
  onChange: (value: XiaoBaTimelineScope) => void
}) {
  const counts = countXiaoBaTimelineScopes(events)

  return (
    <div className={`flex gap-1 overflow-x-auto px-2 py-1.5 ${sectionDivider}`}>
      {OPTIONS.map((option) => {
        const Icon = option.icon
        const active = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-[10px] font-medium ${
              active ? chipActive : chipInactive
            }`}
          >
            <Icon size={12} strokeWidth={1.75} aria-hidden />
            <span>{option.label}</span>
            <span className="font-mono text-[9px] opacity-70">{counts[option.value]}</span>
          </button>
        )
      })}
    </div>
  )
}
