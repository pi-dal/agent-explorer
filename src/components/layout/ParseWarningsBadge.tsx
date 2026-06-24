import { AlertTriangle } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import {
  dropdownPanel,
  warningBadge,
  warningPanel,
  warningPanelItem,
} from '../../styles/uiClasses'
import type { ParseWarning } from '../../core/types'

interface ParseWarningsBadgeProps {
  warnings: ParseWarning[]
}

export function ParseWarningsBadge({ warnings }: ParseWarningsBadgeProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  if (warnings.length === 0) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium ${warningBadge}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <AlertTriangle size={12} strokeWidth={1.75} aria-hidden />
        {warnings.length} warning{warnings.length === 1 ? '' : 's'}
      </button>
      {open && (
        <div
          className={`absolute left-0 top-full z-20 mt-1 max-h-48 w-72 overflow-auto ${dropdownPanel} ${warningPanel}`}
        >
          <ul className="text-xs">
            {warnings.map((warning) => (
              <li
                key={`${warning.lineIndex}-${warning.message}`}
                className={`border-b px-3 py-1.5 last:border-b-0 ${warningPanelItem}`}
              >
                <span className="font-mono text-warning">
                  Line {warning.lineIndex}:
                </span>{' '}
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}