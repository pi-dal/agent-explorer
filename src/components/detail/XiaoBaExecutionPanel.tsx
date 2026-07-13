import {
  ArrowDown,
  Activity,
  Bot,
  Braces,
  CheckCircle2,
  CircleDot,
  Clock3,
  GitBranch,
  MessageSquareText,
  TerminalSquare,
  Wrench,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { ConversationListItem, ExplorerSession, TimelineEvent, TraceRelationRef } from '../../core/types'
import { traceSessionKey, traceTranscriptEntries } from '../../core/trace'
import {
  parseXiaoBaBranchActivity,
  parseXiaoBaRuntimeActivity,
  parseXiaoBaRuntimeToolMessage,
  resolveXiaoBaPromptResources,
} from '../../core/xiaoba'
import { useSessionStore } from '../../store/sessionStore'
import { CopyablePath } from '../shared/CopyablePath'
import { ExpandablePre } from '../shared/ExpandablePre'
import { CollapsibleJson } from './CollapsibleJson'
import { SummaryRow } from './SummaryRow'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function numberValue(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function textContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value
    .map(block => isRecord(block) && block.type === 'text' ? stringValue(block, 'text') ?? '' : '')
    .filter(Boolean)
    .join('\n')
}

function Section({
  icon,
  title,
  meta,
  children,
}: {
  icon: ReactNode
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <section className="border-b border-separator pb-4 last:border-b-0 last:pb-0">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-secondary">{icon}</span>
        <h3 className="text-xs font-semibold text-primary">{title}</h3>
        {meta && <span className="ml-auto font-mono text-[10px] text-tertiary">{meta}</span>}
      </div>
      {children}
    </section>
  )
}

function FlowConnector() {
  return (
    <div className="flex h-7 items-center pl-1.5 text-tertiary" aria-hidden>
      <ArrowDown size={13} strokeWidth={1.5} />
    </div>
  )
}

function TextBody({ children }: { children: string }) {
  return (
    <div className="whitespace-pre-wrap break-words text-xs leading-5 text-primary">
      {children || '(empty)'}
    </div>
  )
}

function parseStructuredValue(value: unknown): unknown | undefined {
  if (value === undefined || value === null) return value
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return undefined
  }
}

