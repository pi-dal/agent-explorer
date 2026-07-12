import { useEffect } from 'react'
import { useSessionStore } from '../../store/sessionStore'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { DetailPanel } from '../detail/DetailPanel'
import { TimelinePanel } from '../timeline/TimelinePanel'
import { StatusBar } from '../status/StatusBar'
import { FileDropOverlay } from './FileDropOverlay'
import { ResizableLayout } from './ResizableLayout'
import {
  restoreRecentDesktopSource,
  stopDesktopWorkspace,
} from '../../platform/desktopWorkspaceController'
import { isDesktopApp } from '../../platform/workspaceSource'
import {
  listenForDesktopActions,
  listenForSystemOpenedLogs,
  takeSystemOpenedLogs,
} from '../../platform/desktopActions'
import { startBackgroundUpdateCheck } from '../../platform/desktopUpdater'

export function AppShell() {
  const theme = useSessionStore((s) => s.theme)
  const session = useSessionStore((s) => s.session)
  const setTheme = useSessionStore((s) => s.setTheme)
  const sessionKey = session
    ? `${session.sourceFilePath ?? session.sourcePath ?? session.fileName}:${session.meta.sessionId ?? ''}`
    : 'empty'

  useEffect(() => {
    setTheme(theme)
  }, [theme, setTheme])

  useEffect(() => {
    if (!isDesktopApp()) return
    startBackgroundUpdateCheck()
    let cancelled = false
    const disposers: Array<() => void> = []
    void Promise.all([listenForDesktopActions(), listenForSystemOpenedLogs()])
      .then(async listeners => {
        if (cancelled) {
          listeners.forEach(dispose => dispose())
          return
        }
        disposers.push(...listeners)
        if (!await takeSystemOpenedLogs()) await restoreRecentDesktopSource()
      })
      .catch(error => {
        useSessionStore.getState().reportError(
          error instanceof Error ? error.message : 'Failed to initialize desktop integration',
        )
      })
    return () => {
      cancelled = true
      disposers.forEach(dispose => dispose())
      void stopDesktopWorkspace()
    }
  }, [])

  return (
    <FileDropOverlay>
      <div className="flex h-full w-full flex-col">
        <StatusBar />
        <ResizableLayout
          timeline={<TimelinePanel key={sessionKey} />}
          conversation={<ConversationPanel key={sessionKey} />}
          detail={<DetailPanel />}
        />
      </div>
    </FileDropOverlay>
  )
}
