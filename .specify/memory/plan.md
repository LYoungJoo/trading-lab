# Implementation Plan: Trading Laboratory

**Branch**: `001-trading-laboratory` | **Date**: 2026-05-02 | **Spec**: `.specify/memory/spec.md`

## Summary

A local web dashboard where users configure experiments, run a Claude-powered strategy agent that outputs A–C trading setups in natural language, optionally trigger a mock evaluation agent for scoring, and compare experiments via a composite score ranking. Stack: Next.js (TypeScript) + SQLite + Claude API.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 20+
**Primary Dependencies**: Next.js 14 (App Router), Drizzle ORM, better-sqlite3, Anthropic SDK (@anthropic-ai/sdk), Tailwind CSS, shadcn/ui
**Storage**: SQLite (single file, local — via Drizzle ORM)
**Testing**: Vitest (unit), Playwright (e2e)
**Target Platform**: Local (localhost), single user
**Project Type**: Full-stack web application (Next.js monorepo)
**Performance Goals**: Strategy agent response within 2min; evaluation within 60s
**Constraints**: No auth, no live trading, no external DB, runs on localhost
**Scale/Scope**: Single user, dozens of experiments

## Constitution Check

✅ **Strategy Freedom** — Agent receives only natural language prompt; no parameter templates in code
✅ **Config-Driven Experimentation** — All data inputs come from ExperimentConfig; nothing hardcoded
✅ **Prop Firm Rule Compliance** — Rules listed in config; injected into strategy agent prompt
✅ **Objective Evaluation** — Evaluation is a separate agent call, not part of strategy generation
✅ **Backtesting Only** — No exchange connection for orders; data APIs are read-only historical fetches

## Project Structure

### Documentation

```text
.specify/memory/
├── constitution.md      ✅ done
├── spec.md              ✅ done
├── plan.md              ✅ this file
└── tasks.md             (next — /speckit-tasks)
```

### Source Code

```text
trading-laboratory/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout with Nav
│   ├── page.tsx                  # Experiments list + ranking
│   ├── experiments/
│   │   ├── new/page.tsx          # Config form (?from=[id] for duplication)
│   │   └── [id]/page.tsx         # Experiment result view
│   ├── data-storage/
│   │   └── page.tsx              # Download management UI
│   └── api/
│       ├── experiments/
│       │   ├── route.ts          # GET list, POST create
│       │   └── [id]/
│       │       ├── route.ts      # GET single experiment
│       │       ├── run/route.ts  # POST trigger strategy agent
│       │       └── evaluate/route.ts  # POST trigger evaluation agent
│       └── data-storage/
│           ├── providers/route.ts       # GET available providers
│           ├── symbols/route.ts         # GET validate symbol
│           ├── datasets/
│           │   ├── route.ts             # GET dataset summary list
│           │   └── [symbol]/route.ts    # DELETE symbol data
│           └── jobs/
│               ├── route.ts             # GET job list, POST create download job
│               └── [id]/route.ts        # GET single job status
├── components/
│   ├── Nav.tsx                   # Top navigation (Experiments / Data Storage)
│   ├── ExperimentForm.tsx        # Config form (market, dates, timeframes, indicators, rules, downloaded symbol picker)
│   ├── ExperimentCard.tsx        # Ranking list item with duplicate button
│   ├── StrategyDisplay.tsx       # A/B/C setups, categories, allocation bar, reasoning
│   └── EvaluationPanel.tsx       # Scores + per-rule assessment + mock badge
├── lib/
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema (experiments, strategies, evaluations, marketData, downloadJobs)
│   │   ├── queries.ts            # All DB query functions
│   │   ├── index.ts              # DB connection (WAL mode, FK on)
│   │   └── migrations/           # SQL migration files (auto-applied on startup)
│   ├── agents/
│   │   ├── strategy.ts           # Strategy agent — prompt, Claude call, JSON parse, normalization
│   │   └── evaluation.ts         # Evaluation agent — scoring, composite formula, mock flag
│   ├── data/
│   │   ├── index.ts              # fetchMarketData: DB-first, indicator computation
│   │   ├── binance.ts            # Binance REST OHLCV (paginated)
│   │   ├── alphavantage.ts       # Alpha Vantage OHLCV
│   │   └── krx.ts                # KRX OHLCV (mock fallback when API key absent)
│   ├── providers/
│   │   ├── types.ts              # DataProvider interface, ProviderInfo, DownloadRequest
│   │   ├── yahoo.ts              # Yahoo Finance provider (yahoo-finance2)
│   │   └── index.ts              # Provider registry: getProvider(), listProviders()
│   └── types.ts                  # Shared TypeScript types
├── drizzle.config.ts
├── next.config.ts
├── package.json
└── .env.local                    # ANTHROPIC_API_KEY, ALPHA_VANTAGE_KEY, KRX_API_KEY, ALLOW_UNSAFE_TLS
```

## Implementation Phases

### Phase 0 — Foundation (data layer + types)
1. Init Next.js project with TypeScript + Tailwind + shadcn/ui
2. Set up SQLite with Drizzle ORM; define schema (see Data Model below)
3. Define shared TypeScript types (`ExperimentConfig`, `Strategy`, `Setup`, `EvaluationResult`)
4. Run `drizzle-kit generate` + `migrate`

### Phase 1 — Data Fetching
5. Implement `binance.ts` — fetch OHLCV from Binance REST API (no key needed)
6. Implement `alphavantage.ts` — fetch US futures OHLCV (requires API key)
7. Implement `krx.ts` — fetch Korean futures OHLCV from KRX Open API (requires API key)
8. Expose `/api/data/fetch` route for on-demand data validation in config form

