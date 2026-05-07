<!-- Sync Impact Report
Version change: (new) → 1.0.0
Added sections: Core Principles, Technology & Architecture, Development Workflow, Governance
Templates requiring updates: ✅ constitution.md written fresh
Follow-up TODOs: none
-->

# Trading Laboratory Constitution

## Core Principles

### I. Strategy Freedom
Every trading strategy MUST be expressed as a natural language description — never as a fixed set of parameters. Agents are free to invent any setup structure, entry condition, or logic they can describe in plain language. Parameter templates that constrain creativity are prohibited. A setup must include: entry condition, fund allocation, and stop-loss logic.

### II. Config-Driven Experimentation
All data inputs available to a strategy agent (market, date range, timeframes, indicators) MUST be declared in an experiment config before any agent runs. Agents may only use data explicitly enabled in that config. Changing the config defines a new experiment. Nothing is hardcoded in agent prompts or code.

### III. Prop Firm Rule Compliance
Every strategy MUST be designed to satisfy the following prop firm rules over the long term — not just in individual trades:
1. Daily Loss Limit Rule
2. Maximum Loss Limit
3. Profit Target Requirement
4. Time Limit Rule
5. Consistency Rule (config: enabled/disabled per experiment)

The strategy agent must explicitly reason about each applicable rule when designing setups.

### IV. Objective Evaluation
Strategy evaluation MUST be performed by a dedicated evaluation agent, separate from the strategy agent. Evaluation uses consistent backtesting metrics (P&L, max drawdown, win rate, Sharpe ratio, rule compliance score). Results are reproducible: same config + same strategy = same evaluation output.

### V. Backtesting Only
This is a simulation environment. No live order execution. All trading logic runs against historical data. The system MUST never connect to a live exchange or place real orders.

## Technology & Architecture

- **Language**: TypeScript
- **Agent**: Claude (default); agent provider is swappable via config
- **UI**: Web dashboard — all experiment results, strategy descriptions, and evaluations are visible there
- **Data**: Historical OHLCV + indicators, config-scoped per experiment
- **Deployment**: Local-first

## Development Workflow

1. Define an experiment config (market, date range, timeframes, indicators, prop firm rules)
2. Run the strategy agent — it outputs A/B/C setups (natural language) + fund allocation %
3. Run the evaluation agent — it scores each setup against backtested data and prop firm rules
4. Review results on the web dashboard
5. Adjust config and repeat

No strategy may proceed to evaluation without a complete natural language description including entry condition, fund allocation, and stop-loss.

## Governance

This constitution supersedes all other practices and design decisions. Amendments require updating this document with a version bump and rationale. All implementation decisions must be checked against the five core principles. The Consistency Rule (Principle III.5) may be toggled per experiment via config — all other rules are non-negotiable.

**Version**: 1.0.0 | **Ratified**: 2026-04-26 | **Last Amended**: 2026-05-02
