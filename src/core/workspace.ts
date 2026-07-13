export const SUPPORTED_LOG_EXTENSIONS = ['jsonl', 'log'] as const

export function isLogCandidate(fileName: string): boolean {
  const lowerName = fileName.toLowerCase()
  return SUPPORTED_LOG_EXTENSIONS.some(extension => lowerName.endsWith(`.${extension}`))
}

export function workspaceNameFromPaths(paths: string[]): string {
  const firstPath = paths.find(Boolean) ?? ''
  return firstPath.split('/').filter(Boolean)[0] ?? 'Folder'
}
