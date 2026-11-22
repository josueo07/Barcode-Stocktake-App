ALTER TABLE `scan_events` ADD `lot` text;--> statement-breakpoint
ALTER TABLE `scan_events` ADD `expiry_date` text;--> statement-breakpoint
ALTER TABLE `scan_events` ADD `unit_cost_cents` integer;--> statement-breakpoint
ALTER TABLE `stocktake_sessions` ADD `cost_enabled` integer DEFAULT false NOT NULL;