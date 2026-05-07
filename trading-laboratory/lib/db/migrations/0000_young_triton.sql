CREATE TABLE `evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`compliance_score` real NOT NULL,
	`risk_quality_score` real NOT NULL,
	`clarity_score` real NOT NULL,
	`composite_score` real NOT NULL,
	`per_rule_assessment` text NOT NULL,
	`is_mock` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`config` text NOT NULL,
	`execution_log` text,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `strategies` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`setups` text NOT NULL,
	`reasoning` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE no action
);
