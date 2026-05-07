import { eq, desc, sql, and, gte, lte } from 'drizzle-orm';
import type { Candle } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { db } from './index';
import { experiments, strategies, evaluations, marketData, downloadJobs } from './schema';
import type {
  Experiment,
  ExperimentConfig,
  Strategy,
  EvaluationResult,
  ExperimentStatus,
} from '../types';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function now(): number {
  return Date.now();
}

function parseJson<T>(value: string | null | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

// ────────────────────────────────────────────────────────────
// createExperiment
// ────────────────────────────────────────────────────────────

export async function createExperiment(
  config: ExperimentConfig,
  name?: string
): Promise<Experiment> {
  const id = uuidv4();
  const experimentName =
    name ??
    `${config.market} ${config.symbol} ${config.dateRange.start}–${config.dateRange.end}`;

  const createdAt = now();

  await db.insert(experiments).values({
    id,
    name: experimentName,
    status: 'pending',
    config: JSON.stringify(config),
    createdAt,
  });

  return {
    id,
    name: experimentName,
    status: 'pending',
    config,
    createdAt,
  };
}

// ────────────────────────────────────────────────────────────
// getExperiment
// ────────────────────────────────────────────────────────────

export async function getExperiment(id: string): Promise<Experiment | null> {
  const [expRow] = await db
    .select()
    .from(experiments)
    .where(eq(experiments.id, id))
    .limit(1);

  if (!expRow) return null;

  const [stratRow] = await db
    .select()
    .from(strategies)
    .where(eq(strategies.experimentId, id))
    .limit(1);

  const [evalRow] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.experimentId, id))
    .limit(1);

  const config = parseJson<ExperimentConfig>(expRow.config);
  if (!config) {
    throw new Error(`Experiment ${id}: failed to parse config JSON`);
  }

  const strategy: Strategy | undefined = stratRow
    ? {
        setups: parseJson(stratRow.setups) ?? [],
        overallReasoning: stratRow.reasoning,
        allocationNormalized: stratRow.allocationNormalized === 1,
      }
    : undefined;

  const evaluation: EvaluationResult | undefined = evalRow
    ? {
        complianceScore: evalRow.complianceScore,
        riskQualityScore: evalRow.riskQualityScore,
        clarityScore: evalRow.clarityScore,
        compositeScore: evalRow.compositeScore,
        perRuleAssessment: parseJson(evalRow.perRuleAssessment) ?? [],
        isMock: evalRow.isMock === 1,
      }
    : undefined;

  return {
    id: expRow.id,
    name: expRow.name,
    status: expRow.status as ExperimentStatus,
    config,
    strategy,
    evaluation,
    executionLog: expRow.executionLog ?? undefined,
    createdAt: expRow.createdAt,
    completedAt: expRow.completedAt ?? undefined,
  };
}

// ────────────────────────────────────────────────────────────
// listExperiments
// Evaluated experiments ordered by compositeScore desc; unevaluated appended at bottom
// ────────────────────────────────────────────────────────────

