export const PREVIEW_LIMIT = 120
export const DETAIL_TEXT_LIMIT = 2000
export const BLOCK_TEXT_LIMIT = 8000

export function truncate(text: string, limit: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= limit) return normalized
  return `${normalized.slice(0, limit)}…`
}

export function truncatePreview(text: string): string {
  return truncate(text, PREVIEW_LIMIT)
}

export function truncateBlockText(text: string): string {
  if (text.length <= BLOCK_TEXT_LIMIT) return text
  return `${text.slice(0, BLOCK_TEXT_LIMIT)}\n… [truncated]`
}

export function truncateDetailText(text: string): string {
  return truncate(text, DETAIL_TEXT_LIMIT)
}

export function isDetailTruncated(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > DETAIL_TEXT_LIMIT
}