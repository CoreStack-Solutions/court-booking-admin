CREATE TABLE `rate_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`court_id` text,
	`name` text NOT NULL,
	`day_of_week` integer,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`price_per_hour_cents` integer NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "rate_rules_name_not_empty" CHECK(length(trim("rate_rules"."name")) > 0),
	CONSTRAINT "rate_rules_day_valid" CHECK("rate_rules"."day_of_week" is null or "rate_rules"."day_of_week" between 0 and 6),
	CONSTRAINT "rate_rules_price_positive" CHECK("rate_rules"."price_per_hour_cents" > 0),
	CONSTRAINT "rate_rules_price_even_cents" CHECK("rate_rules"."price_per_hour_cents" % 2 = 0),
	CONSTRAINT "rate_rules_effective_range_valid" CHECK("rate_rules"."effective_to" is null or "rate_rules"."effective_to" >= "rate_rules"."effective_from")
);
--> statement-breakpoint
CREATE INDEX `rate_rules_lookup_idx` ON `rate_rules` (`court_id`,`day_of_week`,`effective_from`);