export function isLogCandidate(fileName: string): boolean {
  return /\.(?:jsonl|log)$/i.test(fileName)
}

export function workspaceNameFromPaths(paths: string[]): string {
  const firstPath = paths.find(Boolean) ?? ''
  return firstPath.split('/').filter(Boolean)[0] ?? 'Folder'
}
