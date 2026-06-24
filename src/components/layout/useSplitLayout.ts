import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_LEFT_WIDTH,
  DEFAULT_RIGHT_WIDTH,
  clampLeftWidth,
  clampRightWidth,
  computePaneRects,
  fitLayout,
  persistLayout,
  readStoredLayout,
  type SplitLayout,
} from './splitLayout'

export function useSplitLayout() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [layout, setLayout] = useState<SplitLayout>(() => {
    const stored = readStoredLayout()
    return stored ?? {
      leftWidth: DEFAULT_LEFT_WIDTH,
      rightWidth: DEFAULT_RIGHT_WIDTH,
    }
  })
  const [activeHandle, setActiveHandle] = useState<'left' | 'right' | null>(null)
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      setContainerWidth(width)
      setLayout((current) => fitLayout(current, width))
    })

    observer.observe(element)
    setContainerWidth(element.getBoundingClientRect().width)

    return () => observer.disconnect()
  }, [])

  const rects =
    containerWidth > 0 ? computePaneRects(layout, containerWidth) : null

  const startLeftDrag = useCallback(
    (clientX: number) => {
      const container = containerRef.current
      if (!container) return

      const bounds = container.getBoundingClientRect()
      const startX = clientX
      const startLeft = layoutRef.current.leftWidth

      setActiveHandle('left')

      function onMove(moveX: number) {
        const delta = moveX - startX
        setLayout((current) => ({
          ...current,
          leftWidth: clampLeftWidth(
            startLeft + delta,
            current.rightWidth,
            bounds.width,
          ),
        }))
      }

      function onPointerMove(event: PointerEvent) {
        onMove(event.clientX)
      }

      function onPointerUp() {
        setActiveHandle(null)
        setLayout((current) => {
          const fitted = fitLayout(current, bounds.width)
          persistLayout(fitted)
          return fitted
        })
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    },
    [],
  )

  const startRightDrag = useCallback(
    (clientX: number) => {
      const container = containerRef.current
      if (!container) return

      const bounds = container.getBoundingClientRect()
      const startX = clientX
      const startRight = layoutRef.current.rightWidth

      setActiveHandle('right')

      function onMove(moveX: number) {
        const delta = startX - moveX
        setLayout((current) => ({
          ...current,
          rightWidth: clampRightWidth(
            startRight + delta,
            current.leftWidth,
            bounds.width,
          ),
        }))
      }

      function onPointerMove(event: PointerEvent) {
        onMove(event.clientX)
      }

      function onPointerUp() {
        setActiveHandle(null)
        setLayout((current) => {
          const fitted = fitLayout(current, bounds.width)
          persistLayout(fitted)
          return fitted
        })
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    },
    [],
  )

  return {
    containerRef,
    rects,
    activeHandle,
    startLeftDrag,
    startRightDrag,
  }
}