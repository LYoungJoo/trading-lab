CREATE TABLE `download_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`provider` text NOT NULL,
	`timeframe` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_rows` integer,
	`inserted_rows` integer DEFAULT 0,
	`error_message` text,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `market_data` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`timeframe` text NOT NULL,
	`timestamp` integer NOT NULL,
	`open` real NOT NULL,
	`high` real NOT NULL,
	`low` real NOT NULL,
	`close` real NOT NULL,
	`volume` real NOT NULL,
	`provider` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_data_lookup_idx` ON `market_data` (`symbol`,`timeframe`,`timestamp`);