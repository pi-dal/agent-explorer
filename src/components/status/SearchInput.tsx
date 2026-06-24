import { Search, X } from 'lucide-react'
import { accentInputFocus, hoverRow, textFaint, textInput } from '../../styles/uiClasses'
import { useSettingsStore } from '../../store/settingsStore'

export function SearchInput() {
  const searchQuery = useSettingsStore((s) => s.searchQuery)
  const setSearchQuery = useSettingsStore((s) => s.setSearchQuery)

  return (
    <div className="relative w-52 max-w-full">
      <Search
        className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 ${textFaint}`}
        size={14}
        strokeWidth={1.75}
        aria-hidden
      />
      <input
        type="text"
        role="searchbox"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder="Search session…"
        className={`h-7 w-full rounded pl-7 pr-7 text-xs ${textInput} ${accentInputFocus}`}
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          className={`absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded ${textFaint} ${hoverRow} hover:text-foreground`}
          aria-label="Clear search"
        >
          <X size={12} strokeWidth={1.75} aria-hidden />
        </button>
      )}
    </div>
  )
}