export async function listExperiments(): Promise<Experiment[]> {
  // Fetch all experiments with a left-join to evaluations and strategies
  const rows = await db
    .select({
      exp: experiments,
      compositeScore: evaluations.compositeScore,
      complianceScore: evaluations.complianceScore,
      riskQualityScore: evaluations.riskQualityScore,
      clarityScore: evaluations.clarityScore,
      perRuleAssessment: evaluations.perRuleAssessment,
      isMock: evaluations.isMock,
      stratSetups: strategies.setups,
      stratReasoning: strategies.reasoning,
      stratAllocationNormalized: strategies.allocationNormalized,
    })
    .from(experiments)
    .leftJoin(evaluations, eq(evaluations.experimentId, experiments.id))
    .leftJoin(strategies, eq(strategies.experimentId, experiments.id))
    .orderBy(
      // Evaluated first (compositeScore not null), then by score desc, then by createdAt desc
      sql`CASE WHEN ${evaluations.compositeScore} IS NULL THEN 1 ELSE 0 END ASC`,
      desc(evaluations.compositeScore),
      desc(experiments.createdAt)
    );

  return rows.map((row) => {
    const config = parseJson<ExperimentConfig>(row.exp.config);
    if (!config) {
      throw new Error(`Experiment ${row.exp.id}: failed to parse config JSON`);
    }

    const strategy: Strategy | undefined =
      row.stratSetups && row.stratReasoning
        ? {
            setups: parseJson(row.stratSetups) ?? [],
            overallReasoning: row.stratReasoning,
            allocationNormalized: row.stratAllocationNormalized === 1,
          }
        : undefined;

    const evaluation: EvaluationResult | undefined =
      row.compositeScore !== null && row.compositeScore !== undefined
        ? {
            complianceScore: row.complianceScore!,
            riskQualityScore: row.riskQualityScore!,
            clarityScore: row.clarityScore!,
            compositeScore: row.compositeScore,
            perRuleAssessment: parseJson(row.perRuleAssessment ?? '') ?? [],
            isMock: row.isMock === 1,
          }
        : undefined;

    return {
      id: row.exp.id,
      name: row.exp.name,
      status: row.exp.status as ExperimentStatus,
      config,
      strategy,
      evaluation,
      executionLog: row.exp.executionLog ?? undefined,
      createdAt: row.exp.createdAt,
      completedAt: row.exp.completedAt ?? undefined,
    };
  });
}

// ────────────────────────────────────────────────────────────
// saveStrategy
// ────────────────────────────────────────────────────────────

export async function saveStrategy(
  experimentId: string,
  strategy: Strategy
): Promise<void> {
  const values = {
    id: uuidv4(),
    experimentId,
    setups: JSON.stringify(strategy.setups),
    reasoning: strategy.overallReasoning,
    allocationNormalized: strategy.allocationNormalized ? 1 : 0,
    createdAt: now(),
  };
  await db
    .insert(strategies)
    .values(values)
    .onConflictDoUpdate({
      target: strategies.experimentId,
      set: {
        setups: values.setups,
        reasoning: values.reasoning,
        allocationNormalized: values.allocationNormalized,
        createdAt: values.createdAt,
      },
    });
}

// ────────────────────────────────────────────────────────────
// saveEvaluation
// ────────────────────────────────────────────────────────────

export async function saveEvaluation(
  experimentId: string,
  result: EvaluationResult
): Promise<void> {
  const values = {
    id: uuidv4(),
    experimentId,
    complianceScore: result.complianceScore,
    riskQualityScore: result.riskQualityScore,
    clarityScore: result.clarityScore,
    compositeScore: result.compositeScore,
    perRuleAssessment: JSON.stringify(result.perRuleAssessment),
    isMock: result.isMock ? 1 : 0,
    createdAt: now(),
  };
  await db
    .insert(evaluations)
    .values(values)
    .onConflictDoUpdate({
      target: evaluations.experimentId,
      set: {
        complianceScore: values.complianceScore,
        riskQualityScore: values.riskQualityScore,
        clarityScore: values.clarityScore,
        compositeScore: values.compositeScore,
        perRuleAssessment: values.perRuleAssessment,
        isMock: values.isMock,
        createdAt: values.createdAt,
      },
    });
}

// ────────────────────────────────────────────────────────────
// updateExperimentStatus
// ────────────────────────────────────────────────────────────

export async function updateExperimentStatus(
  id: string,
  status: ExperimentStatus,
  executionLog?: string
): Promise<void> {
  const completedAt =
    status === 'complete' || status === 'failed' ? now() : undefined;

  await db
    .update(experiments)
    .set({
      status,
      ...(completedAt !== undefined ? { completedAt } : {}),
      ...(executionLog !== undefined ? { executionLog } : {}),
    })
    .where(eq(experiments.id, id));
}

// ─── Market Data Queries ────────────────────────────────────────

