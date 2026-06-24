export function downloadRawJson(raw: unknown, fileName: string) {
  const json = JSON.stringify(raw, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function rawExportFileName(lineIndex?: number): string {
  return lineIndex !== undefined ? `event-line-${lineIndex}.json` : 'event.json'
}