<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

# Trading Laboratory

A virtual prop trading firm simulator where AI agents design and evaluate trading strategies through backtesting.

## Project Context

- **Constitution**: `.specify/memory/constitution.md`
- **Stack**: TypeScript, Claude agents, web dashboard
- **Mode**: Backtesting only — no live trading

## Core Rules (from Constitution)

1. Strategies are natural language descriptions — never parameter templates
2. All data inputs are config-driven per experiment
3. Every strategy must satisfy prop firm rules (Daily Loss Limit, Max Loss, Profit Target, Time Limit, Consistency)
4. Evaluation is done by a separate agent with reproducible results
5. No live order execution, ever

## Spec-Kit Skills

Use these in order:
- `/speckit-constitution` — project principles (done ✅)
- `/speckit-specify` — full system specification (done ✅)
- `/speckit-clarify` — clarifying questions (done ✅)
- `/speckit-plan` — implementation plan
- `/speckit-tasks` — task list
- `/speckit-implement` — implementation
