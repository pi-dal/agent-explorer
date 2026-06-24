import { Search, X } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'

export function SearchInput() {
  const searchQuery = useSettingsStore((s) => s.searchQuery)
  const setSearchQuery = useSettingsStore((s) => s.setSearchQuery)

  return (
    <div className="relative w-52 max-w-full">
      <Search
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400"
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
        className="h-7 w-full rounded border border-zinc-200 bg-white pl-7 pr-7 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-blue-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery('')}
          className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Clear search"
        >
          <X size={12} strokeWidth={1.75} aria-hidden />
        </button>
      )}
    </div>
  )
}