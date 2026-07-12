import { Check, Download, RefreshCw, RotateCw } from 'lucide-react'
import { useUpdateStore } from '../../store/updateStore'
import {
  checkForDesktopUpdate,
  downloadAndInstallDesktopUpdate,
  restartAfterDesktopUpdate,
} from '../../platform/desktopUpdater'
import { ToolbarButton } from '../shared/ToolbarButton'

export function DesktopUpdateButton() {
  const status = useUpdateStore(state => state.status)
  const version = useUpdateStore(state => state.version)
  const progress = useUpdateStore(state => state.progress)
  const error = useUpdateStore(state => state.error)

  const percent = progress === null ? null : Math.round(progress * 100)
  const label = status === 'available'
    ? `Install Agent Explorer ${version}`
    : status === 'downloading'
      ? percent === null ? 'Downloading update' : `Downloading update: ${percent}%`
      : status === 'ready'
        ? 'Restart to finish update'
        : status === 'current'
          ? 'Agent Explorer is up to date'
          : status === 'error'
            ? `Update failed: ${error ?? 'unknown error'}. Click to retry.`
            : status === 'checking'
              ? 'Checking for updates'
              : 'Check for updates'

  async function act() {
    if (status === 'available') await downloadAndInstallDesktopUpdate()
    else if (status === 'ready') await restartAfterDesktopUpdate()
    else if (status !== 'checking' && status !== 'downloading') await checkForDesktopUpdate(false)
  }

  return (
    <ToolbarButton
      onClick={() => void act()}
      disabled={status === 'checking' || status === 'downloading'}
      aria-label={label}
      title={label}
      className={status === 'available' || status === 'ready' ? 'text-accent' : undefined}
    >
      {status === 'available' ? (
        <Download size={14} strokeWidth={1.75} aria-hidden />
      ) : status === 'ready' ? (
        <RotateCw size={14} strokeWidth={1.75} aria-hidden />
      ) : status === 'current' ? (
        <Check size={14} strokeWidth={1.75} aria-hidden />
      ) : (
        <RefreshCw
          size={14}
          strokeWidth={1.75}
          className={status === 'checking' || status === 'downloading' ? 'animate-spin' : undefined}
          aria-hidden
        />
      )}
    </ToolbarButton>
  )
}
