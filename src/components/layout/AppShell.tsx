import { useEffect } from 'react'
import { useSessionStore } from '../../store/sessionStore'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { DetailPanel } from '../detail/DetailPanel'
import { TimelinePanel } from '../timeline/TimelinePanel'
import { ResizableLayout } from './ResizableLayout'
import { StatusBar } from './StatusBar'

export function AppShell() {
  const theme = useSessionStore((s) => s.theme)
  const setTheme = useSessionStore((s) => s.setTheme)

  useEffect(() => {
    setTheme(theme)
  }, [theme, setTheme])

  useEffect(() => {
    function handleDragOver(event: DragEvent) {
      event.preventDefault()
    }

    function handleDrop(event: DragEvent) {
      event.preventDefault()
      const file = event.dataTransfer?.files?.[0]
      if (!file) return
      void file.text().then((text) => {
        useSessionStore.getState().loadText(text, file.name)
      })
    }

    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [])

  return (
    <div className="flex h-full w-full flex-col">
      <StatusBar />
      <ResizableLayout
        timeline={<TimelinePanel />}
        conversation={<ConversationPanel />}
        detail={<DetailPanel />}
      />
    </div>
  )
}