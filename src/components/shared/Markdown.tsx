import { lazy, memo, Suspense } from 'react'
import { MarkdownLoadBoundary, MarkdownPlainText } from './MarkdownLoadBoundary'

/**
 * Markdown renderer for conversation messages — react-markdown + GFM.
 * Each element maps to themed Tailwind classes so output follows the
 * app's light/dark tokens. Supports headings, emphasis, inline & fenced
 * code, links, lists, blockquotes, GFM tables, and rules.
 */

export interface MarkdownProps {
  source: string
  className?: string
}

const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'))

export const Markdown = memo(function Markdown({ source, className }: MarkdownProps) {
  return (
    <MarkdownLoadBoundary
      source={source}
      className={className}
      onRetry={() => window.location.reload()}
    >
      <Suspense fallback={<MarkdownPlainText source={source} className={className} />}>
        <MarkdownRenderer source={source} className={className} />
      </Suspense>
    </MarkdownLoadBoundary>
  )
})
