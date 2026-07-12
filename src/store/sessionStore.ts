import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { detectAndParse } from '../core/registry'
import type { ExplorerSession, TimelineEvent, ConversationListItem, Selection, WorkspaceProgress, WorkspaceStats } from '../core/types'
import { useSettingsStore } from './settingsStore'
import { isLogCandidate, workspaceNameFromPaths } from '../core/workspace'
import type { WorkspaceFile } from '../platform/workspaceSource'

type Theme = 'light' | 'dark' | 'system'

interface SessionState {
  session: ExplorerSession | null
  sessions: ExplorerSession[]
  workspaceName: string | null
  workspaceStats: WorkspaceStats | null
  workspaceProgress: WorkspaceProgress | null
  workspaceWatching: boolean
  selection: Selection | null
  theme: Theme
  isLoading: boolean
  error: string | null
  loadText: (
    text: string,
    fileName: string,
    sourceFilePath?: string,
    options?: TextLoadOptions,
  ) => void
  loadDirectory: (files: WorkspaceFile[], options?: WorkspaceLoadOptions) => Promise<void>
  setWorkspaceWatching: (watching: boolean) => void
  reportError: (message: string | null) => void
  selectSession: (index: number) => void
  loadSample: () => Promise<void>
  setSelection: (selection: Selection | null) => void
  selectTimelineEvent: (event: TimelineEvent) => void
  selectConversationItem: (item: ConversationListItem) => void
  setTheme: (theme: Theme) => void
  clearSession: () => void
}

interface WorkspaceLoadOptions {
  preserveCurrentSession?: boolean
  resetFilters?: boolean
}

interface TextLoadOptions {
  preserveSelection?: boolean
  resetFilters?: boolean
  retainLastValidSession?: boolean
}

function sessionToolCount(session: ExplorerSession): number {
  return session.conversationItems.filter(item => item.role === 'tool_call').length
}

