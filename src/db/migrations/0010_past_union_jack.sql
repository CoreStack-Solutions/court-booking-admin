DROP INDEX `court_hours_court_day_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `court_hours_court_day_unique` ON `court_hours` (`court_id`,`day_of_week`);