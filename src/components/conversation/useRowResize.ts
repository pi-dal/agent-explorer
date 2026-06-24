import { useLayoutEffect, useRef } from 'react'

/** Re-measure virtual row after expand/collapse commits to the DOM. */
export function useRowResize(expanded: boolean, onLayoutChange?: () => void) {
  const onLayoutChangeRef = useRef(onLayoutChange)
  onLayoutChangeRef.current = onLayoutChange

  useLayoutEffect(() => {
    onLayoutChangeRef.current?.()
  }, [expanded])
}