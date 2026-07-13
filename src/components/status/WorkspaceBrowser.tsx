import {
  ChevronDown,
  ChevronRight,
  FileJson,
  Folder,
  FolderOpen,
  FolderTree,
  Wrench,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ExplorerSession } from '../../core/types'
import { dropdownPanel } from '../../styles/uiClasses'
import { PathActions } from '../shared/CopyablePath'

interface DirectoryNode {
  name: string
  path: string
  directories: Map<string, DirectoryNode>
  files: Array<{ session: ExplorerSession; index: number }>
}

function toolCount(session: ExplorerSession): number {
  return session.conversationItems.filter(item => item.role === 'tool_call').length
}

function displayPath(session: ExplorerSession, workspaceName: string): string[] {
  const path = session.sourcePath ?? session.fileName
  const parts = path.split('/').filter(Boolean)
  return parts[0] === workspaceName ? parts.slice(1) : parts
}

function buildTree(sessions: ExplorerSession[], workspaceName: string): DirectoryNode {
  const root: DirectoryNode = {
    name: workspaceName,
    path: '',
    directories: new Map(),
    files: [],
  }
  sessions.forEach((session, index) => {
    const parts = displayPath(session, workspaceName)
    const fileName = parts.pop() ?? session.fileName
    let node = root
    for (const part of parts) {
      const path = node.path ? `${node.path}/${part}` : part
      let child = node.directories.get(part)
      if (!child) {
        child = { name: part, path, directories: new Map(), files: [] }
        node.directories.set(part, child)
      }
      node = child
    }
    node.files.push({ session: { ...session, fileName }, index })
  })
  return root
}

function DirectoryRow({
  node,
  depth,
  expanded,
  toggle,
  selectedIndex,
  selectSession,
}: {
  node: DirectoryNode
  depth: number
  expanded: Set<string>
  toggle: (path: string) => void
  selectedIndex: number
  selectSession: (index: number) => void
}) {
  const isExpanded = expanded.has(node.path)
  const directories = [...node.directories.values()].sort((a, b) => a.name.localeCompare(b.name))
  const files = [...node.files].sort((a, b) => a.session.fileName.localeCompare(b.session.fileName))
  return (
    <>
      <button
        type="button"
        onClick={() => toggle(node.path)}
        className="flex h-7 w-full items-center gap-1.5 text-left text-xs text-secondary hover:bg-overlay hover:text-primary"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        aria-expanded={isExpanded}
      >
        {isExpanded
          ? <ChevronDown size={12} strokeWidth={1.75} aria-hidden />
          : <ChevronRight size={12} strokeWidth={1.75} aria-hidden />}
        {isExpanded
          ? <FolderOpen size={13} strokeWidth={1.75} aria-hidden />
          : <Folder size={13} strokeWidth={1.75} aria-hidden />}
        <span className="truncate font-medium">{node.name}</span>
        <span className="ml-auto pr-3 font-mono text-[10px] text-tertiary">
          {node.files.length + node.directories.size}
        </span>
      </button>
      {isExpanded && (
        <>
          {directories.map(child => (
            <DirectoryRow
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              selectedIndex={selectedIndex}
              selectSession={selectSession}
            />
          ))}
          {files.map(({ session, index }) => {
            const tools = toolCount(session)
            const selected = index === selectedIndex
            return (
              <button
                key={`${session.sourcePath ?? session.fileName}-${index}`}
                type="button"
                onClick={() => selectSession(index)}
                className={`flex h-8 w-full items-center gap-2 text-left text-xs ${
                  selected ? 'bg-overlay-emphasized text-primary' : 'text-secondary hover:bg-overlay hover:text-primary'
                }`}
                style={{ paddingLeft: `${24 + (depth + 1) * 16}px` }}
                title={session.sourcePath ?? session.fileName}
              >
                <FileJson size={13} strokeWidth={1.75} className="shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{session.fileName}</span>
                <span className="shrink-0 rounded bg-overlay px-1.5 py-0.5 text-[9px] text-tertiary">
                  {session.fileType}
                </span>
                <span className="flex w-28 shrink-0 items-center justify-end gap-2 pr-3 font-mono text-[10px] text-tertiary">
                  <span>{session.meta.turnCount} turns</span>
                  <span className={tools > 0 ? 'text-role-tool' : undefined}>
                    <Wrench size={10} strokeWidth={1.75} className="mr-0.5 inline" aria-hidden />
                    {tools}
                  </span>
                </span>
              </button>
            )
          })}
        </>
      )}
    </>
  )
}

