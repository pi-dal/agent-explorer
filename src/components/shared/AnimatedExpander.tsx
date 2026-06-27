import { useLayoutEffect, useRef, useState, type PropsWithChildren } from 'react'
import { flushSync } from 'react-dom'
import { animate, JSAnimation, spring } from 'animejs'

interface AnimatedExpanderProps extends PropsWithChildren {
  expanded: boolean
}

const STATE_ANIMATING = 0
const STATE_FINAL_VISIBLE = 1
const STATE_FINAL_HIDDEN = 2

type State =
  | typeof STATE_ANIMATING
  | typeof STATE_FINAL_VISIBLE
  | typeof STATE_FINAL_HIDDEN

export function AnimatedExpander(props: AnimatedExpanderProps) {
  const { expanded } = props
  const targetState = expanded ? STATE_FINAL_VISIBLE : STATE_FINAL_HIDDEN

  const elementRef = useRef<HTMLDivElement | null>(null)
  const animationRef = useRef<JSAnimation | null>(null)
  const [state, setState] = useState<State>(targetState)

  useLayoutEffect(() => {
    animationRef.current?.cancel()

    if (state !== STATE_ANIMATING) {
      return
    }

    const element = elementRef.current
    if (!element) {
      return
    }

    const to_visible = targetState === STATE_FINAL_VISIBLE
    const previousHeight = element.style.height || (to_visible
      ? '0px'
      : `${element.getBoundingClientRect().height}px`
    )

    if (to_visible) {
      element.style.height = 'auto'
    }
    const targetHeight = to_visible
      ? element.getBoundingClientRect().height
      : 0
    const targetOpacity = to_visible ? 1 : 0

    element.style.height = previousHeight
    if (to_visible && !element.style.opacity) {
      element.style.opacity = '0'
    }
    animationRef.current = animate(element, {
      height: targetHeight,
      opacity: targetOpacity,
      ease: spring({ bounce: 0, duration: 300 }),
      onComplete: () => {
        flushSync(() => {
          setState(targetState)
        })
        element.style.height = ''
        element.style.opacity = ''
        animationRef.current = null
      }
    })
  }, [targetState, elementRef, animationRef, state, setState])

  useLayoutEffect(() => {
    return () => {
      animationRef.current?.cancel()
    }
  }, [animationRef])

  if (state !== STATE_ANIMATING && state !== targetState) {
    setState(STATE_ANIMATING)
    return
  }

  return (
    <div ref={elementRef}>
      {state !== STATE_FINAL_HIDDEN ? props.children : null}
    </div>
  )
}
