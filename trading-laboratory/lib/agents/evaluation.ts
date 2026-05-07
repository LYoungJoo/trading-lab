// T026 — Evaluation Agent using Anthropic SDK
import Anthropic from '@anthropic-ai/sdk';
import type {
  ExperimentConfig,
  Strategy,
  EvaluationResult,
  RuleAssessment,
  PropFirmRuleName,
} from '../types';

// ─────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────

/**
 * Build the evaluation prompt including setup descriptions, active prop firm
 * rules, and a detailed scoring rubric for each dimension.
 */
export function buildEvaluationPrompt(
  strategy: Strategy,
  config: ExperimentConfig
): string {
  const activeRules = config.propFirmRules.filter((r) => r.enabled);

  // Format each setup
  const setupsSection = strategy.setups
    .map((s) => {
      return [
        `### Setup ${s.name}`,
        `**Entry Condition**: ${s.naturalLanguage}`,
        `**Categories**: ${s.categories.join(', ')}`,
        `**Allocation**: ${s.allocationPct}%`,
        `**Stop-Loss Logic**: ${s.stopLossLogic}`,
        `**Reasoning**: ${s.reasoning}`,
      ].join('\n');
    })
    .join('\n\n');

  // Format active prop firm rules
  const rulesSection =
    activeRules.length > 0
      ? activeRules
          .map((r) => `- **${r.name}**${r.description ? ': ' + r.description : ''}`)
          .join('\n')
      : 'No prop firm rules are currently active.';

  return `You are a prop firm compliance and risk evaluation expert. Evaluate the following trading strategy against the active prop firm rules and provide scores for three dimensions.

## Strategy to Evaluate

**Market**: ${config.market}
**Symbol**: ${config.symbol}
**Date Range**: ${config.dateRange.start} to ${config.dateRange.end}
**Timeframes**: ${config.timeframes.join(', ')}

### Strategy Setups

${setupsSection}

**Overall Reasoning**: ${strategy.overallReasoning}

---

## Active Prop Firm Rules

${rulesSection}

---

## Scoring Rubric

### Compliance Score (0–100)
Measures how well the strategy adheres to the active prop firm rules.
- **90–100**: All active rules are clearly satisfied in all setups; no risk of violation even in adverse conditions
- **70–89**: Most rules are satisfied; minor ambiguities but no clear violations
- **50–69**: Some concerns — certain setups may be borderline or contain unclear rule handling
- **<50**: Clear violations of one or more active rules, or strategy ignores important constraints

### Risk Quality Score (0–100)
Measures the quality of risk management built into the strategy.
- **90–100**: Excellent stop-loss definitions (specific price levels or %-based), explicit position sizing, clear drawdown awareness
- **70–89**: Good risk management; stops are defined but may be vague in some setups
- **50–69**: Partial risk management; stops mentioned but not specific, or position sizing not addressed
- **<50**: Poor risk management; vague or missing stops, no position sizing consideration

### Clarity Score (0–100)
Measures how executable and specific the setup descriptions are.
- **90–100**: Every setup is highly actionable — a trader could execute immediately with no ambiguity
- **70–89**: Generally clear with minor ambiguities in entry conditions or timing
- **50–69**: Somewhat vague — a trader would need additional interpretation
- **<50**: Too vague or abstract to execute; missing key details

---

## Per-Rule Assessment

For each active prop firm rule listed above, assess whether the strategy satisfies it.

---

## Output Format

Respond with ONLY valid JSON in this exact structure (no markdown, no extra text):

{
  "complianceScore": <integer 0-100>,
  "riskQualityScore": <integer 0-100>,
  "clarityScore": <integer 0-100>,
  "perRuleAssessment": [
    {
      "rule": "<rule name exactly as listed>",
      "assessment": "pass" | "partial" | "fail",
      "note": "<brief explanation of your assessment>"
    }
  ]
}

IMPORTANT:
- Respond with raw JSON only. No explanation before or after. No code fences.
- If no prop firm rules are active, return an empty array for perRuleAssessment.
- Be honest and rigorous — scores should reflect real concerns, not just give high marks by default.`;
}

// ─────────────────────────────────────────────────────────────
// Response parser
// ─────────────────────────────────────────────────────────────

interface RawRuleAssessment {
  rule?: unknown;
  assessment?: unknown;
  note?: unknown;
}

interface RawEvaluationResponse {
  complianceScore?: unknown;
  riskQualityScore?: unknown;
  clarityScore?: unknown;
  perRuleAssessment?: unknown;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseEvaluationResponse(
  text: string
): Pick<EvaluationResult, 'complianceScore' | 'riskQualityScore' | 'clarityScore' | 'perRuleAssessment'> {
  // Extract JSON from inside markdown code fences if present (non-anchored so
  // any preamble text before/after the fence block is harmless), otherwise use
  // the raw trimmed response.
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/i);
  const cleaned = fenceMatch ? fenceMatch[1].trim() : trimmed;

  let parsed: RawEvaluationResponse;
  try {
    parsed = JSON.parse(cleaned) as RawEvaluationResponse;
  } catch (err) {
    throw new Error(`Failed to parse evaluation JSON: ${err}\n\nRaw response:\n${text}`);
  }

  const complianceScore = clamp(Number(parsed.complianceScore ?? 0));
  const riskQualityScore = clamp(Number(parsed.riskQualityScore ?? 0));
  const clarityScore = clamp(Number(parsed.clarityScore ?? 0));

  const validAssessments = new Set<string>(['pass', 'partial', 'fail']);
  const perRuleAssessment: RuleAssessment[] = Array.isArray(parsed.perRuleAssessment)
    ? (parsed.perRuleAssessment as RawRuleAssessment[]).map((item) => ({
        ruleName: String(item.rule ?? '') as PropFirmRuleName,
        result: validAssessments.has(String(item.assessment))
          ? (String(item.assessment) as 'pass' | 'partial' | 'fail')
          : 'partial',
        note: String(item.note ?? ''),
      }))
    : [];

  return { complianceScore, riskQualityScore, clarityScore, perRuleAssessment };
}

// ─────────────────────────────────────────────────────────────
// Evaluation agent runner
// ─────────────────────────────────────────────────────────────

/**
 * Run the evaluation agent using Claude claude-sonnet-4-6.
 * Computes compositeScore = (compliance × 0.5) + (riskQuality × 0.3) + (clarity × 0.2).
 * Always sets isMock: true.
 */
export async function runEvaluationAgent(
  strategy: Strategy,
  config: ExperimentConfig
): Promise<EvaluationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const model = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';
  const client = new Anthropic({ apiKey });

  const prompt = buildEvaluationPrompt(strategy, config);

  console.log(`[EvaluationAgent] Running with model=${model}, symbol=${config.symbol}`);

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
    throw new Error('Evaluation agent returned no text content');
  }

  console.log(`[EvaluationAgent] Response received (${textBlock.text.length} chars)`);

  const { complianceScore, riskQualityScore, clarityScore, perRuleAssessment } =
    parseEvaluationResponse(textBlock.text);

  // Composite: (compliance × 0.5) + (riskQuality × 0.3) + (clarity × 0.2)
  const compositeScore = Math.round(
    complianceScore * 0.5 + riskQualityScore * 0.3 + clarityScore * 0.2
  );

  console.log(
    `[EvaluationAgent] Scores — Compliance: ${complianceScore}, Risk: ${riskQualityScore}, Clarity: ${clarityScore}, Composite: ${compositeScore}`
  );

  return {
    complianceScore,
    riskQualityScore,
    clarityScore,
    compositeScore,
    perRuleAssessment,
    isMock: true,
  };
}