### Phase 2 — Strategy Agent
9. Implement `lib/agents/strategy.ts`:
   - Build prompt from config (market context, enabled indicators, prop firm rules, fund allocation instruction)
   - Call Claude API (streaming preferred)
   - Parse response into structured `Strategy` object (A–C setups with categories, allocation, stop-loss, reasoning)
10. Expose `/api/experiments/[id]/run` — saves strategy result to DB

### Phase 3 — Backend API
11. `GET /api/experiments` — list all experiments with evaluation scores, ordered by composite score (nulls last)
12. `POST /api/experiments` — create new experiment from config form
13. `GET /api/experiments/[id]` — single experiment with strategy + evaluation

### Phase 4 — Frontend Dashboard
14. **Experiments list page** (`/`) — ranked cards showing experiment name, config summary, composite score badge, status
15. **New experiment form** (`/experiments/new`) — form with all config fields; validate fund allocation on submit
16. **Experiment result page** (`/experiments/[id]`) — strategy display (setups by category, allocation breakdown, reasoning), evaluation panel, "Evaluate" button

### Phase 5 — Evaluation Agent (mock)
17. Implement `lib/agents/evaluation.ts`:
    - Read strategy natural language + prop firm rules from config
    - Ask Claude to score: compliance (0–100), risk quality (0–100), clarity (0–100) + per-rule pass/fail
    - Save scores to DB; composite = (compliance × 0.5) + (riskQuality × 0.3) + (clarity × 0.2)
18. Expose `/api/experiments/[id]/evaluate` — triggers evaluation, returns scores

### Phase 6 — Polish
19. Streaming output support (SSE or response streaming from Claude API)
20. Config duplication (duplicate button on experiment card — navigates to `/experiments/new?from=[id]`)
21. Error states (API unreachable, agent timeout, invalid allocation)

### Phase 7 — Data Storage (implemented in v1)
22. Provider abstraction layer (`lib/providers/`): `DataProvider` interface, `ProviderInfo`, provider registry
23. Yahoo Finance provider (`lib/providers/yahoo.ts`) using `yahoo-finance2`, timeframes 1m/5m/1h/1d/1w
24. `marketData` and `downloadJobs` tables added to Drizzle schema + migrations
25. Download job API (`POST /api/data-storage/jobs`): creates job, returns `jobId` immediately, runs `fetchCandles` + `insertMarketDataBatch` via `setImmediate` (background, non-blocking)
26. Dataset management APIs: GET datasets, DELETE dataset, GET/list jobs, GET single job, GET providers, GET symbol validation
27. Data Storage page (`/data-storage`): active jobs with progress bars, datasets table, new download form with symbol validation
28. Nav component (`components/Nav.tsx`) with active route highlighting
29. DB-first data path in `lib/data/index.ts`: checks local `market_data` before live API with 2-day coverage tolerance
30. `allocationNormalized` flag: column in `strategies` table + migration, normalization logic in strategy agent, warning banner in UI
31. ExperimentForm integration: fetches downloaded datasets, shows symbol dropdown, auto-fills date range from stored extents

## Data Model (SQLite / Drizzle)

```typescript
// experiments
id: text (uuid, pk)
name: text
status: text  // 'pending' | 'running' | 'complete' | 'failed'
config: text  // JSON — ExperimentConfig
createdAt: integer (timestamp)
completedAt: integer (timestamp, nullable)
executionLog: text (nullable)

// strategies
id: text (uuid, pk)
experimentId: text (fk → experiments, unique)
setups: text  // JSON — Setup[]
reasoning: text
allocationNormalized: integer  // 0 | 1; 1 = allocations were >100% and normalized
createdAt: integer

// evaluations
id: text (uuid, pk)
experimentId: text (fk → experiments, unique)
complianceScore: real
riskQualityScore: real
clarityScore: real
compositeScore: real
perRuleAssessment: text  // JSON — RuleAssessment[]
isMock: integer  // 1 = mock (agent-scored), 0 = real compliance check (future)
createdAt: integer

// market_data
id: text (uuid, pk)
symbol: text
timeframe: text  // '1m' | '5m' | '1h' | '1d' | '1w'
timestamp: integer  // Unix ms (open time)
open/high/low/close/volume: real
provider: text
UNIQUE INDEX on (symbol, timeframe, timestamp)

// download_jobs
id: text (uuid, pk)
symbol/provider/timeframe: text
startDate/endDate: text  // ISO date strings
status: text  // 'pending' | 'running' | 'complete' | 'failed'
totalRows: integer (nullable)
insertedRows: integer (default 0)
errorMessage: text (nullable)
createdAt: integer
completedAt: integer (nullable)
```

## Key Agent Prompts (outline)

**Strategy agent system prompt includes:**
- Project constitution principles (freedom, config-driven, prop firm rules)
- Config-provided context: market, date range, enabled timeframes, enabled indicators
- Active prop firm rules with descriptions
- Instruction: output A–C setups in structured format (time/indicator/price categories, allocation %, stop-loss, reasoning)

**Evaluation agent system prompt includes:**
- The strategy's natural language setups
- Active prop firm rules
- Scoring rubric for each dimension (0–100 scale with anchor descriptions)
- Instruction: return JSON with scores + per-rule assessments

## Environment Variables

```
ANTHROPIC_API_KEY=         # Required — Claude strategy + evaluation agents
CLAUDE_MODEL=              # Optional — defaults to 'claude-sonnet-4-6'
ALPHA_VANTAGE_API_KEY=     # Required for US futures data
KRX_API_KEY=               # Required for Korean futures data (apply at data.krx.co.kr)
                           # If absent, krx.ts returns synthetic mock OHLCV data
ALLOW_UNSAFE_TLS=          # Dev only (set to '1') — relaxes TLS for yahoo-finance2
# Binance API — no key needed for historical public data
```
