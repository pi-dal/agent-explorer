import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import {
  overlayIconButton,
  textExpandButton,
} from '../../styles/uiClasses'
import { ChevronToggle } from '../shared/ChevronToggle'
import { ExpandablePre } from '../shared/ExpandablePre'
import { ToolbarButton } from '../shared/ToolbarButton'

const STRING_LIMIT = 200
const LEVEL_INDENT = '2ch'

interface CollapsibleJsonProps {
  value: unknown
  defaultExpanded?: boolean
}

function JsonNode({
  name,
  value,
  depth,
  defaultExpanded,
}: {
  name?: string
  value: unknown
  depth: number
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? depth < 2)
  const [stringExpanded, setStringExpanded] = useState(false)

  const prefix =
    name !== undefined ? (
      <span className="text-syntax-key">{name}: </span>
    ) : null

  if (value === null) {
    return (
      <div style={depth > 1 ? { paddingLeft: LEVEL_INDENT } : undefined} className="font-mono text-xs leading-5">
        {prefix}
        <span className="text-secondary">null</span>
      </div>
    )
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return (
      <div style={depth > 1 ? { paddingLeft: LEVEL_INDENT } : undefined} className="font-mono text-xs leading-5">
        {prefix}
        <span className="text-syntax-number">{String(value)}</span>
      </div>
    )
  }

  if (typeof value === 'string') {
    const displayValue = value.includes('\n') ? value : value.replace(/\\n/g, '\n')
    if (displayValue.includes('\n')) {
      return (
        <div style={depth > 1 ? { paddingLeft: LEVEL_INDENT } : undefined} className="font-mono text-xs leading-5">
          {prefix}
          <ExpandablePre
            text={displayValue}
            className="mt-1 rounded border border-separator bg-under-page-background px-2.5 py-2"
          />
        </div>
      )
    }
    const showFull = stringExpanded || displayValue.length <= STRING_LIMIT
    const display = showFull ? displayValue : `${displayValue.slice(0, STRING_LIMIT)}…`
    return (
      <div style={depth > 1 ? { paddingLeft: LEVEL_INDENT } : undefined} className="font-mono text-xs leading-5">
        {prefix}
        <span className="break-all text-syntax-string">"{display}"</span>
        {value.length > STRING_LIMIT && (
          <button
            type="button"
            onClick={() => setStringExpanded((v) => !v)}
            className={`ml-2 text-[10px] ${textExpandButton}`}
          >
            {stringExpanded ? 'collapse' : 'expand'}
          </button>
        )}
      </div>
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div style={depth > 1 ? { paddingLeft: LEVEL_INDENT } : undefined} className="font-mono text-xs leading-5">
          {prefix}
          <span className="text-secondary">[]</span>
        </div>
      )
    }
    return (
      <div style={depth > 1 ? { paddingLeft: LEVEL_INDENT } : undefined} className="font-mono text-xs leading-5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`inline-flex items-center gap-1 text-left ${textExpandButton}`}
        >
          {prefix}
          <ChevronToggle expanded={expanded} className="text-secondary" />
          <span className="text-secondary">Array[{value.length}]</span>
        </button>
        {expanded &&
          value.map((item, index) => (
            <JsonNode
              key={index}
              name={String(index)}
              value={item}
              depth={depth + 1}
              defaultExpanded={depth < 1}
            />
          ))}
      </div>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      return (
        <div style={depth > 1 ? { paddingLeft: LEVEL_INDENT } : undefined} className="font-mono text-xs leading-5">
          {prefix}
          <span className="text-secondary">{'{}'}</span>
        </div>
      )
    }
    return (
      <div style={depth > 1 ? { paddingLeft: LEVEL_INDENT } : undefined} className="font-mono text-xs leading-5">
        {depth === 0 ? null : (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`inline-flex items-center gap-1 text-left ${textExpandButton}`}
          >
            {prefix}
            <ChevronToggle expanded={expanded} className="text-secondary" />
            <span className="text-secondary">Object({entries.length})</span>
          </button>
        )}
        {(depth === 0 || expanded) &&
          entries.map(([key, child]) => (
            <JsonNode
              key={key}
              name={key}
              value={child}
              depth={depth + 1}
              defaultExpanded={depth < 1}
            />
          ))}
      </div>
    )
  }

  return null
}

export function CollapsibleJson({ value, defaultExpanded }: CollapsibleJsonProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="group relative">
      <ToolbarButton
        onClick={handleCopy}
        className={`absolute right-0 top-0 z-10 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 ${overlayIconButton}`}
        aria-label={copied ? 'Copied' : 'Copy JSON'}
        title={copied ? 'Copied' : 'Copy JSON'}
      >
        {copied ? (
          <Check size={14} strokeWidth={1.75} aria-hidden />
        ) : (
          <Copy size={14} strokeWidth={1.75} aria-hidden />
        )}
      </ToolbarButton>
      <JsonNode value={value} depth={0} defaultExpanded={defaultExpanded} />
    </div>
  )
}
