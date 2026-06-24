import { Moon, Sun } from 'lucide-react'
import { useRef, type ChangeEvent } from 'react'
import { useSessionStore } from '../../store/sessionStore'
import { ParseWarningsBadge } from './ParseWarningsBadge'
import { SearchInput } from './SearchInput'
import { SettingsPopover } from './SettingsPopover'

export function StatusBar() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const session = useSessionStore((s) => s.session)
  const isLoading = useSessionStore((s) => s.isLoading)
  const error = useSessionStore((s) => s.error)
  const theme = useSessionStore((s) => s.theme)
  const loadText = useSessionStore((s) => s.loadText)
  const loadSample = useSessionStore((s) => s.loadSample)
  const setTheme = useSessionStore((s) => s.setTheme)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    void file.text().then((text) => loadText(text, file.name))
    event.target.value = ''
  }

  function toggleTheme() {
    const next =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'light'
          : 'dark'
        : theme === 'dark'
          ? 'light'
          : 'dark'
    setTheme(next)
  }

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Agent Explorer
      </span>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className="rounded bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Open
      </button>

      <button
        type="button"
        onClick={() => void loadSample()}
        disabled={isLoading}
        className="rounded border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        Sample
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jsonl,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      {session && (
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {session.adapterId}
        </span>
      )}

      {session && (
        <span className="truncate text-xs text-zinc-500">{session.fileName}</span>
      )}

      {session && session.parseWarnings.length > 0 && (
        <ParseWarningsBadge warnings={session.parseWarnings} />
      )}

      {error && <span className="truncate text-xs text-red-500">{error}</span>}

      {session && <SearchInput />}

      <div className="flex-1" />

      {session && <SettingsPopover />}

      <button
        type="button"
        onClick={toggleTheme}
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        {isDark ? (
          <Sun size={14} strokeWidth={1.75} aria-hidden />
        ) : (
          <Moon size={14} strokeWidth={1.75} aria-hidden />
        )}
      </button>
    </header>
  )
}