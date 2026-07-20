DROP INDEX `users_email_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (lower(trim("email")));
