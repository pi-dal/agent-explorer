import { useEffect, useState } from 'react'
import {
  calculateUsageCost,
  fetchModelPricing,
  formatUsd,
  resolveModelPricing,
  type ModelPricing,
  type UsageCostBreakdown,
} from '../../core/modelPricing'
import type { Selection } from '../../core/types'
import { SummaryRow } from './SummaryRow'

type PricingState = 'idle' | 'loading' | 'ready' | 'error'

function formatMetricValue(
  count: number,
  cost: number | undefined,
  pricingState: PricingState,
): string {
  if (cost === undefined || pricingState !== 'ready') {
    return count.toLocaleString()
  }
  return `${count.toLocaleString()} (${formatUsd(cost)})`
}

export function UsagePanel({ selection }: { selection: Selection }) {
  const [pricingState, setPricingState] = useState<PricingState>('idle')
  const [pricingTable, setPricingTable] = useState<Record<string, ModelPricing> | null>(
    null,
  )

  useEffect(() => {
    let cancelled = false
    setPricingState('loading')
    void fetchModelPricing()
      .then((table) => {
        if (cancelled) return
        setPricingTable(table)
        setPricingState('ready')
      })
      .catch(() => {
        if (cancelled) return
        setPricingState('error')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const { usage, model } = selection.event || {}
  if (!usage) {
    return null
  }

  const modelPricing =
    pricingState === 'ready' && pricingTable
      ? resolveModelPricing(pricingTable, model)
      : undefined

  const costs: UsageCostBreakdown | undefined = modelPricing
    ? calculateUsageCost(usage, modelPricing)
    : undefined

  const rows: Array<{ label: string; value: string }> = []

  if (model) rows.push({ label: 'Model', value: model })

  rows.push({
    label: 'Input tokens',
    value: formatMetricValue(usage.inputTokens, costs?.input, pricingState),
  })
  rows.push({
    label: 'Cache write tokens',
    value: formatMetricValue(
      usage.cacheCreationInputTokens,
      costs?.cacheCreation,
      pricingState,
    ),
  })
  rows.push({
    label: 'Cache read tokens',
    value: formatMetricValue(usage.cacheReadInputTokens, costs?.cacheRead, pricingState),
  })
  rows.push({
    label: 'Output tokens',
    value: formatMetricValue(usage.outputTokens, costs?.output, pricingState),
  })

  if (pricingState === 'loading') {
    rows.push({ label: 'Estimated total', value: 'Fetching model pricing...' })
  } else if (pricingState === 'error') {
    rows.push({ label: 'Estimated total', value: 'Pricing unavailable' })
  } else if (costs) {
    rows.push({ label: 'Estimated total', value: formatUsd(costs.total) })
  } else if (model) {
    rows.push({ label: 'Estimated total', value: 'Pricing unavailable for this model' })
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <SummaryRow key={row.label} label={row.label} value={row.value} />
      ))}
    </div>
  )
}
