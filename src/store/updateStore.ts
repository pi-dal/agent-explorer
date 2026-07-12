import { create } from 'zustand'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'current'
  | 'error'

interface UpdateState {
  status: UpdateStatus
  version: string | null
  notes: string | null
  progress: number | null
  error: string | null
  setUpdateState: (state: Partial<Omit<UpdateState, 'setUpdateState'>>) => void
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: 'idle',
  version: null,
  notes: null,
  progress: null,
  error: null,
  setUpdateState: (state) => set(state),
}))
