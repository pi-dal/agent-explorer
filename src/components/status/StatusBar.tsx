import { Moon, Sun } from 'lucide-react'
import { useRef, type ChangeEvent } from 'react'
import { iconButton } from '../../styles/uiClasses'
import { GitHub } from '../shared/icons/GitHub'
import { ToolbarButton } from '../shared/ToolbarButton'
import { useSessionStore } from '../../store/sessionStore'
import { ParseWarningsBadge } from './ParseWarningsBadge'
import { SearchInput } from './SearchInput'
import { SettingsPopover } from './SettingsPopover'

const GITHUB_REPOSITORY_URL = 'https://github.com/unixzii/agent-explorer'

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

  function openGitHub() {
    window.open(GITHUB_REPOSITORY_URL, '_blank', 'noopener,noreferrer')
  }

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface px-1.5">
      <span className="px-2 text-sm font-semibold text-foreground">Agent Explorer</span>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="rounded bg-chrome px-2.5 py-1 text-xs font-medium text-chrome-foreground hover:opacity-80 disabled:opacity-50"
        >
          Open
        </button>

        <button
          type="button"
          onClick={() => void loadSample()}
          disabled={isLoading}
          className={`rounded px-2.5 py-1 text-xs disabled:opacity-50 ${iconButton}`}
        >
          Load Sample
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jsonl,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex items-baseline gap-1">
        {session && (
          <span className="rounded bg-chrome-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {session.fileType}
          </span>
        )}

        {session && (
          <span className="truncate text-xs text-muted-foreground">{session.fileName}</span>
        )}

        {session && session.parseWarnings.length > 0 && (
          <ParseWarningsBadge warnings={session.parseWarnings} />
        )}

        {error && <span className="truncate text-xs text-danger">{error}</span>}
      </div>

      <div className="flex-1" />

      <div className="flex gap-1">
        {session && (
          <>
            <SearchInput />
            <SettingsPopover />
          </>
        )}

        <ToolbarButton
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? (
            <Sun size={14} strokeWidth={1.75} aria-hidden />
          ) : (
            <Moon size={14} strokeWidth={1.75} aria-hidden />
          )}
        </ToolbarButton>

        <ToolbarButton
          onClick={openGitHub}
          aria-label="GitHub Repository"
          title="GitHub Repository"
        >
          <GitHub size={16} />
        </ToolbarButton>
      </div>
    </header>
  )
}
