export interface WorkspaceFile {
  name: string
  relativePath: string
  filePath?: string
  lastModified: number
  text: () => Promise<string>
}

export interface DesktopWorkspace {
  rootPath: string
  files: WorkspaceFile[]
}

export type RecentDesktopSource =
  | { kind: 'file'; path: string }
  | { kind: 'directory'; path: string }

export function isDesktopApp(): boolean {
  return '__TAURI_INTERNALS__' in window
}

export function browserWorkspaceFiles(files: File[]): WorkspaceFile[] {
  return files.map(file => ({
    name: file.name,
    relativePath: file.webkitRelativePath || file.name,
    lastModified: file.lastModified,
    text: () => file.text(),
  }))
}

export async function openDesktopFile(): Promise<WorkspaceFile | null> {
  const [{ open }, { readTextFile, stat }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
  ])
  const path = await open({
    multiple: false,
    directory: false,
    title: 'Open agent session log',
    filters: [{ name: 'Agent session logs', extensions: ['jsonl', 'json', 'log'] }],
  })
  if (!path) return null

  const info = await stat(path)
  return desktopWorkspaceFile(path, fileName(path), info.mtime?.getTime() ?? 0, readTextFile)
}

export async function openDesktopDirectory(): Promise<DesktopWorkspace | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const root = await open({
    multiple: false,
    directory: true,
    recursive: true,
    title: 'Open agent workspace',
  })
  if (!root) return null
  return readDesktopDirectory(root)
}

export async function rememberDesktopDirectory(rootPath: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('remember_workspace', { path: rootPath })
}

export async function rememberDesktopFile(path: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('remember_file', { path })
}

export async function restoreRecentDesktopSource(): Promise<
  WorkspaceFile | DesktopWorkspace | null
> {
  if (!isDesktopApp()) return null
  const { invoke } = await import('@tauri-apps/api/core')
  const source = await invoke<RecentDesktopSource | null>('restore_recent_source')
  if (!source) return null
  return source.kind === 'file'
    ? readDesktopFile(source.path)
    : readDesktopDirectory(source.path)
}

export async function watchDesktopDirectory(
  rootPath: string,
  onChange: () => void,
): Promise<() => void> {
  const { watch } = await import('@tauri-apps/plugin-fs')
  return watch(rootPath, onChange, { recursive: true, delayMs: 500 })
}

export async function watchDesktopFile(
  path: string,
  onChange: () => void,
): Promise<() => void> {
  const [{ invoke }, { listen }] = await Promise.all([
    import('@tauri-apps/api/core'),
    import('@tauri-apps/api/event'),
  ])
  const unlisten = await listen('watched-log-changed', onChange)
  try {
    await invoke('watch_log_file', { path })
  } catch (error) {
    unlisten()
    throw error
  }
  return () => {
    unlisten()
    void invoke('unwatch_log_file')
  }
}

export async function readDesktopFile(path: string): Promise<WorkspaceFile> {
  const { readTextFile, stat } = await import('@tauri-apps/plugin-fs')
  const info = await stat(path)
  return desktopWorkspaceFile(path, fileName(path), info.mtime?.getTime() ?? 0, readTextFile)
}

export function openedDesktopFile(path: string, name: string, text: string): WorkspaceFile {
  return {
    name,
    relativePath: name,
    filePath: path,
    lastModified: Date.now(),
    text: async () => text,
  }
}

export async function readDesktopDirectory(root: string): Promise<DesktopWorkspace> {
  const [fs, pathApi] = await Promise.all([
    import('@tauri-apps/plugin-fs'),
    import('@tauri-apps/api/path'),
  ])

  const rootName = fileName(root)
  const files: WorkspaceFile[] = []

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await fs.readDir(directory)
    await Promise.all(entries.map(async (entry) => {
      const path = await pathApi.join(directory, entry.name)
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name
      if (entry.isDirectory) {
        await visit(path, relativePath)
      } else if (entry.isFile && isWorkspaceFile(relativePath)) {
        const info = await fs.stat(path)
        files.push(desktopWorkspaceFile(
          path,
          entry.name,
          info.mtime?.getTime() ?? 0,
          fs.readTextFile,
          `${rootName}/${relativePath}`,
        ))
      }
    }))
  }

  await visit(root, '')
  return { rootPath: root, files }
}

export function isWorkspaceFile(relativePath: string): boolean {
  return /\.(?:jsonl|log)$/i.test(relativePath)
    || /(^|\/)prompts\/.*\.md$/i.test(relativePath)
}

function desktopWorkspaceFile(
  path: string,
  name: string,
  lastModified: number,
  readTextFile: (path: string) => Promise<string>,
  relativePath = name,
): WorkspaceFile {
  return {
    name,
    relativePath,
    filePath: path,
    lastModified,
    text: () => readTextFile(path),
  }
}

function fileName(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path
}
