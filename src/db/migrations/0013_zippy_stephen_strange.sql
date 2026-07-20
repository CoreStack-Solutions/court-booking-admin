CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "categories_name_not_empty" CHECK(length(trim("categories"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`sku` text,
	`name` text NOT NULL,
	`sale_price_cents` integer NOT NULL,
	`low_stock_threshold` integer DEFAULT 0 NOT NULL,
	`current_stock` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "products_name_not_empty" CHECK(length(trim("products"."name")) > 0),
	CONSTRAINT "products_price_positive" CHECK("products"."sale_price_cents" >= 0),
	CONSTRAINT "products_stock_nonnegative" CHECK("products"."current_stock" >= 0)
);
--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sale_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name_snapshot` text NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`quantity` integer NOT NULL,
	`line_total_cents` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sale_items_price_nonnegative" CHECK("sale_items"."unit_price_cents" >= 0),
	CONSTRAINT "sale_items_quantity_positive" CHECK("sale_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_items_product_idx` ON `sale_items` (`product_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`total_amount_cents` integer NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`sold_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sales_amount_nonnegative" CHECK("sales"."total_amount_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `sales_sold_at_idx` ON `sales` (`sold_at`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`type` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`quantity_after` integer NOT NULL,
	`sale_id` text,
	`reason` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "stock_movements_delta_nonzero" CHECK("stock_movements"."quantity_delta" != 0),
	CONSTRAINT "stock_movements_after_nonnegative" CHECK("stock_movements"."quantity_after" >= 0)
);
--> statement-breakpoint
CREATE INDEX `stock_movements_product_idx` ON `stock_movements` (`product_id`);