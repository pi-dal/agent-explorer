import { Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { dropdownPanel, sectionDivider } from '../../styles/uiClasses'
import { ToolbarButton } from '../shared/ToolbarButton'
import { useSettingsStore } from '../../store/settingsStore'

function SettingsSection({ title }: { title: string }) {
  return (
    <div className={`px-3 py-2 text-[10px] text-tertiary font-semibold uppercase tracking-wider ${sectionDivider}`}>
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
    <label className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-overlay">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5"
      />
      <span>
        <span className="block text-xs font-medium text-primary">{label}</span>
        <span className="block text-[10px] text-secondary">{description}</span>
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
  const highlightSameRequest = useSettingsStore((s) => s.highlightSameRequest)
  const setSyncSelection = useSettingsStore((s) => s.setSyncSelection)
  const setHighlightSameRequest = useSettingsStore((s) => s.setHighlightSameRequest)

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
      <ToolbarButton
        onClick={() => setOpen((value) => !value)}
        aria-label="Settings"
        aria-expanded={open}
        title="Settings"
      >
        <Settings size={14} strokeWidth={1.75} aria-hidden />
      </ToolbarButton>
      {open && (
        <div className={`absolute right-0 top-full z-20 mt-1 w-64 ${dropdownPanel}`}>
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
          <SettingToggle
            label="Highlight same request"
            description="In the timeline, highlight other events that share the selected event's request ID."
            checked={highlightSameRequest}
            onChange={setHighlightSameRequest}
          />
        </div>
      )}
    </div>
  )
}
