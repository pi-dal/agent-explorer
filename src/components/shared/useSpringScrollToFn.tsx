import { useEffectEvent } from 'react'
import { type VirtualizerOptions, elementScroll } from '@tanstack/react-virtual'
import { animate, spring } from 'animejs'

type ScrollToFn = VirtualizerOptions<any, any>['scrollToFn']

interface SpringOptions {
  duration?: number
}

export function useSpringScrollToFn(springOptions?: SpringOptions): ScrollToFn {
  return useEffectEvent((offset, options, instance) => {
    const scrollElement = instance.scrollElement as Element
    const modifiedOptions = { ...options, behavior: undefined }
    const target = { offset: instance.scrollOffset ?? 0 }
    const duration = springOptions?.duration ?? 250

    let cleanup  = () => {}
    const animation = animate(target, {
      offset,
      ease: spring({ bounce: 0, duration }),
      onUpdate: () => {
        elementScroll(target.offset, modifiedOptions, instance)
      },
      onComplete: () => {
        cleanup()
      }
    })

    const wheelHandler = () => {
      animation.cancel()
      cleanup()
    }
    scrollElement.addEventListener('wheel', wheelHandler, { passive: true })
    cleanup = () => {
      scrollElement.removeEventListener('wheel', wheelHandler)
    }
  })
}
