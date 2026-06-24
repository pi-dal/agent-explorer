import { useState } from 'react'
import {
  DETAIL_TEXT_LIMIT,
  isDetailTruncated,
  truncateDetailText,
} from '../../core/text'

interface ExpandablePreProps {
  text: string
  emptyLabel?: string
  className?: string
  mono?: boolean
}

export function ExpandablePre({
  text,
  emptyLabel = '(empty)',
  className = '',
  mono = true,
}: ExpandablePreProps) {
  const [expanded, setExpanded] = useState(false)
  const hasText = text.length > 0
  const canExpand = hasText && isDetailTruncated(text)
  const displayText =
    !hasText ? emptyLabel : expanded || !canExpand ? text : truncateDetailText(text)

  return (
    <div>
      <pre
        className={`max-h-72 overflow-auto whitespace-pre-wrap px-3 py-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 ${mono ? 'font-mono' : 'font-sans'} ${className}`}
      >
        {displayText}
      </pre>
      {canExpand && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setExpanded((value) => !value)
          }}
          className="px-3 pb-2 text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export { DETAIL_TEXT_LIMIT }