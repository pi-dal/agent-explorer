import type { ReactNode } from 'react'
import { SplitView } from './SplitView'

interface ResizableLayoutProps {
  timeline: ReactNode
  conversation: ReactNode
  detail: ReactNode
}

export function ResizableLayout({ timeline, conversation, detail }: ResizableLayoutProps) {
  return (
    <SplitView
      left={timeline}
      center={conversation}
      right={detail}
    />
  )
}