import type { ExplorerSession, ParsedLine } from '../core/types'

export interface SessionAdapter {
  id: string
  label: string
  detect(samples: ParsedLine[]): number
  parse(lines: ParsedLine[], fileName: string): ExplorerSession
}