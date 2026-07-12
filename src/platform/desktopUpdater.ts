import type { Update } from '@tauri-apps/plugin-updater'
import { useUpdateStore } from '../store/updateStore'
import { isDesktopApp } from './workspaceSource'

let pendingUpdate: Update | null = null
let backgroundCheckStarted = false

export async function checkForDesktopUpdate(silent = false): Promise<void> {
  if (!isDesktopApp()) return
  const store = useUpdateStore.getState()
  if (store.status === 'checking' || store.status === 'downloading') return

  store.setUpdateState({ status: 'checking', error: null, progress: null })
  try {
    await pendingUpdate?.close()
    const { check } = await import('@tauri-apps/plugin-updater')
    pendingUpdate = await check({ timeout: 20_000 })
    if (!pendingUpdate) {
      store.setUpdateState({ status: 'current', version: null, notes: null })
      return
    }
    store.setUpdateState({
      status: 'available',
      version: pendingUpdate.version,
      notes: pendingUpdate.body ?? null,
    })
  } catch (error) {
    store.setUpdateState(silent
      ? { status: 'idle', error: null }
      : { status: 'error', error: errorMessage(error) })
  }
}

export function startBackgroundUpdateCheck(): void {
  if (backgroundCheckStarted || !isDesktopApp()) return
  backgroundCheckStarted = true
  window.setTimeout(() => void checkForDesktopUpdate(true), 2_000)
}

export async function downloadAndInstallDesktopUpdate(): Promise<void> {
  if (!pendingUpdate) {
    await checkForDesktopUpdate(false)
    if (!pendingUpdate) return
  }

  const store = useUpdateStore.getState()
  let downloaded = 0
  let contentLength: number | undefined
  store.setUpdateState({ status: 'downloading', progress: 0, error: null })
  try {
    await pendingUpdate.downloadAndInstall(event => {
      if (event.event === 'Started') {
        contentLength = event.data.contentLength
      } else if (event.event === 'Progress') {
        downloaded += event.data.chunkLength
      }
      store.setUpdateState({
        progress: updateProgress(downloaded, contentLength),
      })
    })
    pendingUpdate = null
    store.setUpdateState({ status: 'ready', progress: 1 })
  } catch (error) {
    store.setUpdateState({ status: 'error', error: errorMessage(error) })
  }
}

export async function restartAfterDesktopUpdate(): Promise<void> {
  const { relaunch } = await import('@tauri-apps/plugin-process')
  await relaunch()
}

export function updateProgress(downloaded: number, contentLength?: number): number | null {
  if (!contentLength || contentLength <= 0) return null
  return Math.min(1, Math.max(0, downloaded / contentLength))
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string' && error) return error
  return 'Failed to check for updates'
}
