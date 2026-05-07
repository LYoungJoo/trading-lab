# Feature Specification: Trading Laboratory

**Feature Branch**: `001-trading-laboratory`
**Created**: 2026-05-02
**Status**: Draft

## Clarifications

### Session 2026-05-07

- Q: Should the experiment run page stream Claude's output word-by-word or show the full result when done? → A: Full execution log only when done — no streaming in v1.
- Q: What is the maximum number of experiments that can run concurrently? → A: 3 — a 4th run attempt while 3 are active is rejected with a clear error.
- Q: Can completed experiments be re-run, or only failed ones? → A: Both failed and completed experiments can be re-run (resets to running, overwrites log and strategy).
- Q: Should experiments fall back to live API calls when local data is missing? → A: No — local data is mandatory. If no downloaded data covers the experiment's symbol/timeframe/date range, the run fails immediately with an error directing the user to download data first.
- Q: Where should the "Duplicate Config" button appear in the UI? → A: On both the experiment list card and the experiment detail page.

## User Scenarios & Testing

### User Story 1 - Run an Experiment and View Strategy (Priority: P1)

A user opens the dashboard, creates a new experiment by filling in a config form (market, date range, timeframes, indicators, prop firm rules), then runs the strategy agent. The agent outputs A/B/C setups in natural language, structured by category, with fund allocation and reasoning. The user reads the strategy and understands what the agent decided and why.

**Why this priority**: This is the entire core loop — without this, nothing else works.

**Independent Test**: Fill a config form, run the strategy agent, verify A/B/C setups appear with categories, allocation %, and reasoning text.

**Acceptance Scenarios**:

1. **Given** a completed config form, **When** the user clicks Run, **Then** the strategy agent executes and outputs at least one setup (A) with entry condition, fund allocation %, stop-loss, and reasoning
2. **Given** the strategy result is displayed, **When** the user reads it, **Then** setups are organized by category (time-based, indicator-based, price-based) for easy reading
3. **Given** the strategy agent is running, **When** the run completes, **Then** the full execution log is shown at once (no streaming in v1)

---

### User Story 2 - Compare Experiments via Ranking (Priority: P2)

A user has run multiple experiments. They go to the experiments list and see all experiments ranked by composite score (prop firm compliance, risk quality, clarity). They can identify which experiment configuration produced the best strategy quality.

**Why this priority**: The core value of a "laboratory" is comparison — without ranking, it's just a log viewer.

**Independent Test**: Create 2+ experiments, trigger mock evaluation on each, verify experiments list shows ranking with composite scores in descending order.

**Acceptance Scenarios**:

1. **Given** multiple completed experiments, **When** the user views the experiments list, **Then** experiments are ranked by composite score with scores visible
2. **Given** an experiment has been evaluated, **When** the user views the ranking, **Then** individual score components (compliance, risk quality, clarity) are visible alongside the composite
3. **Given** an experiment has not been evaluated, **When** it appears in the list, **Then** it shows as "not evaluated" rather than ranked

---

### User Story 3 - Run Mock Evaluation on a Strategy (Priority: P3)

After viewing a strategy, the user optionally triggers the evaluation agent. The evaluation agent reads the natural language setups and scores them on prop firm rule compliance, risk quality, and clarity. Scores are saved and shown on the experiment result page and factored into the ranking.

**Why this priority**: Evaluation is optional and mock — useful but not blocking the core loop.

**Independent Test**: Run evaluation on a completed experiment, verify scores (0–100 each) appear for compliance, risk quality, and clarity, and composite score is calculated.

**Acceptance Scenarios**:

1. **Given** a completed strategy result, **When** the user clicks "Evaluate", **Then** the evaluation agent runs and returns scores for each dimension
2. **Given** evaluation is complete, **When** the user views the result, **Then** all 5 prop firm rules are listed with pass/fail/partial assessment
3. **Given** evaluation is complete, **When** the user views the experiments list, **Then** this experiment's composite score is updated in the ranking

