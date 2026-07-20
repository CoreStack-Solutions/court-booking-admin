CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`reservation_id` text,
	`sale_id` text,
	`amount_cents` integer NOT NULL,
	`method` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reference` text,
	`paid_at` integer,
	`received_by` text,
	`void_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "payments_amount_positive" CHECK("payments"."amount_cents" > 0),
	CONSTRAINT "payments_amount_integer" CHECK(typeof("payments"."amount_cents") = 'integer'),
	CONSTRAINT "payments_method_valid" CHECK("payments"."method" in ('cash', 'yape', 'plin', 'bank_transfer')),
	CONSTRAINT "payments_status_valid" CHECK("payments"."status" in ('pending', 'paid', 'voided', 'refunded')),
	CONSTRAINT "payments_exactly_one_origin" CHECK(("payments"."reservation_id" is not null and "payments"."sale_id" is null) or ("payments"."reservation_id" is null and "payments"."sale_id" is not null))
);
--> statement-breakpoint
CREATE INDEX `payments_paid_at_method_status_idx` ON `payments` (`paid_at`,`method`,`status`);--> statement-breakpoint
CREATE INDEX `payments_reservation_idx` ON `payments` (`reservation_id`);