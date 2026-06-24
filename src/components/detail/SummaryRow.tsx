import { textMono, textMuted } from '../../styles/uiClasses'

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-xs">
      <span className={textMuted}>{label}</span>
      <span className={`break-all ${textMono}`}>{value}</span>
    </div>
  )
}