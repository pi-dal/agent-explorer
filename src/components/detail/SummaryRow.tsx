export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-xs">
      <span className="text-zinc-500">{label}</span>
      <span className="break-all font-mono text-zinc-800 dark:text-zinc-200">{value}</span>
    </div>
  )
}