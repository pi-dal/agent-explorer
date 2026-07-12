import { useSessionStore } from '../store/sessionStore'
import {
  isDesktopApp,
  readDesktopFile,
  readDesktopDirectory,
  rememberDesktopFile,
  rememberDesktopDirectory,
  restoreRecentDesktopSource as readRecentDesktopSource,
  watchDesktopDirectory,
  watchDesktopFile,
  type WorkspaceFile,
  type DesktopWorkspace,
} from './workspaceSource'

let activeRootPath: string | null = null
let activeFilePath: string | null = null
let activeFileName: string | null = null
let stopWatching: (() => void) | null = null
let refreshTimer: number | null = null
let refreshInFlight = false
let refreshPending = false
let generation = 0

export async function activateDesktopWorkspace(
  workspace: DesktopWorkspace,
  remember = false,
): Promise<void> {
  const operation = ++generation
  teardownWorkspace()
  await activateWorkspace(workspace, operation, remember)
}

export async function activateDesktopFile(
  file: WorkspaceFile,
  remember = false,
): Promise<void> {
  const operation = ++generation
  teardownWorkspace()
  const text = await file.text()
  if (operation !== generation) return
  useSessionStore.getState().loadText(text, file.name, file.filePath)
  if (!file.filePath || operation !== generation || !useSessionStore.getState().session) return

  activeFilePath = file.filePath
  activeFileName = file.name
  try {
    const unwatch = await watchDesktopFile(file.filePath, scheduleRefresh)
    if (operation !== generation) {
      unwatch()
      return
    }
    stopWatching = unwatch
    useSessionStore.getState().setWorkspaceWatching(true)
    if (remember) {
      try {
        await rememberDesktopFile(file.filePath)
      } catch (error) {
        useSessionStore.getState().reportError(
          errorMessage(error, 'Failed to remember the recent log file'),
        )
      }
    }
  } catch (error) {
    activeFilePath = null
    activeFileName = null
    useSessionStore.getState().setWorkspaceWatching(false)
    useSessionStore.getState().reportError(
      errorMessage(error, 'Failed to watch log file for changes'),
    )
  }
}

async function activateWorkspace(
  workspace: DesktopWorkspace,
  operation: number,
  remember = false,
): Promise<void> {
  await useSessionStore.getState().loadDirectory(workspace.files)
  if (operation !== generation || !useSessionStore.getState().workspaceName) return

  activeRootPath = workspace.rootPath
  try {
    const unwatch = await watchDesktopDirectory(workspace.rootPath, scheduleRefresh)
    if (operation !== generation) {
      unwatch()
      return
    }
    stopWatching = unwatch
    useSessionStore.getState().setWorkspaceWatching(true)
    if (remember) {
      try {
        await rememberDesktopDirectory(workspace.rootPath)
      } catch (error) {
        useSessionStore.getState().reportError(
          errorMessage(error, 'Failed to remember the recent workspace'),
        )
      }
    }
  } catch (error) {
    activeRootPath = null
    useSessionStore.getState().setWorkspaceWatching(false)
    useSessionStore.getState().reportError(
      errorMessage(error, 'Failed to watch workspace for changes'),
    )
  }
}

export async function restoreRecentDesktopSource(): Promise<void> {
  if (!isDesktopApp() || activeRootPath || activeFilePath) return
  const operation = ++generation
  try {
    const source = await readRecentDesktopSource()
    if (operation !== generation) return
    if (source) {
      teardownWorkspace()
      if ('rootPath' in source) await activateWorkspace(source, operation)
      else await activateFile(source, operation)
    }
  } catch (error) {
    useSessionStore.getState().reportError(
      errorMessage(error, 'Failed to restore the recent desktop source'),
    )
  }
}

async function activateFile(file: WorkspaceFile, operation: number): Promise<void> {
  const text = await file.text()
  if (operation !== generation) return
  useSessionStore.getState().loadText(text, file.name, file.filePath)
  if (!file.filePath || operation !== generation || !useSessionStore.getState().session) return
  activeFilePath = file.filePath
  activeFileName = file.name
  const unwatch = await watchDesktopFile(file.filePath, scheduleRefresh)
  if (operation !== generation) {
    unwatch()
    return
  }
  stopWatching = unwatch
  useSessionStore.getState().setWorkspaceWatching(true)
}

export async function stopDesktopWorkspace(): Promise<void> {
  generation += 1
  teardownWorkspace()
}

function teardownWorkspace(): void {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer)
    refreshTimer = null
  }
  stopWatching?.()
  stopWatching = null
  activeRootPath = null
  activeFilePath = null
  activeFileName = null
  refreshPending = false
  refreshInFlight = false
  useSessionStore.getState().setWorkspaceWatching(false)
}

function scheduleRefresh(): void {
  if (!activeRootPath && !activeFilePath) return
  if (refreshTimer !== null) window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null
    void refreshActiveSource()
  }, 350)
}

async function refreshActiveSource(): Promise<void> {
  const rootPath = activeRootPath
  const filePath = activeFilePath
  const fileName = activeFileName
  const operation = generation
  if (!rootPath && (!filePath || !fileName)) return
  if (refreshInFlight) {
    refreshPending = true
    return
  }

  refreshInFlight = true
  try {
    if (rootPath) {
      const workspace = await readDesktopDirectory(rootPath)
      if (operation !== generation || activeRootPath !== rootPath) return
      await useSessionStore.getState().loadDirectory(workspace.files, {
        preserveCurrentSession: true,
        resetFilters: false,
      })
    } else if (filePath && fileName) {
      const file = await readDesktopFile(filePath)
      const text = await file.text()
      if (operation !== generation || activeFilePath !== filePath) return
      useSessionStore.getState().loadText(text, fileName, filePath, {
        preserveSelection: true,
        resetFilters: false,
        retainLastValidSession: true,
      })
    }
  } catch (error) {
    if (operation === generation) {
      useSessionStore.getState().reportError(
        errorMessage(error, rootPath ? 'Failed to refresh workspace' : 'Failed to refresh log file'),
      )
    }
  } finally {
    refreshInFlight = false
    if (operation === generation && refreshPending) {
      refreshPending = false
      scheduleRefresh()
    }
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}
