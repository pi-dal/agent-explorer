import { FileJson, FolderSearch, FolderOpen, Moon, Sun } from 'lucide-react'
import { useRef, type ChangeEvent } from 'react'
import { iconButton } from '../../styles/uiClasses'
import { GitHub } from '../shared/icons/GitHub'
import { ToolbarButton } from '../shared/ToolbarButton'
import { useSessionStore } from '../../store/sessionStore'
import { ParseWarningsBadge } from './ParseWarningsBadge'
import { SearchInput } from './SearchInput'
import { SettingsPopover } from './SettingsPopover'
import { WorkspaceBrowser } from './WorkspaceBrowser'
import {
  browserWorkspaceFiles,
  isDesktopApp,
} from '../../platform/workspaceSource'
import {
  stopDesktopWorkspace,
} from '../../platform/desktopWorkspaceController'
import { runDesktopAction } from '../../platform/desktopActions'
import { DesktopUpdateButton } from './DesktopUpdateButton'

const GITHUB_REPOSITORY_URL = 'https://github.com/pi-dal/agent-explorer'

export function StatusBar() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const session = useSessionStore((s) => s.session)
  const sessions = useSessionStore((s) => s.sessions)
  const workspaceName = useSessionStore((s) => s.workspaceName)
  const workspaceStats = useSessionStore((s) => s.workspaceStats)
  const workspaceProgress = useSessionStore((s) => s.workspaceProgress)
  const workspaceWatching = useSessionStore((s) => s.workspaceWatching)
  const isLoading = useSessionStore((s) => s.isLoading)
  const error = useSessionStore((s) => s.error)
  const theme = useSessionStore((s) => s.theme)
  const loadText = useSessionStore((s) => s.loadText)
  const loadDirectory = useSessionStore((s) => s.loadDirectory)
  const selectSession = useSessionStore((s) => s.selectSession)
  const loadSample = useSessionStore((s) => s.loadSample)
  const setTheme = useSessionStore((s) => s.setTheme)

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    void stopDesktopWorkspace()
      .then(() => file.text())
      .then((text) => loadText(text, file.name))
    event.target.value = ''
  }

  function handleFolderChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    if (files.length > 0) void loadDirectory(browserWorkspaceFiles(files))
    event.target.value = ''
  }

  async function chooseFile() {
    if (!isDesktopApp()) {
      fileInputRef.current?.click()
      return
    }
    await runDesktopAction('open-file')
  }

  async function chooseFolder() {
    if (!isDesktopApp()) {
      folderInputRef.current?.click()
      return
    }
    await runDesktopAction('open-folder')
  }

  async function loadBuiltInSample() {
    if (isDesktopApp()) {
      await runDesktopAction('load-sample')
    } else {
      await loadSample()
    }
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
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-separator bg-background px-1.5">
      <span className="px-2 text-sm font-semibold text-primary">Agent Explorer</span>

      {isLoading && workspaceProgress && (
        <span className="font-mono text-[10px] text-tertiary" role="status">
          Reading {workspaceProgress.completed}/{workspaceProgress.total}
        </span>
      )}

      <div className="flex gap-1">
        <ToolbarButton
          type="button"
          onClick={() => void chooseFile()}
          disabled={isLoading}
          aria-label="Open JSONL file"
          title="Open file"
        >
          <FileJson size={14} strokeWidth={1.75} aria-hidden />
        </ToolbarButton>

        <ToolbarButton
          type="button"
          onClick={() => void chooseFolder()}
          disabled={isLoading}
          aria-label="Open XiaoBa folder"
          title="Open folder"
        >
          <FolderOpen size={14} strokeWidth={1.75} aria-hidden />
        </ToolbarButton>

        <button
          type="button"
          onClick={() => void loadBuiltInSample()}
          disabled={isLoading}
          className={`rounded px-2.5 py-1 text-xs disabled:opacity-50 ${iconButton}`}
        >
          XiaoBa Sample
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".jsonl,.json,.log"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        onChange={handleFolderChange}
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
      />

      <div className="flex min-w-0 items-baseline gap-1">
        {session && (
          <span className="rounded bg-overlay px-2 py-0.5 text-[10px] font-medium text-secondary">
            {session.fileType}
          </span>
        )}

        {session && sessions.length > 1 && workspaceName ? (
          <WorkspaceBrowser
            sessions={sessions}
            session={session}
            workspaceName={workspaceName}
            selectSession={selectSession}
          />
        ) : session ? (
          <span className="truncate text-xs text-secondary">
            {session.fileName}{workspaceWatching ? ' · watching' : ''}
          </span>
        ) : null}

        {workspaceName && (
          <span
            className="hidden text-[10px] text-tertiary lg:inline"
            title={workspaceStats?.skippedFiles.map(file => `${file.path}: ${file.reason}`).join('\n')}
          >
            {workspaceName} · {workspaceStats?.loadedCount ?? sessions.length} logs loaded
            {workspaceStats?.skippedCount ? ` · ${workspaceStats.skippedCount} skipped` : ''}
            {workspaceWatching ? ' · watching' : ''}
          </span>
        )}

        {session && session.parseWarnings.length > 0 && (
          <ParseWarningsBadge warnings={session.parseWarnings} />
        )}

        {error && (
          <span
            className="min-w-0 max-w-64 truncate text-xs text-danger"
            title={error}
            role="status"
          >
            {error}
          </span>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex gap-1">
        {session && (
          <>
            <SearchInput />
            <SettingsPopover />
          </>
        )}

        {isDesktopApp() && session?.sourceFilePath && (
          <ToolbarButton
            onClick={() => void runDesktopAction('reveal-current')}
            aria-label="Show current log in system file manager"
            title="Show current log in folder"
          >
            <FolderSearch size={14} strokeWidth={1.75} aria-hidden />
          </ToolbarButton>
        )}

        {isDesktopApp() && <DesktopUpdateButton />}

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