function sessionActivityScore(session: ExplorerSession): number {
  if (session.conversationItems.length === 0) return 0
  if (sessionToolCount(session) > 0) return 2
  return 1
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.classList.toggle('dark', isDark)
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      session: null,
      sessions: [],
      workspaceName: null,
      workspaceStats: null,
      workspaceProgress: null,
      workspaceWatching: false,
      selection: null,
      theme: 'system',
      isLoading: false,
      error: null,

      loadText: (text, fileName, sourceFilePath, options = {}) => {
        const previousSelection = options.preserveSelection ? get().selection : null
        set({ isLoading: true, error: null })
        if (options.resetFilters !== false) {
          useSettingsStore.getState().resetSessionFilters()
          useSettingsStore.getState().setHideSystem(false)
          useSettingsStore.getState().setHideToolCalls(false)
        }
        try {
          const session = detectAndParse(text, fileName)
          session.sourceFilePath = sourceFilePath
          const selection = restoreSelection(session, previousSelection)
          set({
            session,
            sessions: [session],
            workspaceName: null,
            workspaceStats: null,
            workspaceProgress: null,
            selection,
            isLoading: false,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to parse file'
          if (
            options.retainLastValidSession
            && sourceFilePath
            && get().session?.sourceFilePath === sourceFilePath
          ) {
            set({ isLoading: false, error: message })
            return
          }
          set({
            session: null,
            sessions: [],
            workspaceName: null,
            workspaceStats: null,
            workspaceProgress: null,
            selection: null,
            isLoading: false,
            error: message,
          })
        }
      },

      loadDirectory: async (files, options = {}) => {
        const previousSourcePath = options.preserveCurrentSession
          ? get().session?.sourcePath
          : undefined
        set({ isLoading: true, error: null })
        if (options.resetFilters !== false) {
          useSettingsStore.getState().resetSessionFilters()
          useSettingsStore.getState().setHideSystem(false)
          useSettingsStore.getState().setHideToolCalls(false)
        }
        try {
          const paths = files.map(file => file.relativePath)
          const workspaceName = workspaceNameFromPaths(paths)
          const resources: Record<string, string> = {}
          const promptFiles = files.filter((file) => {
            const relativePath = file.relativePath
            return /(^|\/)prompts\//.test(relativePath) && /\.md$/i.test(file.name)
          })
          await Promise.all(promptFiles.map(async (file) => {
            const relativePath = file.relativePath
            const text = await file.text()
            resources[relativePath] = text
            const withoutRoot = relativePath.split('/').slice(1).join('/')
            if (withoutRoot) resources[withoutRoot] = text
          }))

          const sessionFiles = files.filter(file => isLogCandidate(file.name))
          const skippedFiles: Array<{ path: string; reason: string }> = []
          set({ workspaceProgress: { completed: 0, total: sessionFiles.length } })
          const loaded = await mapWithConcurrency(sessionFiles, 12, async (file) => {
            const sourcePath = file.relativePath
            try {
              const session = detectAndParse(await file.text(), file.name)
              session.sourcePath = sourcePath
              session.sourceFilePath = file.filePath
              session.resources = resources
              return { session, modified: file.lastModified }
            } catch (error) {
              skippedFiles.push({
                path: sourcePath,
                reason: error instanceof Error ? error.message : 'Unrecognized log format',
              })
              return null
            } finally {
              set(state => ({
                workspaceProgress: state.workspaceProgress
                  ? { ...state.workspaceProgress, completed: state.workspaceProgress.completed + 1 }
                  : null,
              }))
            }
          })
          const parsed = loaded
            .filter((value): value is { session: ExplorerSession; modified: number } => value !== null)
            .sort((a, b) => (
              sessionActivityScore(b.session) - sessionActivityScore(a.session)
              || b.modified - a.modified
              || a.session.fileName.localeCompare(b.session.fileName)
            ))
            .map(value => value.session)

          if (parsed.length === 0) {
            throw new Error(
              sessionFiles.length === 0
                ? 'No .jsonl or .log files found in this folder'
                : `Found ${sessionFiles.length} log files, but none matched a supported session format`,
            )
          }
          const nextSession = parsed.find(session => session.sourcePath === previousSourcePath)
            ?? parsed[0]!
          set({
            session: nextSession,
            sessions: parsed,
            workspaceName,
            workspaceStats: {
              candidateCount: sessionFiles.length,
              loadedCount: parsed.length,
              skippedCount: skippedFiles.length,
              skippedFiles,
            },
            selection: null,
            isLoading: false,
            workspaceProgress: null,
          })
        } catch (error) {
          set({
            session: null,
            sessions: [],
            workspaceName: null,
            workspaceStats: null,
            workspaceProgress: null,
            selection: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to open folder',
          })
        }
      },

      setWorkspaceWatching: (workspaceWatching) => set({ workspaceWatching }),
      reportError: (error) => set({ error }),

      selectSession: (index) => set((state) => ({
        session: state.sessions[index] ?? state.session,
        selection: null,
      })),

      loadSample: async () => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(
            new URL('../fixtures/xiaoba-session.sample.jsonl', import.meta.url),
          )
          const text = await response.text()
          get().loadText(text, 'xiaoba-session.sample.jsonl')
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to load sample',
          })
        }
      },

      setSelection: (selection) => set({ selection }),

      selectTimelineEvent: (event) => {
        if (!event) return
        const syncSelection = useSettingsStore.getState().syncSelection
        set((prev) => {
          const conversationItem = syncSelection
            ? event.conversationItem
            : prev.selection?.conversationItem
          return {
            selection: { source: 'timeline', event, conversationItem }
          }
        })
      },

      selectConversationItem: (item) => {
        if (!item) return
        const syncSelection = useSettingsStore.getState().syncSelection
        set((prev) => {
          const event = syncSelection ? item.event : prev.selection?.event
          return {
            selection: { source: 'conversation', event, conversationItem: item },
          }
        })
      },

      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },

      clearSession: () => set({
        session: null,
        sessions: [],
        workspaceName: null,
        workspaceStats: null,
        workspaceProgress: null,
        workspaceWatching: false,
        selection: null,
        error: null,
      }),
    }),
    {
      name: 'agent-explorer',
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    },
  ),
)

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  task: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++
      results[index] = await task(values[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker))
  return results
}

export function restoreSelection(
  session: ExplorerSession,
  previousSelection: Selection | null,
): Selection | null {
  if (!previousSelection) return null
  const event = previousSelection.event
    ? session.events.find(candidate => candidate.id === previousSelection.event?.id)
    : undefined
  const conversationItem = previousSelection.conversationItem
    ? session.conversationItems.find(candidate => candidate.id === previousSelection.conversationItem?.id)
    : undefined
  return event || conversationItem
    ? { source: previousSelection.source, event, conversationItem }
    : null
}
