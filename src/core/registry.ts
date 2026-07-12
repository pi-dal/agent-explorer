import { claudeTranscriptAdapter } from '../adapters/claude-transcript'
import { codexRolloutAdapter } from '../adapters/codex-rollout'
import { isXiaoBaPlainLog, parseXiaoBaPlainLog } from '../adapters/xiaoba-log'
import { xiaobaSessionAdapter } from '../adapters/xiaoba-session'
import { xiaobaSubagentTranscriptAdapter } from '../adapters/xiaoba-subagent-transcript'
import type { SessionAdapter } from '../adapters/types'
import { parseJsonlText } from './jsonl'
import type { ExplorerSession } from './types'

const adapters: SessionAdapter[] = [
  claudeTranscriptAdapter,
  codexRolloutAdapter,
  xiaobaSubagentTranscriptAdapter,
  xiaobaSessionAdapter,
]

export function getAdapters(): SessionAdapter[] {
  return adapters
}

export function detectAndParse(text: string, fileName: string): ExplorerSession {
  if (isXiaoBaPlainLog(text)) return parseXiaoBaPlainLog(text, fileName)

  const { lines, warnings } = parseJsonlText(text)
  const samples = sampleLines(lines, 60)

  let best = adapters[0]!
  let bestScore = 0

  for (const adapter of adapters) {
    const score = adapter.detect(samples)
    if (score > bestScore) {
      bestScore = score
      best = adapter
    }
  }

  if (bestScore < 0.5) {
    throw new Error(
      'Unrecognized JSONL format. Supported formats: XiaoBa logs, Claude Code transcripts, and Codex rollout logs.',
    )
  }

  const session = best.parse(lines, fileName)
  session.parseWarnings.push(...warnings)
  return session
}

function sampleLines<T>(lines: T[], limit: number): T[] {
  if (lines.length <= limit) return lines
  const samples: T[] = []
  const seen = new Set<number>()
  for (let i = 0; i < limit; i++) {
    const index = Math.round(i * (lines.length - 1) / (limit - 1))
    if (!seen.has(index)) {
      seen.add(index)
      samples.push(lines[index]!)
    }
  }
  return samples
}
