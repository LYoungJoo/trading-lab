// T015 — Strategy Agent using Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';
import type {
  ExperimentConfig,
  MarketData,
  Strategy,
  Setup,
  SetupCategory,
  Candle,
} from '../types';

// ─────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────

function formatCandle(c: Candle): string {
  const date = new Date(c.timestamp).toISOString().split('T')[0];
  return `${date} O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${c.volume.toFixed(0)}`;
}

function formatIndicators(marketData: MarketData): string {
  const { indicators, candles } = marketData;
  const lastIdx = candles.length - 1;
  const lines: string[] = [];

  if (indicators.rsi && indicators.rsi.length > 0) {
    const val = indicators.rsi[lastIdx];
    if (!isNaN(val)) lines.push(`RSI(14): ${val.toFixed(2)}`);
  }

  if (indicators.macd) {
    const m = indicators.macd.macd[lastIdx];
    const s = indicators.macd.signal[lastIdx];
    const h = indicators.macd.histogram[lastIdx];
    if (!isNaN(m) && !isNaN(s) && !isNaN(h)) {
      lines.push(
        `MACD(12,26,9): Line=${m.toFixed(4)} Signal=${s.toFixed(4)} Histogram=${h.toFixed(4)}`
      );
    }
  }

  if (indicators.ma20) {
    const val = indicators.ma20[lastIdx];
    if (!isNaN(val)) lines.push(`20MA: ${val.toFixed(2)}`);
  }

  if (indicators.ma50) {
    const val = indicators.ma50[lastIdx];
    if (!isNaN(val)) lines.push(`50MA: ${val.toFixed(2)}`);
  }

  return lines.length > 0 ? lines.join('\n') : 'No indicator data available';
}

/**
 * Build the strategy prompt with market context and instructions.
 */
export function buildStrategyPrompt(
  config: ExperimentConfig,
  marketData: MarketData
): string {
  const { symbol, dateRange, timeframes, propFirmRules } = config;
  const activeRules = propFirmRules.filter((r) => r.enabled);

  // Last 20 candles summary
  const last20 = marketData.candles.slice(-20);
  const candleSummary =
    last20.length > 0
      ? last20.map(formatCandle).join('\n')
      : 'No candle data available';

  // Indicator values
  const indicatorSummary = formatIndicators(marketData);

  // Prop firm rules
  const rulesSection =
    activeRules.length > 0
      ? activeRules
          .map((r) => `- ${r.name}${r.description ? ': ' + r.description : ''}`)
          .join('\n')
      : 'No prop firm rules active';

  return `You are an expert trading strategist. Analyze the following market data and generate 1–3 trading setups (labeled A, B, and optionally C) for a prop firm trader.

## Market Context
- Symbol: ${symbol}
- Market: ${config.market}
- Data Source: ${config.dataSource}
- Date Range: ${dateRange.start} to ${dateRange.end}
- Active Timeframes: ${timeframes.join(', ')}

## Recent OHLCV Data (last ${last20.length} candles)
${candleSummary}

## Computed Indicator Values
${indicatorSummary}

## Active Prop Firm Rules
${rulesSection}

## Constitution Principles
1. **Strategy Freedom**: You have freedom to suggest any technically sound setup, including trend-following, mean-reversion, breakout, or time-based plays.
2. **Prop Firm Compliance**: All setups must respect the active prop firm rules above. Do not suggest setups that would violate daily loss limits, max drawdown, or other active constraints.

## Instructions
Generate 1–3 trading setups. For each setup:
- Assign a label: A (primary), B (secondary), C (optional tertiary)
- Describe the entry condition in natural language (be specific and actionable)
- Classify the entry condition into one or more categories: "time" (time-based), "indicator" (indicator-based), "price" (price level / pattern based)
- Assign an allocation percentage of total capital (all setups must sum to ≤ 100%)
- Describe the stop-loss logic in natural language
- Provide your reasoning for choosing this setup

## Output Format
Respond with ONLY valid JSON in this exact structure (no markdown, no extra text):

{
  "setups": [
    {
      "name": "A",
      "naturalLanguage": "Enter long when ...",
      "categories": ["indicator", "price"],
      "allocationPct": 40,
      "stopLossLogic": "Place stop at ...",
      "reasoning": "This setup is selected because ..."
    }
  ],
  "overallReasoning": "Across all setups, the strategy aims to ..."
}

IMPORTANT: Respond with raw JSON only. No explanation before or after. No code fences.`;
}

