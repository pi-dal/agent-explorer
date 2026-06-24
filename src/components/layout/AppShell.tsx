import { useEffect } from 'react'
import { useSessionStore } from '../../store/sessionStore'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { DetailPanel } from '../detail/DetailPanel'
import { TimelinePanel } from '../timeline/TimelinePanel'
import { StatusBar } from '../status/StatusBar'
import { FileDropOverlay } from './FileDropOverlay'
import { ResizableLayout } from './ResizableLayout'

export function AppShell() {
  const theme = useSessionStore((s) => s.theme)
  const setTheme = useSessionStore((s) => s.setTheme)

  useEffect(() => {
    setTheme(theme)
  }, [theme, setTheme])

  return (
    <FileDropOverlay>
      <div className="flex h-full w-full flex-col">
        <StatusBar />
        <ResizableLayout
          timeline={<TimelinePanel />}
          conversation={<ConversationPanel />}
          detail={<DetailPanel />}
        />
      </div>
    </FileDropOverlay>
  )
}