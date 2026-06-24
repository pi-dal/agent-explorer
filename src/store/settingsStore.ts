import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EventCategory } from '../core/types'

export type TimelineCategoryFilter = 'all' | EventCategory

export interface ExplorerSettings {
  searchQuery: string
  timelineCategoryFilter: TimelineCategoryFilter
  hideSystem: boolean
  hideThinking: boolean
  hideToolCalls: boolean
  syncSelection: boolean
}

interface SettingsState extends ExplorerSettings {
  setSearchQuery: (query: string) => void
  setTimelineCategoryFilter: (filter: TimelineCategoryFilter) => void
  setHideSystem: (hide: boolean) => void
  setHideThinking: (hide: boolean) => void
  setHideToolCalls: (hide: boolean) => void
  setSyncSelection: (sync: boolean) => void
  resetSessionFilters: () => void
}

const DEFAULT_SETTINGS: ExplorerSettings = {
  searchQuery: '',
  timelineCategoryFilter: 'all',
  hideSystem: false,
  hideThinking: false,
  hideToolCalls: false,
  syncSelection: true,
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setTimelineCategoryFilter: (timelineCategoryFilter) => set({ timelineCategoryFilter }),
      setHideSystem: (hideSystem) => set({ hideSystem }),
      setHideThinking: (hideThinking) => set({ hideThinking }),
      setHideToolCalls: (hideToolCalls) => set({ hideToolCalls }),
      setSyncSelection: (syncSelection) => set({ syncSelection }),
      resetSessionFilters: () =>
        set({
          searchQuery: '',
          timelineCategoryFilter: 'all',
        }),
    }),
    {
      name: 'agent-explorer-settings',
      partialize: (state) => ({
        timelineCategoryFilter: state.timelineCategoryFilter,
        hideSystem: state.hideSystem,
        hideThinking: state.hideThinking,
        hideToolCalls: state.hideToolCalls,
        syncSelection: state.syncSelection,
      }),
    },
  ),
)