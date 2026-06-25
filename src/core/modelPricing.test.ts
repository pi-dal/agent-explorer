import { describe, expect, it } from 'vitest'
import {
  calculateUsageCost,
  formatUsd,
  parseLiteLlmPricingTable,
  resolveModelPricing,
} from './modelPricing'

describe('parseLiteLlmPricingTable', () => {
  it('keeps only models with the token costs we need', () => {
    const table = parseLiteLlmPricingTable({
      'claude-opus-4-7': {
        input_cost_per_token: 5e-6,
        output_cost_per_token: 2.5e-5,
        cache_creation_input_token_cost: 6.25e-6,
        cache_read_input_token_cost: 5e-7,
        max_tokens: 128000,
      },
      incomplete: {
        input_cost_per_token: 1e-6,
      },
    })

    expect(table['claude-opus-4-7']).toEqual({
      inputCostPerToken: 5e-6,
      outputCostPerToken: 2.5e-5,
      cacheCreationInputTokenCost: 6.25e-6,
      cacheReadInputTokenCost: 5e-7,
    })
    expect(table.incomplete).toBeUndefined()
  })
})

describe('resolveModelPricing', () => {
  const table = parseLiteLlmPricingTable({
    'claude-opus-4-7': {
      input_cost_per_token: 5e-6,
      output_cost_per_token: 2.5e-5,
      cache_creation_input_token_cost: 6.25e-6,
      cache_read_input_token_cost: 5e-7,
    },
  })

  it('matches exact and stripped model ids', () => {
    expect(resolveModelPricing(table, 'claude-opus-4-7')).toBeDefined()
    expect(resolveModelPricing(table, 'unknown-model')).toBeUndefined()
  })
})

describe('calculateUsageCost', () => {
  it('computes per-category and total costs', () => {
    const pricing = {
      inputCostPerToken: 5e-6,
      outputCostPerToken: 2.5e-5,
      cacheCreationInputTokenCost: 6.25e-6,
      cacheReadInputTokenCost: 5e-7,
    }

    const breakdown = calculateUsageCost(
      {
        inputTokens: 6,
        cacheCreationInputTokens: 30175,
        cacheReadInputTokens: 25392,
        outputTokens: 1042,
      },
      pricing,
    )

    expect(breakdown.input).toBeCloseTo(0.00003)
    expect(breakdown.total).toBeGreaterThan(0)
    expect(formatUsd(breakdown.total)).toMatch(/^\$/)
  })

  it('formats small and large USD amounts', () => {
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(0.004)).toBe('$0.0040')
    expect(formatUsd(0.42)).toBe('$0.42')
  })
})