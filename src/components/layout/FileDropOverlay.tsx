import { Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { textBody, textMuted } from '../../styles/uiClasses'
import { useSessionStore } from '../../store/sessionStore'

function isAcceptedSessionFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return lower.endsWith('.jsonl') || lower.endsWith('.json')
}

function dragContainsFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false
}

export function FileDropOverlay({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const depthRef = useRef(0)
  const loadText = useSessionStore((s) => s.loadText)

  const resetDragState = useCallback(() => {
    depthRef.current = 0
    setActive(false)
  }, [])

  const loadFile = useCallback(
    (file: File) => {
      if (!isAcceptedSessionFile(file)) return
      void file.text().then((text) => loadText(text, file.name))
    },
    [loadText],
  )

  useEffect(() => {
    function handleDragEnter(event: DragEvent) {
      if (!dragContainsFiles(event)) return
      event.preventDefault()
      depthRef.current += 1
      setActive(true)
    }

    function handleDragLeave(event: DragEvent) {
      if (!dragContainsFiles(event)) return
      event.preventDefault()
      depthRef.current = Math.max(0, depthRef.current - 1)
      if (depthRef.current === 0) setActive(false)
    }

    function handleDragOver(event: DragEvent) {
      if (!dragContainsFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }

    function handleDrop(event: DragEvent) {
      if (!dragContainsFiles(event)) return
      event.preventDefault()
      const file = event.dataTransfer?.files?.[0]
      resetDragState()
      if (file) loadFile(file)
    }

    function handleDragEnd() {
      resetDragState()
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)
    window.addEventListener('dragend', handleDragEnd)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('dragend', handleDragEnd)
    }
  }, [loadFile, resetDragState])

  return (
    <>
      {children}
      {active && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/75 backdrop-blur-sm"
          aria-hidden={!active}
        >
          <div className="rounded-2xl border-2 border-dashed border-accent-border bg-surface px-16 py-12 text-center shadow-lg">
            <Upload
              className="mx-auto mb-3 text-muted-foreground"
              size={36}
              strokeWidth={1.5}
              aria-hidden
            />
            <p className={`text-lg font-medium ${textBody}`}>Drop file to open</p>
            <p className={`mt-1 text-sm ${textMuted}`}>JSONL or JSON session logs</p>
          </div>
        </div>
      )}
    </>
  )
}