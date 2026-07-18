PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "users_name_not_empty" CHECK(length(trim("__new_users"."name")) > 0),
	CONSTRAINT "users_role_valid" CHECK("__new_users"."role" in ('admin', 'operator', 'viewer')),
	CONSTRAINT "users_is_active_boolean" CHECK("__new_users"."is_active" in (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "email", "password_hash", "role", "is_active", "last_login_at", "created_at", "updated_at") SELECT "id", "name", "email", "password_hash", "role", "is_active", "last_login_at", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` ("email" COLLATE NOCASE);--> statement-breakpoint
CREATE INDEX `users_role_active_idx` ON `users` (`role`,`is_active`);
