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
    expect(session.events.map(event => event.kind)).toEqual(['runtime', 'tool_call', 'tool_result'])
    expect(session.conversationItems.map(item => item.role)).toEqual(['system', 'tool_call', 'tool_result'])
    expect(session.conversationItems[2]?.block?.toolCallId).toBe(
      session.conversationItems[1]?.block?.toolCallId,
    )
  })
})
