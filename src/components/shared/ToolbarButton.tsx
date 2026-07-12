import type { ButtonHTMLAttributes } from 'react'
import { iconButton } from '../../styles/uiClasses'

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { }

export function ToolbarButton(props: ToolbarButtonProps) {
  const { children, className, ...restProps } = props;
  let realClassName = `inline-flex h-7 w-7 items-center justify-center rounded ${iconButton}`
  if (className) {
    realClassName += ` ${className}`
  }
  return (
    <button
      type="button"
      className={realClassName}
      {...restProps}
    >
      {children}
    </button>
  )
}
