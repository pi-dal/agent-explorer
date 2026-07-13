import { describe, expect, it } from 'vitest'
import { detectAndParse } from '../core/registry'
import { isXiaoBaPlainLog } from './xiaoba-log'

describe('XiaoBa plain logs', () => {
  const log = [
    '[2026-07-08 09:02:26.181] [INFO] [cli] 模型上下文: gpt-3.5-turbo',
    '[2026-07-08 09:02:26.182] [INFO] [cli] [cli Turn 1] 执行工具: bash | 参数: {"command":"ls"}',
    '[2026-07-08 09:02:26.183] [INFO] [cli] [cli Turn 1] 工具完成: bash | 耗时: 2ms | 结果: README.md',
  ].join('\n')

  it('recognizes and parses runtime log lines', () => {
    expect(isXiaoBaPlainLog(log)).toBe(true)
    const session = detectAndParse(log, '09-02-26_cli.log')
    expect(session.fileType).toBe('XiaoBa Log')
    expect(session.events).toHaveLength(3)
    expect(session.events.map(event => event.kind)).toEqual(['runtime_activity', 'tool_call', 'tool_result'])
    expect(session.conversationItems.map(item => item.role)).toEqual(['runtime_activity', 'tool_call', 'tool_result'])
    expect(session.conversationItems[2]?.block?.toolCallId).toBe(
      session.conversationItems[1]?.block?.toolCallId,
    )
  })

  it('normalizes known runtime status lines in plain logs', () => {
    const session = detectAndParse([
      '[2026-07-08 09:02:26.181] [INFO] [cli] [cli Turn 1] AI返回 tokens: 10+2=12',
      '[2026-07-08 09:02:26.182] [INFO] [cli] [cli Turn 1] AI推理完成，耗时: 4ms',
      '[2026-07-08 09:02:26.183] [INFO] [cli] [会话 cli] 当前请求已取消',
    ].join('\n'), '09-02-26_cli.log')

    expect(session.events.map(event => event.kind)).toEqual([
      'runtime_activity',
      'runtime_activity',
      'runtime_activity',
    ])
    expect(session.conversationItems.map(item => item.role)).toEqual([
      'runtime_activity',
      'runtime_activity',
      'runtime_activity',
    ])
  })

  it('keeps plain-log prompt traces in the prompt scope', () => {
    const session = detectAndParse(
      [
        '[2026-07-08 09:02:26.181] [INFO] [cli] [会话 cli] Prompt trace: system=abc, bundle=def, files=2, version=local',
        '[2026-07-08 09:02:26.182] [INFO] [cli] scheduler started',
        '[2026-07-08 09:02:26.183] [INFO] [cli] agent started',
      ].join('\n'),
      '09-02-26_cli.log',
    )
    expect(session.events[0]).toMatchObject({
      category: 'meta',
      kind: 'prompt_trace',
      label: 'Prompt trace',
    })
  })
})
