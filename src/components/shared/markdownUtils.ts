const codeSpanPattern = /(`{3,}[\s\S]*?`{3,}|`[^`\n]*`)/g
const spacedClosingAsteriskPattern = /(?<![\p{L}\p{N}])(\*{1,3})([^*\n]*?\S)\s+\1/gu
const spacedClosingUnderscorePattern = /(?<![\p{L}\p{N}])(_{1,3})([^_\n]*?\S)\s+\1/gu

/**
 * Agent-written Markdown occasionally puts the whitespace before an emphasis
 * closing marker (`**label: **text`). CommonMark treats that marker as text,
 * which is surprising in a conversation viewer. Repair only plain-text
 * segments so code spans and fenced code remain byte-for-byte unchanged.
 */
export function normalizeMarkdown(source: string): string {
  return source
    .split(codeSpanPattern)
    .map((segment, index) => (
      index % 2 === 0
        ? segment
          .replace(spacedClosingAsteriskPattern, '$1$2$1 ')
          .replace(spacedClosingUnderscorePattern, '$1$2$1 ')
        : segment
    ))
    .join('')
}
