CREATE TABLE `login_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `attempt_key` text NOT NULL,
  `window_started_at` integer NOT NULL,
  `attempts` integer NOT NULL,
  `blocked_until` integer,
  `updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `login_attempts_key_unique` ON `login_attempts` (`attempt_key`);
