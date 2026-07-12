import {
  ArrowDown,
  Bot,
  Braces,
  CheckCircle2,
  CircleDot,
  Clock3,
  MessageSquareText,
  TerminalSquare,
  Wrench,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { ConversationListItem, TimelineEvent } from '../../core/types'
import { parseXiaoBaRuntimeToolMessage, resolveXiaoBaPromptResources } from '../../core/xiaoba'
import { useSessionStore } from '../../store/sessionStore'
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
          <ExpandablePre
            text={typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
            className="rounded border border-separator bg-under-page-background px-2.5 py-2"
          />
        </div>
      )}
      {result !== undefined && (
        <div className="mt-2">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase text-tertiary">
            <CheckCircle2 size={11} strokeWidth={1.75} className="text-success" aria-hidden />
            Result
          </div>
          <ExpandablePre
            text={result}
            className="rounded border border-separator bg-under-page-background px-2.5 py-2"
          />
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

  return (
    <div className="flex flex-col gap-4">
      <Section
        icon={role === 'tool'
          ? <Wrench size={14} strokeWidth={1.75} aria-hidden />
          : <MessageSquareText size={14} strokeWidth={1.75} aria-hidden />}
        title={role === 'user' ? 'Received input' : role === 'tool' ? 'Tool result' : 'Agent message'}
        meta={role}
      >
        <TextBody>{content}</TextBody>
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
                <div className="mb-2 break-all font-mono text-[10px] text-tertiary">
                  {resource.path}
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

  if (stringValue(raw, 'recordType')) return <SubagentTranscriptExecution raw={raw} />
  if (stringValue(raw, 'entry_type') === 'branch') return <BranchExecution raw={raw} />

  if (event.kind === 'turn') {
    return <TurnExecution event={event} raw={raw} conversationItems={conversationItems} />
  }
  if (event.kind === 'tool_call' || event.kind === 'tool_result') {
    return <RuntimeToolExecution raw={raw} />
  }
  if (event.kind === 'runtime') return <RuntimeExecution raw={raw} />
  if (event.kind === 'prompt_trace') return <PromptExecution raw={raw} resources={resources} />
  if (event.kind === 'subagent_event') return <SubagentExecution raw={raw} />
  return <ContextMessageExecution raw={raw} />
}
