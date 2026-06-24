import type { ExplorerSession, ParsedLine } from '../core/types'

export interface SessionAdapter {
  detect(samples: ParsedLine[]): number
  parse(lines: ParsedLine[], fileName: string): ExplorerSession
}