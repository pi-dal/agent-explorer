import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { detectAndParse } from '../core/registry'
import type { ExplorerSession, Selection } from '../core/types'
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
  selectTimelineEvent: (eventId: string) => void
  selectConversationItem: (itemId: string) => void
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

      selectTimelineEvent: (eventId) => {
        const event = get().session?.events.find((e) => e.id === eventId)
        if (!event) return
        set({
          selection: {
            source: 'timeline',
            eventId,
            conversationItemId: event.conversationItemId,
            lineIndex: event.lineIndex,
            raw: event.raw,
          },
        })
      },

      selectConversationItem: (itemId) => {
        const item = get().session?.conversationItems.find((i) => i.id === itemId)
        if (!item) return
        set({
          selection: {
            source: 'conversation',
            conversationItemId: itemId,
            eventId: item.linkedEventIds[0],
            lineIndex: get().session?.events.find((e) => e.id === item.linkedEventIds[0])
              ?.lineIndex,
            raw: item.raw,
          },
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