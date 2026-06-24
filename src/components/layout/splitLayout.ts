export const LAYOUT_STORAGE_KEY = 'agent-explorer-split-layout'

export const DEFAULT_LEFT_WIDTH = 320
export const DEFAULT_RIGHT_WIDTH = 380

export const MIN_LEFT_WIDTH = 220
export const MIN_RIGHT_WIDTH = 260
export const MIN_CENTER_WIDTH = 320

export interface SplitLayout {
  leftWidth: number
  rightWidth: number
}

export function readStoredLayout(): SplitLayout | null {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SplitLayout
    if (
      typeof parsed.leftWidth === 'number' &&
      typeof parsed.rightWidth === 'number' &&
      Number.isFinite(parsed.leftWidth) &&
      Number.isFinite(parsed.rightWidth)
    ) {
      return parsed
    }
  } catch {
    // ignore invalid persisted layout
  }
  return null
}

export function persistLayout(layout: SplitLayout) {
  localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function maxSideWidth(containerWidth: number): number {
  return Math.max(0, containerWidth - MIN_CENTER_WIDTH)
}

export function fitLayout(
  layout: SplitLayout,
  containerWidth: number,
): SplitLayout {
  const maxSides = maxSideWidth(containerWidth)
  if (maxSides <= 0) {
    return {
      leftWidth: MIN_LEFT_WIDTH,
      rightWidth: MIN_RIGHT_WIDTH,
    }
  }

  let left = clamp(layout.leftWidth, MIN_LEFT_WIDTH, maxSides)
  let right = clamp(layout.rightWidth, MIN_RIGHT_WIDTH, maxSides)

  if (left + right <= maxSides) {
    return { leftWidth: left, rightWidth: right }
  }

  const total = left + right
  left = Math.round((left / total) * maxSides)
  right = maxSides - left

  left = clamp(left, MIN_LEFT_WIDTH, maxSides - MIN_RIGHT_WIDTH)
  right = maxSides - left

  return { leftWidth: left, rightWidth: right }
}

export function computePaneRects(
  layout: SplitLayout,
  containerWidth: number,
): {
  left: { left: number; width: number }
  center: { left: number; width: number }
  right: { left: number; width: number }
  leftHandle: { left: number }
  rightHandle: { left: number }
} {
  const fitted = fitLayout(layout, containerWidth)
  const centerWidth = Math.max(
    MIN_CENTER_WIDTH,
    containerWidth - fitted.leftWidth - fitted.rightWidth,
  )

  const left = { left: 0, width: fitted.leftWidth }
  const centerLeft = fitted.leftWidth
  const center = { left: centerLeft, width: centerWidth }
  const right = {
    left: centerLeft + centerWidth,
    width: fitted.rightWidth,
  }

  return {
    left,
    center,
    right,
    leftHandle: { left: fitted.leftWidth },
    rightHandle: { left: centerLeft + centerWidth },
  }
}

export function clampLeftWidth(
  nextLeft: number,
  rightWidth: number,
  containerWidth: number,
): number {
  const maxLeft = containerWidth - rightWidth - MIN_CENTER_WIDTH
  return clamp(nextLeft, MIN_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, maxLeft))
}

export function clampRightWidth(
  nextRight: number,
  leftWidth: number,
  containerWidth: number,
): number {
  const maxRight = containerWidth - leftWidth - MIN_CENTER_WIDTH
  return clamp(nextRight, MIN_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, maxRight))
}