---

### User Story 4 - Reuse and Vary Configs (Priority: P4)

A user duplicates an existing experiment config, changes one variable (e.g. switches from 5m to 1h timeframe), and runs a new experiment to compare results.

**Why this priority**: Config variation is the "laboratory" workflow — change one variable, compare output.

**Independent Test**: Duplicate an experiment config, change one field, run new experiment, verify new experiment appears as a separate entry in the list.

**Acceptance Scenarios**:

1. **Given** an existing experiment, **When** the user clicks "Duplicate Config", **Then** the form pre-fills with all previous config values
2. **Given** a duplicated config, **When** the user modifies one field and runs it, **Then** a new separate experiment is created and tracked independently

---

### User Story 5 - Download and Manage Market Data (Priority: P2)

A user needs historical OHLCV data for a symbol before running experiments. They navigate to the Data Storage page, select a provider and timeframe, validate the symbol, choose a date range, and start a download. The download runs in the background; the user sees a progress indicator and is not blocked. Once downloaded, the data is stored locally in SQLite and reused automatically by future experiment runs.

**Why this priority**: Without local data, every experiment triggers a live API call with latency and rate-limit exposure. A managed local store decouples data acquisition from experiment runs.

**Independent Test**: Download 1d candles for a valid symbol, verify the dataset appears in the table with correct row count and date range, run an experiment over the same symbol+range and confirm no live API call is made.

**Acceptance Scenarios**:

1. **Given** a valid symbol and date range, **When** the user clicks "Start Download", **Then** a background job is created immediately and the UI shows an active job card with a progress bar
2. **Given** a completed download, **When** the user views the datasets table, **Then** the symbol appears with provider, timeframe, row count, and min/max date
3. **Given** a downloaded dataset, **When** a new experiment runs over the same symbol and date range, **Then** local data is used instead of making a live API call
4. **Given** a dataset the user no longer needs, **When** they click Delete and confirm, **Then** all rows for that symbol/provider pair are removed from the database
5. **Given** a download job that fails, **When** the user views the page, **Then** the error message is shown on the failed job card

---

### Edge Cases

- What if the strategy agent returns only 1 setup instead of 3? → Accept any number of setups (1–5), do not require exactly 3
- What if a market API is unreachable during experiment config? → Show clear error on form validation, do not allow run to start with invalid data source
- What if two experiments run simultaneously and one finishes first? → Each experiment is independent; results do not interfere
- What if the user leaves the page mid-run? → Experiment continues running in backend; status shown as "Running" when user returns
- What if the strategy agent produces a setup that violates prop firm rules? → Still display it; evaluation agent flags it; do not block display
- What if a download job fails halfway through? → Mark job as 'failed', store the error message, keep any rows that were already inserted; user must re-trigger the download to retry
- What if a symbol exists on Yahoo Finance but not in any experimental market (crypto/futures)? → Yahoo Finance is for pre-downloading only; market selection in the experiment form maps to the appropriate live provider (Binance, Alpha Vantage, KRX)

## Requirements

### Functional Requirements

