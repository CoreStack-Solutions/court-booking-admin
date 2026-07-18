DROP INDEX `users_email_unique`;--> statement-breakpoint
UPDATE `users` SET `email` = lower(`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` ("email" COLLATE NOCASE);--> statement-breakpoint
CREATE TRIGGER `users_validate_update`
BEFORE UPDATE OF name, role, is_active ON `users`
WHEN trim(NEW.name) = '' OR NEW.role NOT IN ('admin', 'operator', 'viewer') OR NEW.is_active NOT IN (0, 1)
BEGIN
  SELECT RAISE(ABORT, 'invalid user values');
END;
--> statement-breakpoint
UPDATE `users` SET `role` = `role`;--> statement-breakpoint
CREATE TRIGGER `users_validate_insert`
BEFORE INSERT ON `users`
WHEN trim(NEW.name) = '' OR NEW.role NOT IN ('admin', 'operator', 'viewer') OR NEW.is_active NOT IN (0, 1)
BEGIN
  SELECT RAISE(ABORT, 'invalid user values');
END;
