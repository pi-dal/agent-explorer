import { describe, expect, it } from 'vitest'
import { browserWorkspaceFiles, isWorkspaceFile } from './workspaceSource'

describe('browser workspace source', () => {
  it('normalizes browser files for the shared workspace loader', async () => {
    const file = {
      name: 'session.jsonl',
      webkitRelativePath: 'workspace/logs/session.jsonl',
      lastModified: 42,
      text: async () => '{"role":"user"}',
    } as File

    const [workspaceFile] = browserWorkspaceFiles([file])

    expect(workspaceFile).toMatchObject({
      name: 'session.jsonl',
      relativePath: 'workspace/logs/session.jsonl',
      lastModified: 42,
    })
    expect(await workspaceFile?.text()).toBe('{"role":"user"}')
  })

  it('falls back to the file name for single browser files', () => {
    const file = {
      name: 'session.log',
      webkitRelativePath: '',
      lastModified: 0,
      text: async () => '',
    } as File

    expect(browserWorkspaceFiles([file])[0]?.relativePath).toBe('session.log')
  })
})

describe('desktop workspace discovery', () => {
  it('keeps agent logs and prompt resources only', () => {
    expect(isWorkspaceFile('logs/session.jsonl')).toBe(true)
    expect(isWorkspaceFile('runtime/agent.log')).toBe(true)
    expect(isWorkspaceFile('prompts/system.md')).toBe(true)
    expect(isWorkspaceFile('nested/prompts/tool.md')).toBe(true)
    expect(isWorkspaceFile('README.md')).toBe(false)
    expect(isWorkspaceFile('src/index.ts')).toBe(false)
  })
})