- **FR-001**: System MUST provide a form-based experiment config with fields: market (crypto/US futures/Korean futures), date range, timeframes (multi-select: 1m, 5m, 1h, day, week), indicators (toggle: RSI, MACD, 20MA, 50MA, etc.), prop firm rules (toggle per rule: Daily Loss Limit, Max Loss, Profit Target, Time Limit, Consistency)
- **FR-002**: System MUST read historical OHLCV data exclusively from local SQLite storage; live API providers (Binance, Alpha Vantage, KRX) are used ONLY in the Data Storage download flow, never during experiment runs
- **FR-003**: System MUST pass only config-enabled data and indicators to the strategy agent — no additional context
- **FR-004**: Strategy agent MUST output A–C setups (1–5 allowed) in natural language, each including: entry condition, fund allocation %, stop-loss logic, and reasoning
- **FR-005**: System MUST display setups structured by category: time-based conditions, indicator-based conditions, price-based conditions
- **FR-006**: System MUST show fund allocation breakdown across all setups (must sum to ≤ 100%)
- **FR-007**: System MUST support parallel experiment execution with a maximum of 3 concurrent running experiments; a 4th run attempt while 3 are active MUST be rejected with a clear error message
- **FR-008**: System MUST show the full execution log when the strategy agent completes — no streaming in v1
- **FR-009**: System MUST maintain an experiments list ranked by composite evaluation score (descending); unevaluated experiments shown separately
- **FR-010**: Evaluation agent MUST score each experiment on: prop firm rule compliance (0–100), risk quality (0–100), clarity (0–100); composite = weighted average
- **FR-011**: Evaluation agent execution MUST be optional and manually triggered
- **FR-012**: System MUST support config duplication via a "Duplicate Config" button present on both the experiment list card and the experiment detail page; both navigate to the new experiment form with all fields pre-filled via `?from=[experimentId]`
- **FR-013**: System MUST NOT require authentication — local use only
- **FR-014**: System MUST NOT connect to any live exchange or place real orders

### Data Storage (implemented in v1)

- **FR-015**: System MUST provide a Data Storage page where users can download historical OHLCV market data to a local SQLite store before running experiments
- **FR-016**: System MUST support downloading data via a pluggable provider interface; v1 ships with Yahoo Finance (`yahoo-finance2`) as the only registered provider, supporting timeframes: 1m (7d max), 5m (60d max), 1h (2yr max), 1d (full history), 1w (full history)
- **FR-017**: Downloads MUST run as non-blocking background jobs — the API returns immediately with a `jobId`; the client polls for status
- **FR-018**: System MUST track download job lifecycle: `pending → running → complete | failed`; store `totalRows`, `insertedRows`, and `errorMessage` per job
- **FR-019**: System MUST insert candles in batches of 5000 using `onConflictDoNothing` on the unique index (symbol, timeframe, timestamp), reporting only actual inserted rows
- **FR-020**: System MUST expose a datasets endpoint returning all stored symbols with provider, timeframe, row count, minDate, and maxDate
- **FR-021**: System MUST allow deleting all data for a symbol/provider pair; the endpoint returns the count of deleted rows
- **FR-022**: System MUST read market data exclusively from local SQLite; if no locally downloaded data covers the experiment's symbol, timeframe, and date range, the run MUST fail immediately with a clear error directing the user to download data first via the Data Storage page — no live API fallback
- **FR-023**: Experiment config form MUST show a dropdown of locally downloaded symbols for the selected market; selecting one auto-fills the date range from the stored data extents; manual entry is still available

### Agent Behavior Contracts

- **FR-024**: Strategy agent MUST receive only the last 20 candles of the primary timeframe along with computed indicators (RSI-14, MACD 12/26/9, SMA-20, SMA-50) — not the full date range of raw data
- **FR-025**: If the strategy agent returns setups whose allocations sum to more than 100%, the system MUST normalize them proportionally to sum to exactly 100%, set `allocationNormalized = true` on the saved strategy, and display a warning banner on the experiment result page
- **FR-026**: Evaluation agent MUST set `isMock = true` on all results to distinguish agent-scored evaluations from future real compliance checks; the UI MUST display a "Mock Evaluation" badge accordingly
- **FR-027**: Composite score formula is fixed: `(complianceScore × 0.5) + (riskQualityScore × 0.3) + (clarityScore × 0.2)`; all three component scores are clamped to 0–100 before the calculation

### Operational Behaviors

- **FR-028**: Experiments in `failed` or `complete` status MAY be re-run; the run endpoint resets status to `running` and overwrites the previous execution log and strategy
- **FR-029**: If no experiment name is provided, the system generates one as `{market} {symbol} {startDate}–{endDate}`
- **FR-030**: Execution log entries MUST use the format `[ISO-8601 timestamp] message`; the log is stored in the `execution_log` column and shown collapsibly in the UI

