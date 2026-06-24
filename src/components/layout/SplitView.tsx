import type { ReactNode } from 'react'
import { useSplitLayout } from './useSplitLayout'

const HANDLE_WIDTH = 6

interface SplitViewProps {
  left: ReactNode
  center: ReactNode
  right: ReactNode
}

function SplitHandle({
  left,
  active,
  onPointerDown,
}: {
  left: number
  active: boolean
  onPointerDown: (clientX: number) => void
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={`split-handle ${active ? 'split-handle-active' : ''}`}
      style={{ left: left - HANDLE_WIDTH / 2, width: HANDLE_WIDTH }}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        onPointerDown(event.clientX)
      }}
    />
  )
}

function SplitPane({
  style,
  children,
}: {
  style: { left: number; width: number }
  children: ReactNode
}) {
  return (
    <div className="split-pane" style={style}>
      {children}
    </div>
  )
}

export function SplitView({ left, center, right }: SplitViewProps) {
  const { containerRef, rects, activeHandle, startLeftDrag, startRightDrag } =
    useSplitLayout()

  return (
    <div ref={containerRef} className="split-view">
      {rects ? (
        <>
          <SplitPane style={rects.left}>{left}</SplitPane>
          <SplitHandle
            left={rects.leftHandle.left}
            active={activeHandle === 'left'}
            onPointerDown={startLeftDrag}
          />
          <SplitPane style={rects.center}>{center}</SplitPane>
          <SplitHandle
            left={rects.rightHandle.left}
            active={activeHandle === 'right'}
            onPointerDown={startRightDrag}
          />
          <SplitPane style={rects.right}>{right}</SplitPane>
        </>
      ) : (
        <>
          <div className="split-pane split-pane-fallback">{left}</div>
          <div className="split-pane split-pane-fallback split-pane-center">{center}</div>
          <div className="split-pane split-pane-fallback">{right}</div>
        </>
      )}
    </div>
  )
}