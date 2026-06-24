import { Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../../store/settingsStore'

function SettingsSection({ title }: { title: string }) {
  return (
    <div className="border-b border-zinc-200 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:border-zinc-800">
      {title}
    </div>
  )
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-900">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5"
      />
      <span>
        <span className="block text-xs font-medium text-zinc-800 dark:text-zinc-200">
          {label}
        </span>
        <span className="block text-[10px] text-zinc-500">{description}</span>
      </span>
    </label>
  )
}

export function SettingsPopover() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const hideSystem = useSettingsStore((s) => s.hideSystem)
  const hideThinking = useSettingsStore((s) => s.hideThinking)
  const hideToolCalls = useSettingsStore((s) => s.hideToolCalls)
  const setHideSystem = useSettingsStore((s) => s.setHideSystem)
  const setHideThinking = useSettingsStore((s) => s.setHideThinking)
  const setHideToolCalls = useSettingsStore((s) => s.setHideToolCalls)
  const syncSelection = useSettingsStore((s) => s.syncSelection)
  const setSyncSelection = useSettingsStore((s) => s.setSyncSelection)

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        aria-label="Settings"
        aria-expanded={open}
        title="Settings"
      >
        <Settings size={14} strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
          <SettingsSection title="Display" />
          <SettingToggle
            label="Hide system / meta"
            description="Remove meta snapshots and system items from timeline and conversation."
            checked={hideSystem}
            onChange={setHideSystem}
          />
          <SettingToggle
            label="Hide thinking"
            description="Hide thinking blocks from the conversation panel."
            checked={hideThinking}
            onChange={setHideThinking}
          />
          <SettingToggle
            label="Hide tool calls"
            description="Hide tool_use and tool_result items from timeline and conversation."
            checked={hideToolCalls}
            onChange={setHideToolCalls}
          />
          <SettingsSection title="Behavior" />
          <SettingToggle
            label="Sync selection"
            description="Link timeline and conversation selection, scrolling, and highlights."
            checked={syncSelection}
            onChange={setSyncSelection}
          />
        </div>
      )}
    </div>
  )
}