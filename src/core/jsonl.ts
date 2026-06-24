import type { ParseWarning, ParsedLine } from './types'

export interface ParseJsonlResult {
  lines: ParsedLine[]
  warnings: ParseWarning[]
}

export function parseJsonlText(text: string): ParseJsonlResult {
  const lines: ParsedLine[] = []
  const warnings: ParseWarning[] = []
  const rawLines = text.split(/\r?\n/)

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]!.trim()
    const lineIndex = i + 1
    if (!raw) continue

    try {
      lines.push({ lineIndex, raw, data: JSON.parse(raw) })
    } catch {
      warnings.push({ lineIndex, message: 'Invalid JSON on this line' })
    }
  }

  return { lines, warnings }
}

export async function readFileAsText(file: File): Promise<string> {
  return file.text()
}