// ─────────────────────────────────────────────────────────────
// Response parser
// ─────────────────────────────────────────────────────────────

interface RawSetup {
  name?: unknown;
  naturalLanguage?: unknown;
  categories?: unknown;
  allocationPct?: unknown;
  stopLossLogic?: unknown;
  reasoning?: unknown;
}

interface RawStrategyResponse {
  setups?: unknown;
  overallReasoning?: unknown;
}

function parseStrategyResponse(text: string): Strategy {
  // Extract JSON from inside markdown code fences if present (non-anchored so
  // any preamble text before/after the fence block is harmless), otherwise use
  // the raw trimmed response.
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/i);
  const cleaned = fenceMatch ? fenceMatch[1].trim() : trimmed;

  let parsed: RawStrategyResponse;
  try {
    parsed = JSON.parse(cleaned) as RawStrategyResponse;
  } catch (err) {
    throw new Error(`Failed to parse strategy JSON: ${err}\n\nRaw response:\n${text}`);
  }

  if (!Array.isArray(parsed.setups) || parsed.setups.length === 0) {
    throw new Error('Strategy response missing "setups" array');
  }

  const validCategories: SetupCategory[] = ['time', 'indicator', 'price'];

  const setups: Setup[] = (parsed.setups as RawSetup[]).map((s, idx) => {
    const name = String(s.name ?? String.fromCharCode(65 + idx)); // A, B, C
    const naturalLanguage = String(s.naturalLanguage ?? '');
    const rawCategories = Array.isArray(s.categories) ? s.categories : [];
    const categories: SetupCategory[] = rawCategories
      .map((c: unknown) => String(c) as SetupCategory)
      .filter((c) => validCategories.includes(c));

    if (categories.length === 0) categories.push('price'); // fallback

    let allocationPct =
      typeof s.allocationPct === 'number'
        ? s.allocationPct
        : parseFloat(String(s.allocationPct ?? '0'));
    if (isNaN(allocationPct)) allocationPct = 0;

    const stopLossLogic = String(s.stopLossLogic ?? '');
    const reasoning = String(s.reasoning ?? '');

    return { name, naturalLanguage, categories, allocationPct, stopLossLogic, reasoning };
  });

  const overallReasoning = String(parsed.overallReasoning ?? '');

  return { setups, overallReasoning };
}

// ─────────────────────────────────────────────────────────────
// Strategy agent runner
// ─────────────────────────────────────────────────────────────

export interface StrategyAgentResult extends Strategy {
  allocationNormalized: boolean;
}

/**
 * Run the strategy agent using Claude claude-sonnet-4-6.
 * Validates that total allocation ≤ 100%.
 */
export async function runStrategyAgent(
  config: ExperimentConfig,
  marketData: MarketData
): Promise<StrategyAgentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const model = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';
  const client = new Anthropic({ apiKey });

  const prompt = buildStrategyPrompt(config, marketData);

  console.log(`[StrategyAgent] Running with model=${model}, symbol=${config.symbol}`);
  console.log(`[StrategyAgent] Candles available: ${marketData.candles.length}`);

  const message = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Strategy agent returned no text content');
  }

  console.log(`[StrategyAgent] Response received (${textBlock.text.length} chars)`);
  console.log(`[StrategyAgent] Stop reason: ${message.stop_reason}`);

  const strategy = parseStrategyResponse(textBlock.text);

  // Validate allocation sum
  const totalAllocation = strategy.setups.reduce(
    (sum, s) => sum + s.allocationPct,
    0
  );

  console.log(
    `[StrategyAgent] Total allocation: ${totalAllocation.toFixed(1)}% across ${strategy.setups.length} setup(s)`
  );

  let allocationNormalized = false;
  if (totalAllocation > 100) {
    // Normalize proportionally to sum to 100
    console.warn(
      `[StrategyAgent] Allocation sum ${totalAllocation.toFixed(1)}% > 100% — normalizing`
    );
    const factor = 100 / totalAllocation;
    strategy.setups = strategy.setups.map((s) => ({
      ...s,
      allocationPct: Math.round(s.allocationPct * factor * 10) / 10,
    }));
    allocationNormalized = true;
  }

  return { ...strategy, allocationNormalized };
}
