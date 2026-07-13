import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import MarkdownRenderer from './MarkdownRenderer'
import { normalizeMarkdown } from './markdownUtils'

function render(source: string): string {
  return renderToStaticMarkup(createElement(MarkdownRenderer, { source }))
}

describe('MarkdownRenderer', () => {
  it('renders standard emphasis and strong emphasis', () => {
    const html = render('*italic* and _italic_ and **strong**')

    expect(html).toContain('<em class="italic">italic</em>')
    expect(html).toContain('<strong class="font-semibold">strong</strong>')
  })

  it('repairs whitespace before a closing emphasis marker', () => {
    const html = render('**一句话概括： **这是一个实验室')

    expect(html).toContain('<strong class="font-semibold">一句话概括：</strong> 这是一个实验室')
  })

  it('does not rewrite code spans or fenced code', () => {
    const source = '`**raw **`\n\n```md\n**raw **\n```'

    expect(normalizeMarkdown(source)).toBe(source)
  })
})
