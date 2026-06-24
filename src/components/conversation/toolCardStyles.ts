export function toolCardBorderClass({
  selected,
  pairHighlighted,
  isFailed = false,
}: {
  selected: boolean
  pairHighlighted: boolean
  isFailed?: boolean
}): string {
  if (selected) {
    return 'border-sky-400 ring-1 ring-sky-400/40'
  }
  if (pairHighlighted) {
    return 'border-violet-400 bg-violet-50/80 ring-1 ring-violet-400/35 dark:border-violet-500 dark:bg-violet-950/30 dark:ring-violet-500/30'
  }
  if (isFailed) {
    return 'border-red-200 dark:border-red-900/60'
  }
  return 'border-zinc-200 dark:border-zinc-700'
}