export function WorkspaceBrowser({
  sessions,
  session,
  workspaceName,
  selectSession,
}: {
  sessions: ExplorerSession[]
  session: ExplorerSession
  workspaceName: string
  selectSession: (index: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const rootRef = useRef<HTMLDivElement>(null)
  const tree = useMemo(() => buildTree(sessions, workspaceName), [sessions, workspaceName])
  const selectedIndex = Math.max(0, sessions.indexOf(session))
  const copyPath = session.sourceFilePath ?? session.sourcePath ?? session.fileName
  const hasAbsolutePath = Boolean(session.sourceFilePath)

  useEffect(() => {
    const initial = new Set<string>()
    for (const directory of tree.directories.values()) initial.add(directory.path)
    setExpanded(initial)
  }, [tree])

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  function toggle(path: string) {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  return (
    <div ref={rootRef} className="relative flex min-w-0 items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="flex h-7 min-w-0 max-w-96 items-center gap-1.5 rounded border border-separator bg-background px-2 text-xs text-primary outline-none hover:bg-overlay focus:border-accent/80 focus:ring-2 focus:ring-accent/30"
        aria-expanded={open}
        aria-label="Browse workspace logs"
      >
        <FolderTree size={13} strokeWidth={1.75} className="shrink-0 text-secondary" aria-hidden />
        <span className="truncate">{session.sourcePath ?? session.fileName}</span>
        <ChevronDown size={12} strokeWidth={1.75} className="shrink-0 text-tertiary" aria-hidden />
      </button>
      <PathActions
        value={copyPath}
        label={hasAbsolutePath ? 'absolute log path' : 'log path (relative in browser mode)'}
      />
      {open && (
        <div className={`absolute left-0 top-full z-30 mt-1 w-[min(42rem,calc(100vw-2rem))] overflow-hidden ${dropdownPanel}`}>
          <div className="flex h-8 items-center border-b border-separator px-3 text-[10px] font-semibold uppercase text-tertiary">
            <span className="truncate">{workspaceName}</span>
            <span className="ml-auto font-mono font-normal">{sessions.length} readable logs</span>
          </div>
          <div
            data-testid="workspace-browser-tree"
            className="max-h-[min(32rem,70vh)] overflow-auto py-1"
            role="tree"
          >
            {[...tree.directories.values()]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(node => (
                <DirectoryRow
                  key={node.path}
                  node={node}
                  depth={0}
                  expanded={expanded}
                  toggle={toggle}
                  selectedIndex={selectedIndex}
                  selectSession={(index) => {
                    selectSession(index)
                    setOpen(false)
                  }}
                />
              ))}
            {tree.files.map(({ session: rootSession, index }) => (
              <button
                key={`${rootSession.sourcePath ?? rootSession.fileName}-${index}`}
                type="button"
                onClick={() => {
                  selectSession(index)
                  setOpen(false)
                }}
                className={`flex h-8 w-full items-center gap-2 px-3 text-left text-xs ${
                  index === selectedIndex ? 'bg-overlay-emphasized text-primary' : 'text-secondary hover:bg-overlay'
                }`}
              >
                <FileJson size={13} strokeWidth={1.75} aria-hidden />
                <span className="truncate">{rootSession.fileName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
