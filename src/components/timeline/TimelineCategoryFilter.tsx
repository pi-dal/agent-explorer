import { TIMELINE_CATEGORY_OPTIONS } from '../../core/filter'
import {
  accentChipActive,
  accentChipInactive,
  sectionDivider,
} from '../../styles/uiClasses'
import type { TimelineCategoryFilter } from '../../store/settingsStore'
import { useSettingsStore } from '../../store/settingsStore'

export function TimelineCategoryFilter() {
  const filter = useSettingsStore((s) => s.timelineCategoryFilter)
  const setFilter = useSettingsStore((s) => s.setTimelineCategoryFilter)

  return (
    <div className={`flex flex-wrap gap-1 px-2 py-1.5 ${sectionDivider}`}>
      {TIMELINE_CATEGORY_OPTIONS.map((option) => {
        const active = filter === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value as TimelineCategoryFilter)}
            className={`rounded px-2 py-0.5 text-[10px] font-medium ${
              active ? accentChipActive : accentChipInactive
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}