import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { detectAndParse } from '../core/registry'
import type { ExplorerSession, TimelineEvent, ConversationListItem, Selection } from '../core/types'
import { useSettingsStore } from './settingsStore'

type Theme = 'light' | 'dark' | 'system'

interface SessionState {
  session: ExplorerSession | null
  selection: Selection | null
  theme: Theme
  isLoading: boolean
  error: string | null
  loadText: (text: string, fileName: string) => void
  loadSample: () => Promise<void>
  setSelection: (selection: Selection | null) => void
  selectTimelineEvent: (event: TimelineEvent) => void
  selectConversationItem: (item: ConversationListItem) => void
  setTheme: (theme: Theme) => void
  clearSession: () => void
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
      selection: null,
      theme: 'system',
      isLoading: false,
      error: null,

      loadText: (text, fileName) => {
        set({ isLoading: true, error: null })
        useSettingsStore.getState().resetSessionFilters()
        try {
          const session = detectAndParse(text, fileName)
          set({
            session,
            selection: null,
            isLoading: false,
          })
        } catch (error) {
          set({
            session: null,
            selection: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to parse file',
          })
        }
      },

      loadSample: async () => {
        set({ isLoading: true, error: null })
        try {
          const response = await fetch(
            new URL('../fixtures/claude-transcript.sample.jsonl', import.meta.url),
          )
          const text = await response.text()
          get().loadText(text, 'claude-transcript.sample.jsonl')
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

      clearSession: () => set({ session: null, selection: null, error: null }),
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