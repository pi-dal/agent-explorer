interface ChevronToggleProps {
  expanded: boolean
  className?: string
}

export function ChevronToggle({ expanded, className = '' }: ChevronToggleProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
        expanded ? 'rotate-90' : ''
      } ${className}`}
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  )
}