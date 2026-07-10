export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-xs">
      <span className="text-secondary">{label}</span>
      <span className="break-all font-mono text-primary">{value}</span>
    </div>
  )
}
