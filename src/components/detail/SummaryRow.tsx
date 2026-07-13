import { CopyablePath } from '../shared/CopyablePath'

export function SummaryRow({
  label,
  value,
  copyable = false,
}: {
  label: string
  value: string
  copyable?: boolean
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-xs">
      <span className="text-secondary">{label}</span>
      {copyable ? <CopyablePath value={value} label={label.toLowerCase()} /> : (
        <span className="break-all font-mono text-primary">{value}</span>
      )}
    </div>
  )
}
