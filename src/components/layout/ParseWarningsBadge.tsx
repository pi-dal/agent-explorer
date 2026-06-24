import { AlertTriangle } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
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
        className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <AlertTriangle size={12} strokeWidth={1.75} aria-hidden />
        {warnings.length} warning{warnings.length === 1 ? '' : 's'}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-72 overflow-auto rounded border border-amber-200 bg-white py-1 shadow-lg dark:border-amber-900/60 dark:bg-zinc-950">
          <ul className="text-xs text-amber-900 dark:text-amber-200">
            {warnings.map((warning) => (
              <li
                key={`${warning.lineIndex}-${warning.message}`}
                className="border-b border-amber-100 px-3 py-1.5 last:border-b-0 dark:border-amber-900/40"
              >
                <span className="font-mono text-amber-700 dark:text-amber-400">
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