export function getAvailableSymbols(): Array<{
  symbol: string;
  provider: string;
  minDate: string;
  maxDate: string;
  rowCount: number;
}> {
  const rows = db
    .select({
      symbol: marketData.symbol,
      provider: marketData.provider,
      minTs: sql<number>`min(${marketData.timestamp})`,
      maxTs: sql<number>`max(${marketData.timestamp})`,
      rowCount: sql<number>`count(*)`,
    })
    .from(marketData)
    .groupBy(marketData.symbol, marketData.provider)
    .all();

  return rows.map((r) => ({
    symbol: r.symbol,
    provider: r.provider,
    minDate: new Date(r.minTs).toISOString().split('T')[0],
    maxDate: new Date(r.maxTs).toISOString().split('T')[0],
    rowCount: r.rowCount,
  }));
}

export function getMarketDataRange(symbol: string): { minTimestamp: number; maxTimestamp: number } | null {
  const row = db
    .select({
      minTs: sql<number>`min(${marketData.timestamp})`,
      maxTs: sql<number>`max(${marketData.timestamp})`,
    })
    .from(marketData)
    .where(eq(marketData.symbol, symbol))
    .get();

  if (!row || row.minTs == null) return null;
  return { minTimestamp: row.minTs, maxTimestamp: row.maxTs };
}

export function insertMarketDataBatch(
  rows: Array<{
    symbol: string;
    timeframe: string;
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    provider: string;
  }>
): number {
  if (rows.length === 0) return 0;
  let inserted = 0;
  const chunkSize = 5000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize).map((r) => ({ ...r, id: uuidv4() }));
    const result = db.insert(marketData).values(chunk).onConflictDoNothing().run();
    inserted += result.changes;
  }
  return inserted;
}

export function getCandles(
  symbol: string,
  timeframe: string,
  startMs: number,
  endMs: number
): Candle[] {
  const rows = db
    .select()
    .from(marketData)
    .where(
      and(
        eq(marketData.symbol, symbol),
        eq(marketData.timeframe, timeframe),
        gte(marketData.timestamp, startMs),
        lte(marketData.timestamp, endMs)
      )
    )
    .orderBy(marketData.timestamp)
    .all();

  return rows.map((r) => ({
    timestamp: r.timestamp,
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));
}

export function deleteMarketData(symbol: string, provider: string): number {
  const result = db
    .delete(marketData)
    .where(and(eq(marketData.symbol, symbol), eq(marketData.provider, provider)))
    .run();
  return result.changes;
}

export function getDatasetSummary(): Array<{
  symbol: string;
  provider: string;
  timeframe: string;
  rowCount: number;
  minDate: string;
  maxDate: string;
}> {
  const rows = db
    .select({
      symbol: marketData.symbol,
      provider: marketData.provider,
      timeframe: marketData.timeframe,
      rowCount: sql<number>`count(*)`,
      minTs: sql<number>`min(${marketData.timestamp})`,
      maxTs: sql<number>`max(${marketData.timestamp})`,
    })
    .from(marketData)
    .groupBy(marketData.symbol, marketData.provider, marketData.timeframe)
    .all();

  return rows.map((r) => ({
    symbol: r.symbol,
    provider: r.provider,
    timeframe: r.timeframe,
    rowCount: r.rowCount,
    minDate: new Date(r.minTs).toISOString().split('T')[0],
    maxDate: new Date(r.maxTs).toISOString().split('T')[0],
  }));
}

// ─── Download Job Queries ────────────────────────────────────────

export function createDownloadJob(
  symbol: string,
  provider: string,
  timeframe: string,
  startDate: string,
  endDate: string
): string {
  const id = uuidv4();
  db.insert(downloadJobs)
    .values({ id, symbol, provider, timeframe, startDate, endDate, createdAt: now() })
    .run();
  return id;
}

export function updateDownloadJob(
  id: string,
  update: Partial<{
    status: string;
    totalRows: number;
    insertedRows: number;
    errorMessage: string;
    completedAt: number;
  }>
): void {
  db.update(downloadJobs).set(update).where(eq(downloadJobs.id, id)).run();
}

export function getDownloadJob(id: string) {
  return db.select().from(downloadJobs).where(eq(downloadJobs.id, id)).get() ?? null;
}

export function listDownloadJobs() {
  return db.select().from(downloadJobs).orderBy(desc(downloadJobs.createdAt)).limit(50).all();
}
