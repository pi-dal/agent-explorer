import { Check, Copy, ExternalLink, FolderSearch } from 'lucide-react'
import { useState } from 'react'
import { isDesktopApp } from '../../platform/workspaceSource'

function isAbsolutePath(value: string): boolean {
  return value.startsWith('/')
    || /^[A-Za-z]:[\\/]/.test(value)
    || value.startsWith('\\\\')
}

export function CopyPathButton({
  value,
  label = 'path',
}: {
  value: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        void copyPath()
      }}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-tertiary opacity-60 transition hover:bg-overlay hover:text-primary focus-visible:opacity-100"
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      title={copied ? 'Copied' : `Copy ${label}`}
    >
      {copied ? <Check size={12} strokeWidth={1.75} aria-hidden /> : <Copy size={12} strokeWidth={1.75} aria-hidden />}
    </button>
  )
}

export function OpenPathButton({
  value,
  label = 'path',
}: {
  value: string
  label?: string
}) {
  const [state, setState] = useState<'idle' | 'opened' | 'revealed' | 'failed'>('idle')

  async function openPath() {
    if (!isDesktopApp()) return
    try {
      const { openPath: openDesktopPath } = await import('@tauri-apps/plugin-opener')
      try {
        await openDesktopPath(value)
        setState('opened')
        window.setTimeout(() => setState('idle'), 1500)
      } catch {
        const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
        await revealItemInDir(value)
        setState('revealed')
        window.setTimeout(() => setState('idle'), 1800)
      }
    } catch {
      setState('failed')
      window.setTimeout(() => setState('idle'), 2000)
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        void openPath()
      }}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-tertiary opacity-60 transition hover:bg-overlay hover:text-primary focus-visible:opacity-100 ${state === 'failed' ? 'text-danger opacity-100' : ''}`}
      aria-label={state === 'opened' ? `${label} opened` : state === 'revealed' ? `${label} revealed in folder` : state === 'failed' ? `Failed to open ${label}` : `Open ${label}`}
      title={state === 'opened' ? 'Opened' : state === 'revealed' ? 'Shown in folder' : state === 'failed' ? 'Failed to open' : `Open ${label}`}
    >
      {state === 'opened' ? <Check size={12} strokeWidth={1.75} aria-hidden /> : state === 'revealed' ? <FolderSearch size={12} strokeWidth={1.75} aria-hidden /> : <ExternalLink size={12} strokeWidth={1.75} aria-hidden />}
    </button>
  )
}

export function PathActions({
  value,
  label = 'path',
}: {
  value: string
  label?: string
}) {
  const canOpen = isDesktopApp() && isAbsolutePath(value)
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <CopyPathButton value={value} label={label} />
      {canOpen && <OpenPathButton value={value} label={label} />}
    </span>
  )
}

export function CopyablePath({
  value,
  label = 'path',
}: {
  value: string
  label?: string
}) {
  return (
    <span className="group/copy-path flex min-w-0 items-start gap-1.5">
      <span className="min-w-0 break-all font-mono text-primary" title={value}>{value}</span>
      <PathActions value={value} label={label} />
    </span>
  )
}