function StructuredPayload({ value }: { value: unknown }) {
  const structured = parseStructuredValue(value)
  if (structured !== undefined) {
    return <CollapsibleJson value={structured} defaultExpanded />
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? ''
  return <ExpandablePre text={text} className="text-primary" />
}

function ToolActivity({ value, index }: { value: unknown; index: number }) {
  if (!isRecord(value)) return null
  const fn = isRecord(value.function) ? value.function : undefined
  const name = stringValue(value, 'name') ?? (fn ? stringValue(fn, 'name') : undefined) ?? 'tool'
  const id = stringValue(value, 'id') ?? `tool-${index + 1}`
  const args = value.arguments ?? fn?.arguments
  const result = stringValue(value, 'result')
  const duration = numberValue(value, 'duration_ms')

  return (
    <div className="border-t border-separator py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-2">
        <Wrench size={13} strokeWidth={1.75} className="shrink-0 text-role-tool" aria-hidden />
        <span className="truncate font-mono text-xs font-medium text-primary">{name}</span>
        {duration !== undefined && (
          <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-[10px] text-tertiary">
            <Clock3 size={11} strokeWidth={1.75} aria-hidden />
            {duration} ms
          </span>
        )}
      </div>
      <div className="mt-1 truncate font-mono text-[10px] text-tertiary">{id}</div>
      {args !== undefined && (
        <div className="mt-2">
          <div className="mb-1 text-[10px] font-medium uppercase text-tertiary">Input</div>
          <div className="rounded border border-separator bg-under-page-background px-2.5 py-2">
            <StructuredPayload value={args} />
          </div>
        </div>
      )}
      {result !== undefined && (
        <div className="mt-2">
            <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase text-tertiary">
              <CheckCircle2 size={11} strokeWidth={1.75} className="text-success" aria-hidden />
              Result
            </div>
          <div className="rounded border border-separator bg-under-page-background px-2.5 py-2">
            <StructuredPayload value={result} />
          </div>
        </div>
      )}
    </div>
  )
}

interface DisplayToolActivity {
  id: string
  name: string
  arguments?: unknown
  result?: string
  duration_ms?: number
}

function supplementalTurnTools(
  items: ConversationListItem[],
  event: TimelineEvent,
): DisplayToolActivity[] {
  if (event.turnIndex === undefined) return []
  const results = new Map<string, ConversationListItem>()
  for (const item of items) {
    if (item.event.turnIndex === event.turnIndex && item.role === 'tool_result' && item.block?.toolCallId) {
      results.set(item.block.toolCallId, item)
    }
  }
  return items
    .filter(item => (
      item.event.turnIndex === event.turnIndex
      && item.role === 'tool_call'
      && item.event.id !== event.id
    ))
    .map((item, index) => {
      const callId = item.block?.toolCallId ?? `tool-${index + 1}`
      const resultItem = results.get(callId)
      const resultRaw = resultItem?.event.raw
      const runtimeResult = isRecord(resultRaw)
        ? parseXiaoBaRuntimeToolMessage(stringValue(resultRaw, 'message') ?? '')
        : undefined
      return {
        id: callId,
        name: item.block?.toolName ?? 'tool',
        arguments: item.block?.toolInput ?? item.block?.text,
        result: resultItem?.block?.text,
        duration_ms: runtimeResult?.durationMs,
      }
    })
}

function TurnExecution({
  event,
  raw,
  conversationItems,
}: {
  event: TimelineEvent
  raw: Record<string, unknown>
  conversationItems: ConversationListItem[]
}) {
  const user = isRecord(raw.user) ? raw.user : {}
  const assistant = isRecord(raw.assistant) ? raw.assistant : {}
  const recordedCalls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : []
  const calls = recordedCalls.length > 0
    ? recordedCalls
    : supplementalTurnTools(conversationItems, event)
  const images = Array.isArray(user.images) ? user.images.length : 0
  const feedback = Array.isArray(user.runtime_feedback) ? user.runtime_feedback : []

  return (
    <div>
      <Section
        icon={<MessageSquareText size={14} strokeWidth={1.75} aria-hidden />}
        title="Received"
        meta={images > 0 ? `${images} image${images === 1 ? '' : 's'}` : undefined}
      >
        <TextBody>{stringValue(user, 'text') ?? ''}</TextBody>
        {feedback.length > 0 && (
          <div className="mt-3 border-t border-separator pt-2">
            <div className="mb-1 text-[10px] font-medium uppercase text-tertiary">
              Runtime feedback
            </div>
            <TextBody>{feedback.filter(value => typeof value === 'string').join('\n')}</TextBody>
          </div>
        )}
      </Section>
      <FlowConnector />
      <Section
        icon={<Wrench size={14} strokeWidth={1.75} aria-hidden />}
        title="Tool activity"
        meta={`${calls.length} call${calls.length === 1 ? '' : 's'}`}
      >
        {calls.length > 0 ? (
          calls.map((call, index) => <ToolActivity key={index} value={call} index={index} />)
        ) : (
          <p className="text-xs text-secondary">No tools were called in this turn.</p>
        )}
      </Section>
      <FlowConnector />
      <Section
        icon={<CheckCircle2 size={14} strokeWidth={1.75} aria-hidden />}
        title="Responded"
        meta={event.usage ? `${event.usage.outputTokens.toLocaleString()} tokens` : undefined}
      >
        <TextBody>{stringValue(assistant, 'text') ?? ''}</TextBody>
      </Section>
    </div>
  )
}

function ContextMessageExecution({ raw }: { raw: Record<string, unknown> }) {
  const role = stringValue(raw, 'role') ?? 'message'
  const calls = Array.isArray(raw.tool_calls) ? raw.tool_calls : []
  const content = textContent(raw.content)
  const isToolRequest = role === 'assistant' && calls.length > 0
  const resultMeta = role === 'tool'
    ? [stringValue(raw, 'name'), stringValue(raw, 'tool_call_id')].filter(Boolean).join(' · ')
    : undefined

  return (
    <div className="flex flex-col gap-4">
      <Section
        icon={role === 'tool' || isToolRequest
          ? <Wrench size={14} strokeWidth={1.75} aria-hidden />
          : <MessageSquareText size={14} strokeWidth={1.75} aria-hidden />}
        title={role === 'user'
          ? 'Received input'
          : role === 'tool'
            ? 'Tool result'
            : isToolRequest
              ? 'Tool request'
              : 'Agent message'}
        meta={resultMeta ?? (isToolRequest ? `${calls.length} call${calls.length === 1 ? '' : 's'}` : role)}
      >
        <StructuredPayload value={content} />
      </Section>
      {calls.length > 0 && (
        <Section
          icon={<Wrench size={14} strokeWidth={1.75} aria-hidden />}
          title="Requested tools"
          meta={`${calls.length} call${calls.length === 1 ? '' : 's'}`}
        >
          {calls.map((call, index) => <ToolActivity key={index} value={call} index={index} />)}
        </Section>
      )}
    </div>
  )
}

function RuntimeExecution({ raw }: { raw: Record<string, unknown> }) {
  const event = isRecord(raw.event) ? raw.event : undefined
  return (
    <div className="flex flex-col gap-4">
      <Section
        icon={<TerminalSquare size={14} strokeWidth={1.75} aria-hidden />}
        title="Runtime event"
        meta={stringValue(raw, 'level')}
      >
        <TextBody>{stringValue(raw, 'message') ?? ''}</TextBody>
      </Section>
      {event && (
        <Section icon={<CircleDot size={14} strokeWidth={1.75} aria-hidden />} title="Event payload">
          <CollapsibleJson value={event} defaultExpanded />
        </Section>
      )}
    </div>
  )
}

function RuntimeToolExecution({ raw }: { raw: Record<string, unknown> }) {
  const parsed = parseXiaoBaRuntimeToolMessage(stringValue(raw, 'message') ?? '')
  if (!parsed) return <RuntimeExecution raw={raw} />
  return (
    <Section
      icon={<Wrench size={14} strokeWidth={1.75} aria-hidden />}
      title={parsed.phase === 'call' ? 'Tool requested' : 'Tool completed'}
      meta={`Turn ${parsed.turn}`}
    >
      <ToolActivity
        index={0}
        value={{
          id: `runtime-tool-${parsed.turn}`,
          name: parsed.name,
          arguments: parsed.input,
          result: parsed.result,
          duration_ms: parsed.durationMs,
        }}
      />
    </Section>
  )
}

function RuntimeActivityExecution({
  event,
  raw,
}: {
  event: TimelineEvent
  raw: Record<string, unknown>
}) {
  const activity = event.runtimeActivity
    ?? parseXiaoBaRuntimeActivity(stringValue(raw, 'message') ?? '')
  if (!activity) return <RuntimeExecution raw={raw} />

  return (
    <div className="flex flex-col gap-4">
      <Section
        icon={<Activity size={14} strokeWidth={1.75} aria-hidden />}
        title={event.label}
        meta={activity.scope}
      >
        <div className="flex flex-col gap-2">
          {activity.turn !== undefined && <SummaryRow label="Turn" value={String(activity.turn)} />}
          {activity.toolNames && activity.toolNames.length > 0 && (
            <SummaryRow label="Tools" value={activity.toolNames.join(' · ')} />
          )}
          {activity.durationMs !== undefined && <SummaryRow label="Duration" value={`${activity.durationMs} ms`} />}
          {activity.tokenUsage && (
            <SummaryRow
              label="Tokens"
              value={`input ${activity.tokenUsage.inputTokens} · output ${activity.tokenUsage.outputTokens} · total ${activity.tokenUsage.totalTokens}`}
            />
          )}
          <TextBody>{activity.text}</TextBody>
        </div>
      </Section>
      {stringValue(raw, 'message') && stringValue(raw, 'message') !== activity.text && (
        <Section icon={<TerminalSquare size={14} strokeWidth={1.75} aria-hidden />} title="Raw runtime message">
          <ExpandablePre
            text={stringValue(raw, 'message')!}
            className="rounded border border-separator bg-under-page-background px-2.5 py-2"
          />
        </Section>
      )}
      {isRecord(raw.event) && (
        <Section icon={<CircleDot size={14} strokeWidth={1.75} aria-hidden />} title="Event payload">
          <CollapsibleJson value={raw.event} defaultExpanded />
        </Section>
      )}
    </div>
  )
}

function BranchActivityExecution({
  event,
  raw,
}: {
  event: TimelineEvent
  raw: Record<string, unknown>
}) {
  const activity = event.branchActivity
    ?? parseXiaoBaBranchActivity(stringValue(raw, 'message') ?? '')
  if (!activity) return <RuntimeExecution raw={raw} />

  return (
    <div className="flex flex-col gap-4">
      <Section
        icon={<GitBranch size={14} strokeWidth={1.75} aria-hidden />}
        title={event.label}
        meta={`Turn ${activity.turn}`}
      >
        <div className="flex flex-col gap-2">
          <SummaryRow label="Branch" value={`${activity.branchType} · ${activity.branchId}`} />
          {activity.toolNames && activity.toolNames.length > 0 && (
            <SummaryRow label="Tools" value={activity.toolNames.join(' · ')} />
          )}
          <TextBody>{activity.text}</TextBody>
        </div>
      </Section>
      {event.traceRefs && event.traceRefs.length > 0 && (
        <EmbeddedTraceExecution event={event} refs={event.traceRefs} />
      )}
      <Section icon={<CircleDot size={14} strokeWidth={1.75} aria-hidden />} title="Runtime payload">
        <CollapsibleJson value={raw} defaultExpanded />
      </Section>
    </div>
  )
}

function PromptExecution({
  raw,
  resources,
}: {
  raw: Record<string, unknown>
  resources?: Record<string, string>
}) {
  const prompt = isRecord(raw.prompt) ? raw.prompt : {}
  const system = isRecord(prompt.system) ? prompt.system : undefined
  const bundle = isRecord(prompt.bundle) ? prompt.bundle : undefined
  const loadedFiles = Array.isArray(prompt.loaded_files)
    ? prompt.loaded_files.filter((value): value is string => typeof value === 'string')
    : []
  const promptResources = resolveXiaoBaPromptResources(
    resources,
    stringValue(prompt, 'prompts_dir'),
    loadedFiles,
  )
  return (
    <div className="flex flex-col gap-4">
      <Section icon={<Braces size={14} strokeWidth={1.75} aria-hidden />} title="Prompt snapshot">
        <div className="flex flex-col gap-2">
          {stringValue(prompt, 'source') && <SummaryRow label="Source" value={stringValue(prompt, 'source')!} />}
          {stringValue(prompt, 'prompt_version') && <SummaryRow label="Version" value={stringValue(prompt, 'prompt_version')!} />}
          {system && stringValue(system, 'short_hash') && <SummaryRow label="System hash" value={stringValue(system, 'short_hash')!} />}
          {bundle && stringValue(bundle, 'short_hash') && <SummaryRow label="Bundle hash" value={stringValue(bundle, 'short_hash')!} />}
          {bundle && numberValue(bundle, 'file_count') !== undefined && <SummaryRow label="Files" value={String(numberValue(bundle, 'file_count'))} />}
        </div>
      </Section>
      <Section icon={<Braces size={14} strokeWidth={1.75} aria-hidden />} title="Prompt data">
        <CollapsibleJson value={prompt} />
      </Section>
      <Section
        icon={<MessageSquareText size={14} strokeWidth={1.75} aria-hidden />}
        title="Loaded prompt content"
        meta={`${promptResources.length} / ${loadedFiles.length} files`}
      >
        {promptResources.length > 0 ? (
          <div>
            {promptResources.map(resource => (
              <div key={resource.path} className="border-t border-separator py-3 first:border-t-0 first:pt-0 last:pb-0">
                <div className="mb-2">
                  <CopyablePath value={resource.path} label="prompt path" />
                </div>
                <ExpandablePre
                  text={resource.content}
                  className="rounded border border-separator bg-under-page-background px-2.5 py-2"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs leading-5 text-secondary">
            Open the XiaoBa project or runtime folder to load the prompt files referenced by this snapshot.
          </p>
        )}
      </Section>
    </div>
  )
}

function SubagentExecution({ raw }: { raw: Record<string, unknown> }) {
  const subagent = isRecord(raw.subagent) ? raw.subagent : {}
  const event = isRecord(raw.event) ? raw.event : {}
  return (
    <div className="flex flex-col gap-4">
      <Section
        icon={<Bot size={14} strokeWidth={1.75} aria-hidden />}
        title={stringValue(subagent, 'name') ?? stringValue(subagent, 'id') ?? 'Subagent'}
        meta={stringValue(event, 'type')}
      >
        <TextBody>{stringValue(event, 'summary') ?? ''}</TextBody>
      </Section>
      {event.payload !== undefined && (
        <Section icon={<CircleDot size={14} strokeWidth={1.75} aria-hidden />} title="Payload">
          <CollapsibleJson value={event.payload} defaultExpanded />
        </Section>
      )}
    </div>
  )
}

function BranchExecution({ raw }: { raw: Record<string, unknown> }) {
  if (stringValue(raw, 'branch_type') === 'distillation') {
    return <DistillationExecution raw={raw} />
  }
  return (
    <div className="flex flex-col gap-4">
      <Section
        icon={<Bot size={14} strokeWidth={1.75} aria-hidden />}
        title={stringValue(raw, 'branch_type') ?? 'Branch execution'}
        meta={stringValue(raw, 'event_type')}
      >
        <div className="flex flex-col gap-2">
          {stringValue(raw, 'branch_id') && <SummaryRow label="Branch" value={stringValue(raw, 'branch_id')!} />}
          {numberValue(raw, 'round') !== undefined && <SummaryRow label="Round" value={String(numberValue(raw, 'round'))} />}
          {stringValue(raw, 'decision') && <SummaryRow label="Decision" value={stringValue(raw, 'decision')!} />}
          {stringValue(raw, 'rationale') && <TextBody>{stringValue(raw, 'rationale')!}</TextBody>}
        </div>
      </Section>
      <Section icon={<CircleDot size={14} strokeWidth={1.75} aria-hidden />} title="Branch payload">
        <CollapsibleJson value={raw} defaultExpanded />
      </Section>
    </div>
  )
}

function DistillationExecution({ raw }: { raw: Record<string, unknown> }) {
  const eventType = stringValue(raw, 'event_type') ?? 'event'
  const byteRange = isRecord(raw.byte_range) ? raw.byte_range : undefined
  const candidates = Array.isArray(raw.candidates) ? raw.candidates : []
  const reviews = isRecord(raw.review_counts) ? raw.review_counts : undefined
  const stage = {
    start: 'Read source log',
    distiller_output: 'Distilled candidates',
    promotion_packet: 'Prepared promotion packet',
    review_result: 'Promotion review',
    install_result: 'Installed generated skill',
    run_result: 'Completed distillation run',
    transcript: 'Recorded audit transcript',
  }[eventType] ?? eventType

  return (
    <div className="flex flex-col gap-4">
      <Section
        icon={<GitBranch size={14} strokeWidth={1.75} aria-hidden />}
        title={stage}
        meta={eventType}
      >
        <div className="flex flex-col gap-2">
          {stringValue(raw, 'branch_id') && <SummaryRow label="Run" value={stringValue(raw, 'branch_id')!} />}
          {stringValue(raw, 'source_file_path') && <SummaryRow label="Source log" value={stringValue(raw, 'source_file_path')!} copyable />}
          {byteRange && numberValue(byteRange, 'start') !== undefined && numberValue(byteRange, 'end') !== undefined && (
            <SummaryRow label="Byte range" value={`${numberValue(byteRange, 'start')}–${numberValue(byteRange, 'end')}`} />
          )}
          {Array.isArray(raw.new_turns) && <SummaryRow label="New turns" value={`${raw.new_turns.length} records`} />}
          {numberValue(raw, 'continuity_turn_count') !== undefined && (
            <SummaryRow label="Continuity" value={`${numberValue(raw, 'continuity_turn_count')} turns`} />
          )}
          {numberValue(raw, 'candidate_count') !== undefined && <SummaryRow label="Candidates" value={String(numberValue(raw, 'candidate_count'))} />}
          {stringValue(raw, 'recommendation') && <SummaryRow label="Recommendation" value={stringValue(raw, 'recommendation')!} />}
          {stringValue(raw, 'decision') && <SummaryRow label="Decision" value={stringValue(raw, 'decision')!} />}
          {stringValue(raw, 'capability_id') && <SummaryRow label="Capability" value={stringValue(raw, 'capability_id')!} />}
          {stringValue(raw, 'snapshot_id') && <SummaryRow label="Snapshot" value={stringValue(raw, 'snapshot_id')!} />}
          {stringValue(raw, 'skill_name') && <SummaryRow label="Skill" value={stringValue(raw, 'skill_name')!} />}
          {numberValue(raw, 'installation_count') !== undefined && <SummaryRow label="Installed" value={String(numberValue(raw, 'installation_count'))} />}
          {reviews && <SummaryRow label="Reviews" value={Object.entries(reviews).map(([key, value]) => `${key} ${String(value)}`).join(' · ')} />}
          {stringValue(raw, 'rationale') && <TextBody>{stringValue(raw, 'rationale')!}</TextBody>}
          {candidates.length > 0 && (
            <div className="border-t border-separator pt-2">
              <div className="mb-1 text-[10px] font-medium uppercase text-tertiary">Candidate titles</div>
              <TextBody>{candidates.map((candidate, index) => (
                isRecord(candidate)
                  ? `${index + 1}. ${stringValue(candidate, 'title') ?? stringValue(candidate, 'capability_id') ?? 'candidate'}`
                  : `${index + 1}. candidate`
              )).join('\n')}</TextBody>
            </div>
          )}
        </div>
      </Section>
      <Section icon={<CircleDot size={14} strokeWidth={1.75} aria-hidden />} title="Distillation payload">
        <CollapsibleJson value={raw} defaultExpanded />
      </Section>
    </div>
  )
}

function traceMessageLabel(role: ConversationListItem['role']): string {
  switch (role) {
    case 'system': return 'System prompt'
    case 'user': return 'Branch input'
    case 'assistant': return 'Branch response'
    case 'thinking': return 'Branch reasoning'
    case 'tool_result': return 'Tool result'
    default: return 'Branch message'
  }
}

function TraceTranscript({ child }: { child: ExplorerSession }) {
  const entries = traceTranscriptEntries(child)
  if (entries.length === 0) return null

  return (
    <div className="mt-4 border-t border-separator pt-3">
      <div className="mb-2 flex items-center gap-2">
        <Bot size={13} strokeWidth={1.75} className="text-role-tool" aria-hidden />
        <span className="text-[10px] font-medium uppercase text-tertiary">Branch transcript</span>
        <span className="ml-auto font-mono text-[10px] text-tertiary">{entries.length} items</span>
      </div>
      <div className="flex flex-col">
        {entries.map((entry, index) => {
          if (entry.kind === 'tool') {
            return (
              <div key={entry.item.id} className="border-t border-separator py-2 first:border-t-0">
                <ToolActivity
                  index={index}
                  value={{
                    id: entry.item.block?.toolCallId,
                    name: entry.item.block?.toolName ?? 'tool',
                    arguments: entry.item.block?.toolInput ?? entry.item.block?.text,
                    result: entry.result?.block?.text,
                  }}
                />
              </div>
            )
          }

          const text = entry.item.block?.text ?? entry.item.event.preview
          return (
            <div key={entry.item.id} className="border-t border-separator py-2 first:border-t-0">
              <div className="mb-1 flex items-center gap-2">
                <MessageSquareText size={12} strokeWidth={1.75} className="text-role-tool" aria-hidden />
                <span className="text-[10px] font-medium uppercase text-tertiary">
                  {traceMessageLabel(entry.item.role)}
                </span>
              </div>
              {entry.item.role === 'tool_result' ? (
                <StructuredPayload value={text} />
              ) : (
                <ExpandablePre text={text} mono={entry.item.role === 'system'} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmbeddedTraceExecution({
  event,
  refs,
}: {
  event: TimelineEvent
  refs: TraceRelationRef[]
}) {
  const sessions = useSessionStore((state) => state.sessions)
  return (
    <div className="flex flex-col gap-4">
      <Section
        icon={<GitBranch size={14} strokeWidth={1.75} aria-hidden />}
        title="Embedded branch activity"
        meta={`${refs.length} linked trace${refs.length === 1 ? '' : 's'}`}
      >
        <div className="flex flex-col gap-4">
          {refs.map((ref) => {
            const child = sessions.find(session => {
              if (traceSessionKey(session) === ref.childSessionKey) return true
              return session.events.some((childEvent) => {
                if (!isRecord(childEvent.raw)) return false
                return stringValue(childEvent.raw, 'entry_type') === 'branch'
                  && stringValue(childEvent.raw, 'branch_type') === ref.branchType
                  && stringValue(childEvent.raw, 'branch_id') === ref.branchId
              })
            })
            return (
              <div key={ref.relationId} className="border-t border-separator pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-primary">{ref.branchType}</span>
                  <span className="truncate font-mono text-[10px] text-tertiary">{ref.branchId}</span>
                  <span className="ml-auto text-[10px] text-tertiary">{ref.confidence}</span>
                </div>
                {ref.lifecycle && (
                  <div className="mt-2 flex flex-col gap-1">
                    {ref.lifecycle.outcome && <SummaryRow label="Outcome" value={ref.lifecycle.outcome} />}
                    {ref.lifecycle.observationId && <SummaryRow label="Observation" value={ref.lifecycle.observationId} />}
                    {ref.lifecycle.originTurn !== undefined && <SummaryRow label="Origin turn" value={String(ref.lifecycle.originTurn)} />}
                    {ref.lifecycle.timing && <SummaryRow label="Timing" value={ref.lifecycle.timing} />}
                  </div>
                )}
                {ref.sourceFilePath && (
                  <div className="mt-2">
                    <div className="mb-1 text-[10px] font-medium uppercase text-tertiary">Source</div>
                    <CopyablePath value={ref.sourceFilePath} label="source path" />
                  </div>
                )}
                {child ? (
                  <div className="mt-3 border-t border-separator pt-2">
                    <div className="mb-2 text-[10px] font-medium uppercase text-tertiary">
                      {child.events.length} child events · {child.meta.turnCount} turns
                    </div>
                    <div className="flex flex-col gap-2">
                      {child.events.slice(0, 12).map((childEvent) => (
                        <div key={childEvent.id} className="min-w-0">
                          <div className="truncate text-xs font-medium text-primary">{childEvent.label}</div>
                          {childEvent.preview && <div className="truncate text-[10px] text-tertiary">{childEvent.preview}</div>}
                        </div>
                      ))}
                      {child.events.length > 12 && <div className="text-[10px] text-tertiary">+{child.events.length - 12} more child events</div>}
                    </div>
                    <TraceTranscript child={child} />
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-secondary">The referenced child log is not loaded in this workspace.</p>
                )}
              </div>
            )
          })}
        </div>
      </Section>
      {event.kind === 'branch_anchor' && isRecord(event.raw) && (
        <Section icon={<CircleDot size={14} strokeWidth={1.75} aria-hidden />} title="Anchor payload">
          <CollapsibleJson value={event.raw} defaultExpanded />
        </Section>
      )}
    </div>
  )
}

function SubagentTranscriptExecution({ raw }: { raw: Record<string, unknown> }) {
  const recordType = stringValue(raw, 'recordType')
  if (recordType === 'tool_start' || recordType === 'tool_end') {
    return (
      <Section
        icon={<Wrench size={14} strokeWidth={1.75} aria-hidden />}
        title={recordType === 'tool_start' ? 'Tool execution started' : 'Tool execution completed'}
        meta={stringValue(raw, 'toolName')}
      >
        <TextBody>{stringValue(raw, 'argsPreview') ?? (
          recordType === 'tool_end'
            ? 'The tool completed. This transcript did not record the result body.'
            : ''
        )}</TextBody>
      </Section>
    )
  }

  const message = isRecord(raw.message) ? raw.message : undefined
  const content = message && Array.isArray(message.content) ? message.content : []
  const thinking = content
    .filter(value => isRecord(value) && value.type === 'thinking')
    .map(value => stringValue(value as Record<string, unknown>, 'thinking') ?? '')
    .filter(Boolean)
  const response = content
    .filter(value => isRecord(value) && value.type === 'text')
    .map(value => stringValue(value as Record<string, unknown>, 'text') ?? '')
    .filter(Boolean)
  const calls = content.filter(value => isRecord(value) && value.type === 'toolCall')
  const role = stringValue(raw, 'role')

  return (
    <div className="flex flex-col gap-4">
      <Section
        icon={<MessageSquareText size={14} strokeWidth={1.75} aria-hidden />}
        title={role === 'user' ? 'Received task' : 'Subagent message'}
        meta={stringValue(raw, 'agent')}
      >
        <TextBody>{stringValue(raw, 'text') ?? response.join('\n')}</TextBody>
      </Section>
      {thinking.length > 0 && (
        <Section icon={<Braces size={14} strokeWidth={1.75} aria-hidden />} title="Reasoning">
          <TextBody>{thinking.join('\n\n')}</TextBody>
        </Section>
      )}
      {calls.length > 0 && (
        <Section
          icon={<Wrench size={14} strokeWidth={1.75} aria-hidden />}
          title="Tool requests"
          meta={`${calls.length} call${calls.length === 1 ? '' : 's'}`}
        >
          {calls.map((call, index) => <ToolActivity key={index} value={call} index={index} />)}
        </Section>
      )}
    </div>
  )
}

export function XiaoBaExecutionPanel({ event }: { event: TimelineEvent }) {
  const resources = useSessionStore((state) => state.session?.resources)
  const conversationItems = useSessionStore((state) => state.session?.conversationItems ?? [])
  if (!isRecord(event.raw)) return null
  const raw = event.raw

  if (event.kind === 'branch_activity') {
    return <BranchActivityExecution event={event} raw={raw} />
  }

  if (event.kind === 'prompt_trace') {
    return stringValue(raw, 'entry_type') === 'prompt_trace'
      ? <PromptExecution raw={raw} resources={resources} />
      : <RuntimeActivityExecution event={event} raw={raw} />
  }

  if (event.kind === 'runtime_activity') {
    return <RuntimeActivityExecution event={event} raw={raw} />
  }

  if (event.traceRefs && event.traceRefs.length > 0) {
    return <EmbeddedTraceExecution event={event} refs={event.traceRefs} />
  }

  if (stringValue(raw, 'recordType')) return <SubagentTranscriptExecution raw={raw} />
  if (stringValue(raw, 'entry_type') === 'embedded_trace') return <EmbeddedTraceExecution event={event} refs={event.traceRefs ?? []} />
  if (stringValue(raw, 'entry_type') === 'branch') return <BranchExecution raw={raw} />

  if (event.kind === 'turn') {
    return <TurnExecution event={event} raw={raw} conversationItems={conversationItems} />
  }
  if (event.kind === 'tool_call' || event.kind === 'tool_result') {
    return typeof raw.role === 'string'
      ? <ContextMessageExecution raw={raw} />
      : <RuntimeToolExecution raw={raw} />
  }
  if (event.kind === 'runtime') return <RuntimeExecution raw={raw} />
  if (event.kind === 'subagent_event') return <SubagentExecution raw={raw} />
  return <ContextMessageExecution raw={raw} />
}
