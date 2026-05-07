import { sqliteTable, text, real, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const experiments = sqliteTable('experiments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('pending'),
  // JSON-serialized ExperimentConfig
  config: text('config').notNull(),
  executionLog: text('execution_log'),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
});

export const strategies = sqliteTable('strategies', {
  id: text('id').primaryKey(),
  experimentId: text('experiment_id')
    .notNull()
    .unique()
    .references(() => experiments.id),
  // JSON-serialized Setup[]
  setups: text('setups').notNull(),
  reasoning: text('reasoning').notNull(),
  // 1 if the agent returned allocation > 100% and it was normalised to 100%
  allocationNormalized: integer('allocation_normalized').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export const evaluations = sqliteTable('evaluations', {
  id: text('id').primaryKey(),
  experimentId: text('experiment_id')
    .notNull()
    .unique()
    .references(() => experiments.id),
  complianceScore: real('compliance_score').notNull(),
  riskQualityScore: real('risk_quality_score').notNull(),
  clarityScore: real('clarity_score').notNull(),
  compositeScore: real('composite_score').notNull(),
  // JSON-serialized RuleAssessment[]
  perRuleAssessment: text('per_rule_assessment').notNull(),
  isMock: integer('is_mock').notNull().default(1),
  createdAt: integer('created_at').notNull(),
});

export type ExperimentRow = typeof experiments.$inferSelect;
export type NewExperimentRow = typeof experiments.$inferInsert;
export type StrategyRow = typeof strategies.$inferSelect;
export type NewStrategyRow = typeof strategies.$inferInsert;
export type EvaluationRow = typeof evaluations.$inferSelect;
export type NewEvaluationRow = typeof evaluations.$inferInsert;

export const marketData = sqliteTable('market_data', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull(),
  timeframe: text('timeframe').notNull(),
  timestamp: integer('timestamp').notNull(),
  open: real('open').notNull(),
  high: real('high').notNull(),
  low: real('low').notNull(),
  close: real('close').notNull(),
  volume: real('volume').notNull(),
  provider: text('provider').notNull(),
}, (table) => ({
  lookupIdx: uniqueIndex('market_data_lookup_idx').on(table.symbol, table.timeframe, table.timestamp),
}));

export const downloadJobs = sqliteTable('download_jobs', {
  id: text('id').primaryKey(),
  symbol: text('symbol').notNull(),
  provider: text('provider').notNull(),
  timeframe: text('timeframe').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').notNull().default('pending'),
  totalRows: integer('total_rows'),
  insertedRows: integer('inserted_rows').default(0),
  errorMessage: text('error_message'),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
});