### Key Entities

- **Experiment**: A single run defined by a config + outputs a strategy result + optional evaluation scores. Has status: Pending / Running / Complete / Failed.
- **ExperimentConfig**: Market, dateRange, timeframes[], indicators[], propFirmRules[], dataSource
- **Strategy**: The agent's output — an array of Setups + overall reasoning
- **Setup**: name (A/B/C), naturalLanguageDescription, categories (time/indicator/price), allocationPct, stopLossLogic, reasoning
- **EvaluationResult**: complianceScore, riskQualityScore, clarityScore, compositeScore, perRuleAssessment[], status (mock/real)
- **DataSource**: type (crypto/usFutures/krFutures), provider (Binance/AlphaVantage/KRX), apiKey?
- **MarketDataRecord**: id, symbol, timeframe, timestamp (Unix ms), OHLCV floats, provider — stored in `market_data` table with unique index on (symbol, timeframe, timestamp)
- **DownloadJob**: id, symbol, provider, timeframe, startDate, endDate, status (pending|running|complete|failed), totalRows?, insertedRows, errorMessage?, createdAt, completedAt? — stored in `download_jobs` table
- **DataProvider** (interface): `info: ProviderInfo`, `validateSymbol(symbol)`, `getAvailableRange(symbol, timeframe)`, `fetchCandles(request)` — abstraction layer in `lib/providers/`

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can go from blank config form to viewing a complete A/B/C strategy in under 3 minutes (excluding API latency)
- **SC-002**: Experiments list correctly ranks all evaluated experiments by composite score with no ties broken arbitrarily
- **SC-003**: Mock evaluation always returns scores for all 3 dimensions within 60 seconds of being triggered
- **SC-004**: Running 3 experiments simultaneously does not cause any single experiment to fail or corrupt another's results
- **SC-005**: Strategy display is readable without domain expertise — categories clearly label what type of condition each setup uses
- **SC-006**: Zero live API calls are made during any experiment run — all market data is read from local SQLite; missing data causes an immediate failure with a clear error
- **SC-007**: A download job for 1 year of daily data completes and is reflected in the datasets table within 30 seconds of being triggered

## Assumptions

- No authentication required — single user, local deployment
- Backtesting engine is mocked in v1; real simulation deferred to v2
- Strategy agent is Claude (model configurable via env var); evaluation agent is also Claude
- Data APIs are called at experiment run time, not pre-fetched; API keys provided via environment variables
- Korean futures scope = KOSPI 200 futures via KRX Open API; US futures = CME products via Alpha Vantage
- No streaming in v1 — the full execution log is shown only after the strategy agent completes
- Maximum of 5 setups per strategy (A–E); minimum 1
- All fund allocations from the agent must sum to ≤ 100%; if the agent exceeds 100%, the system normalizes all allocations proportionally and sets `allocationNormalized = true` (displayed as a warning banner, not an error)
- Prop firm rules are non-negotiable except Consistency Rule which is toggleable per config
- KRX data integration requires institutional API registration (data.krx.co.kr); in the absence of a valid `KRX_API_KEY`, `krx.ts` returns synthetic mock OHLCV data (random walk ±2%, skipping weekends) for development purposes
- The `strategies.allocationNormalized` column (integer 0|1) is stored in the DB for auditability; all downstream reads hydrate it as a boolean
- All evaluation results carry `isMock = true` in v1; the flag exists to distinguish future real compliance checks from the current agent-scored approximation
- Polling intervals: experiments list page 4s while any experiment is `running`; experiment detail page 3s while that experiment is `running`; data storage page 2s while any job is `pending` or `running`
- Config duplication is implemented via the URL query parameter `?from=[experimentId]` on the new experiment page; a "Duplicate Config" button appears on both the experiment list card and the experiment detail page
