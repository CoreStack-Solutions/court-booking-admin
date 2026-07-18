CREATE TABLE `court_hours` (
	`id` text PRIMARY KEY NOT NULL,
	`court_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`opens_at` text DEFAULT '07:00' NOT NULL,
	`closes_at` text DEFAULT '22:00' NOT NULL,
	`is_closed` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "court_hours_day_valid" CHECK("court_hours"."day_of_week" between 0 and 6),
	CONSTRAINT "court_hours_is_closed_boolean" CHECK("court_hours"."is_closed" in (0, 1))
);
--> statement-breakpoint
CREATE INDEX `court_hours_court_day_idx` ON `court_hours` (`court_id`,`day_of_week`);--> statement-breakpoint
CREATE TABLE `courts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#22c55e' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "courts_name_not_empty" CHECK(length(trim("courts"."name")) > 0),
	CONSTRAINT "courts_status_valid" CHECK("courts"."status" in ('active', 'maintenance', 'inactive'))
);
--> statement-breakpoint
CREATE INDEX `courts_status_idx` ON `courts` (`status`);--> statement-breakpoint
CREATE INDEX `courts_sort_order_idx` ON `courts` (`sort_order`);