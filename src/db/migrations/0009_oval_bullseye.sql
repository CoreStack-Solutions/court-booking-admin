CREATE TABLE `idempotency_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`key` text NOT NULL,
	`request_hash` text NOT NULL,
	`status` text NOT NULL,
	`result_entity_id` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "idempotency_status_valid" CHECK("idempotency_keys"."status" in ('processing', 'completed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idempotency_scope_actor_key_unique` ON `idempotency_keys` (`scope`,`actor_user_id`,`key`);--> statement-breakpoint
CREATE TRIGGER `customers_is_active_insert`
BEFORE INSERT ON `customers`
WHEN NEW.is_active NOT IN (0, 1)
BEGIN
  SELECT RAISE(ABORT, 'customers.is_active must be boolean');
END;--> statement-breakpoint
CREATE TRIGGER `customers_is_active_update`
BEFORE UPDATE OF `is_active` ON `customers`
WHEN NEW.is_active NOT IN (0, 1)
BEGIN
  SELECT RAISE(ABORT, 'customers.is_active must be boolean');
END;
