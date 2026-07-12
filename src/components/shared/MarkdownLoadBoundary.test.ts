import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkdownLoadBoundary, MarkdownPlainText } from './MarkdownLoadBoundary'

describe('MarkdownLoadBoundary', () => {
  it('enters the fallback state after a renderer failure', () => {
    expect(MarkdownLoadBoundary.getDerivedStateFromError()).toEqual({ failed: true })
  })

  it('keeps the original text readable while formatting is unavailable', () => {
    const html = renderToStaticMarkup(createElement(MarkdownPlainText, {
      source: '**raw** <script>alert(1)</script>',
    }))

    expect(html).toContain('**raw** &lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('whitespace-pre-wrap')
  })
})
