CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "customers_name_not_empty" CHECK(length(trim("customers"."name")) > 0)
);
--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`name`);--> statement-breakpoint
CREATE INDEX `customers_phone_idx` ON `customers` (`phone`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`court_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`base_amount_cents` integer DEFAULT 0 NOT NULL,
	`discount_amount_cents` integer DEFAULT 0 NOT NULL,
	`final_amount_cents` integer DEFAULT 0 NOT NULL,
	`override_reason` text,
	`created_by` text NOT NULL,
	`cancelled_by` text,
	`cancelled_at` integer,
	`cancellation_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`court_id`) REFERENCES `courts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reservations_time_order" CHECK("reservations"."ends_at" > "reservations"."starts_at"),
	CONSTRAINT "reservations_status_valid" CHECK("reservations"."status" in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
	CONSTRAINT "reservations_amounts_nonnegative" CHECK("reservations"."base_amount_cents" >= 0 and "reservations"."discount_amount_cents" >= 0 and "reservations"."final_amount_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `reservations_court_time_idx` ON `reservations` (`court_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `reservations_customer_idx` ON `reservations` (`customer_id`);--> statement-breakpoint
CREATE INDEX `reservations_status_idx` ON `reservations` (`status`);