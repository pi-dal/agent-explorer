import { useSessionStore } from '../store/sessionStore'
import {
  activateDesktopFile,
  activateDesktopWorkspace,
  stopDesktopWorkspace,
} from './desktopWorkspaceController'
import { openedDesktopFile, openDesktopDirectory, openDesktopFile } from './workspaceSource'
import { checkForDesktopUpdate } from './desktopUpdater'

export type DesktopAction =
  | 'open-file'
  | 'open-folder'
  | 'reveal-current'
  | 'load-sample'
  | 'check-updates'

export async function runDesktopAction(action: DesktopAction): Promise<void> {
  try {
    switch (action) {
      case 'open-file':
        await openLogFile()
        break
      case 'open-folder':
        await openWorkspace()
        break
      case 'reveal-current':
        await revealCurrentLog()
        break
      case 'load-sample':
        await loadSample()
        break
      case 'check-updates':
        await checkForDesktopUpdate(false)
        break
    }
  } catch (error) {
    useSessionStore.getState().reportError(errorMessage(error))
  }
}

export async function listenForDesktopActions(): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen<DesktopAction>('desktop-action', event => {
    void runDesktopAction(event.payload)
  })
}

interface SystemOpenedLog {
  name: string
  path: string
  text: string
}

export async function takeSystemOpenedLogs(): Promise<boolean> {
  if (!('__TAURI_INTERNALS__' in window)) return false
  const { invoke } = await import('@tauri-apps/api/core')
  const logs = await invoke<SystemOpenedLog[]>('take_opened_logs')
  const log = logs.at(-1)
  if (!log) return false

  await activateDesktopFile(openedDesktopFile(log.path, log.name, log.text), true)
  return true
}

export async function listenForSystemOpenedLogs(): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen('system-opened-logs', () => {
    void takeSystemOpenedLogs().catch(error => {
      useSessionStore.getState().reportError(errorMessage(error))
    })
  })
}

async function openLogFile(): Promise<void> {
  const file = await openDesktopFile()
  if (!file) return
  await activateDesktopFile(file, true)
}

async function openWorkspace(): Promise<void> {
  const workspace = await openDesktopDirectory()
  if (workspace) await activateDesktopWorkspace(workspace, true)
}

async function loadSample(): Promise<void> {
  await stopDesktopWorkspace()
  await useSessionStore.getState().loadSample()
}

async function revealCurrentLog(): Promise<void> {
  const path = useSessionStore.getState().session?.sourceFilePath
  if (!path) throw new Error('Open a local log file before showing it in the system file manager')
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
  await revealItemInDir(path)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string' && error) return error
  return 'The desktop action failed'
}
