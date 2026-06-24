import { TIMELINE_CATEGORY_OPTIONS } from '../../core/filter'
import type { TimelineCategoryFilter } from '../../store/settingsStore'
import { useSettingsStore } from '../../store/settingsStore'

export function TimelineCategoryFilter() {
  const filter = useSettingsStore((s) => s.timelineCategoryFilter)
  const setFilter = useSettingsStore((s) => s.setTimelineCategoryFilter)

  return (
    <div className="flex flex-wrap gap-1 border-b border-zinc-200 px-2 py-1.5 dark:border-zinc-800">
      {TIMELINE_CATEGORY_OPTIONS.map((option) => {
        const active = filter === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value as TimelineCategoryFilter)}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              active
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-300'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}