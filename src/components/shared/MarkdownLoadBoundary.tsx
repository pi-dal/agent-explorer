import { Component, type ErrorInfo, type PropsWithChildren } from 'react'
import type { MarkdownProps } from './Markdown'

interface MarkdownLoadBoundaryProps extends PropsWithChildren, MarkdownProps {
  onRetry: () => void
}

interface MarkdownLoadBoundaryState {
  failed: boolean
}

export function MarkdownPlainText({ source, className }: MarkdownProps) {
  return (
    <div className={`whitespace-pre-wrap text-sm leading-relaxed wrap-break-word ${className ?? ''}`}>
      {source}
    </div>
  )
}

export class MarkdownLoadBoundary extends Component<
  MarkdownLoadBoundaryProps,
  MarkdownLoadBoundaryState
> {
  state: MarkdownLoadBoundaryState = { failed: false }

  static getDerivedStateFromError(): MarkdownLoadBoundaryState {
    return { failed: true }
  }

  componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    // The raw message remains available below; the failure is isolated to this bubble.
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <div>
        <MarkdownPlainText source={this.props.source} className={this.props.className} />
        <button
          type="button"
          onClick={this.props.onRetry}
          className="mt-1 text-[10px] text-tertiary underline underline-offset-2 hover:text-secondary focus-visible:text-secondary"
        >
          Reload formatted view
        </button>
      </div>
    )
  }
}
