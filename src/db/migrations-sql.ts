// Consolidated migration SQL for Vercel serverless (no filesystem access)
export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "users" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" text NOT NULL,
  "is_active" integer DEFAULT true NOT NULL,
  "last_login_at" integer,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  CONSTRAINT "users_name_not_empty" CHECK(length(trim("users"."name")) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" (lower(trim("email")));
CREATE INDEX IF NOT EXISTS "users_role_active_idx" ON "users" ("role","is_active");

CREATE TRIGGER IF NOT EXISTS "users_validate_insert"
BEFORE INSERT ON "users"
WHEN trim(NEW.name) = '' OR NEW.role NOT IN ('admin', 'operator', 'viewer') OR NEW.is_active NOT IN (0, 1)
BEGIN SELECT RAISE(ABORT, 'invalid user values'); END;

CREATE TRIGGER IF NOT EXISTS "users_validate_update"
BEFORE UPDATE OF name, role, is_active ON "users"
WHEN trim(NEW.name) = '' OR NEW.role NOT IN ('admin', 'operator', 'viewer') OR NEW.is_active NOT IN (0, 1)
BEGIN SELECT RAISE(ABORT, 'invalid user values'); END;

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "expires_at" integer NOT NULL,
  "last_seen_at" integer NOT NULL,
  "created_at" integer NOT NULL,
  "revoked_at" integer,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_hash_unique" ON "sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expiration_idx" ON "sessions" ("expires_at");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "actor_user_id" text,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "before_json" text,
  "after_json" text,
  "reason" text,
  "created_at" integer NOT NULL,
  "request_id" text NOT NULL,
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
CREATE INDEX IF NOT EXISTS "audit_logs_actor_created_idx" ON "audit_logs" ("actor_user_id","created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_entity_idx" ON "audit_logs" ("entity_type","entity_id");

CREATE TABLE IF NOT EXISTS "login_attempts" (
  "id" text PRIMARY KEY NOT NULL,
  "attempt_key" text NOT NULL,
  "window_started_at" integer NOT NULL,
  "attempts" integer NOT NULL,
  "blocked_until" integer,
  "updated_at" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "login_attempts_key_unique" ON "login_attempts" ("attempt_key");
CREATE INDEX IF NOT EXISTS "login_attempts_updated_idx" ON "login_attempts" ("updated_at");

CREATE TABLE IF NOT EXISTS "courts" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "color" text DEFAULT '#22c55e' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  CONSTRAINT "courts_name_not_empty" CHECK(length(trim("courts"."name")) > 0),
  CONSTRAINT "courts_status_valid" CHECK("courts"."status" in ('active', 'maintenance', 'inactive'))
);
CREATE INDEX IF NOT EXISTS "courts_status_idx" ON "courts" ("status");
CREATE INDEX IF NOT EXISTS "courts_sort_order_idx" ON "courts" ("sort_order");

CREATE TABLE IF NOT EXISTS "court_hours" (
  "id" text PRIMARY KEY NOT NULL,
  "court_id" text NOT NULL,
  "day_of_week" integer NOT NULL,
  "opens_at" text DEFAULT '07:00' NOT NULL,
  "closes_at" text DEFAULT '22:00' NOT NULL,
  "is_closed" integer DEFAULT false NOT NULL,
  FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON UPDATE no action ON DELETE no action,
  CONSTRAINT "court_hours_day_valid" CHECK("court_hours"."day_of_week" between 0 and 6),
  CONSTRAINT "court_hours_is_closed_boolean" CHECK("court_hours"."is_closed" in (0, 1))
);
CREATE UNIQUE INDEX IF NOT EXISTS "court_hours_court_day_unique" ON "court_hours" ("court_id","day_of_week");

CREATE TABLE IF NOT EXISTS "customers" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "notes" text,
  "is_active" integer DEFAULT true NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  CONSTRAINT "customers_name_not_empty" CHECK(length(trim("customers"."name")) > 0)
);
CREATE INDEX IF NOT EXISTS "customers_name_idx" ON "customers" ("name");
CREATE INDEX IF NOT EXISTS "customers_phone_idx" ON "customers" ("phone");

CREATE TRIGGER IF NOT EXISTS "customers_is_active_insert"
BEFORE INSERT ON "customers"
WHEN NEW.is_active NOT IN (0, 1)
BEGIN SELECT RAISE(ABORT, 'customers.is_active must be boolean'); END;

CREATE TRIGGER IF NOT EXISTS "customers_is_active_update"
BEFORE UPDATE OF "is_active" ON "customers"
WHEN NEW.is_active NOT IN (0, 1)
BEGIN SELECT RAISE(ABORT, 'customers.is_active must be boolean'); END;

CREATE TABLE IF NOT EXISTS "reservations" (
  "id" text PRIMARY KEY NOT NULL,
  "court_id" text NOT NULL,
  "customer_id" text NOT NULL,
  "starts_at" integer NOT NULL,
  "ends_at" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "base_amount_cents" integer DEFAULT 0 NOT NULL,
  "discount_amount_cents" integer DEFAULT 0 NOT NULL,
  "final_amount_cents" integer DEFAULT 0 NOT NULL,
  "override_reason" text,
  "created_by" text NOT NULL,
  "cancelled_by" text,
  "cancelled_at" integer,
  "cancellation_reason" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
  CONSTRAINT "reservations_time_order" CHECK("reservations"."ends_at" > "reservations"."starts_at"),
  CONSTRAINT "reservations_status_valid" CHECK("reservations"."status" in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  CONSTRAINT "reservations_amounts_nonnegative" CHECK("reservations"."base_amount_cents" >= 0 and "reservations"."discount_amount_cents" >= 0 and "reservations"."final_amount_cents" >= 0)
);
CREATE INDEX IF NOT EXISTS "reservations_court_time_idx" ON "reservations" ("court_id","starts_at","ends_at");
CREATE INDEX IF NOT EXISTS "reservations_customer_idx" ON "reservations" ("customer_id");
CREATE INDEX IF NOT EXISTS "reservations_status_idx" ON "reservations" ("status");

CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "id" text PRIMARY KEY NOT NULL,
  "scope" text NOT NULL,
  "actor_user_id" text NOT NULL,
  "key" text NOT NULL,
  "request_hash" text NOT NULL,
  "status" text NOT NULL,
  "result_entity_id" text,
  "created_at" integer NOT NULL,
  "completed_at" integer,
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
  CONSTRAINT "idempotency_status_valid" CHECK("idempotency_keys"."status" in ('processing', 'completed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_scope_actor_key_unique" ON "idempotency_keys" ("scope","actor_user_id","key");

CREATE TABLE IF NOT EXISTS "rate_rules" (
  "id" text PRIMARY KEY NOT NULL,
  "court_id" text,
  "name" text NOT NULL,
  "day_of_week" integer,
  "starts_at" text NOT NULL,
  "ends_at" text NOT NULL,
  "price_per_hour_cents" integer NOT NULL,
  "effective_from" text NOT NULL,
  "effective_to" text,
  "is_active" integer DEFAULT true NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON UPDATE no action ON DELETE no action,
  CONSTRAINT "rate_rules_name_not_empty" CHECK(length(trim("rate_rules"."name")) > 0),
  CONSTRAINT "rate_rules_day_valid" CHECK("rate_rules"."day_of_week" is null or "rate_rules"."day_of_week" between 0 and 6),
  CONSTRAINT "rate_rules_price_positive" CHECK("rate_rules"."price_per_hour_cents" > 0),
  CONSTRAINT "rate_rules_price_even_cents" CHECK("rate_rules"."price_per_hour_cents" % 2 = 0),
  CONSTRAINT "rate_rules_effective_range_valid" CHECK("rate_rules"."effective_to" is null or "rate_rules"."effective_to" >= "rate_rules"."effective_from")
);
CREATE INDEX IF NOT EXISTS "rate_rules_lookup_idx" ON "rate_rules" ("court_id","day_of_week","effective_from");

CREATE TABLE IF NOT EXISTS "payments" (
  "id" text PRIMARY KEY NOT NULL,
  "reservation_id" text,
  "sale_id" text,
  "amount_cents" integer NOT NULL,
  "method" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "reference" text,
  "paid_at" integer,
  "received_by" text,
  "void_reason" text,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("received_by") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
  CONSTRAINT "payments_amount_positive" CHECK("payments"."amount_cents" > 0),
  CONSTRAINT "payments_amount_integer" CHECK(typeof("payments"."amount_cents") = 'integer'),
  CONSTRAINT "payments_method_valid" CHECK("payments"."method" in ('cash', 'yape', 'plin', 'bank_transfer')),
  CONSTRAINT "payments_status_valid" CHECK("payments"."status" in ('pending', 'paid', 'voided', 'refunded')),
  CONSTRAINT "payments_exactly_one_origin" CHECK(("payments"."reservation_id" is not null and "payments"."sale_id" is null) or ("payments"."reservation_id" is null and "payments"."sale_id" is not null))
);
CREATE INDEX IF NOT EXISTS "payments_paid_at_method_status_idx" ON "payments" ("paid_at","method","status");
CREATE INDEX IF NOT EXISTS "payments_reservation_idx" ON "payments" ("reservation_id");

CREATE TABLE IF NOT EXISTS "categories" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "is_active" integer DEFAULT true NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  CONSTRAINT "categories_name_not_empty" CHECK(length(trim("categories"."name")) > 0)
);

CREATE TABLE IF NOT EXISTS "products" (
  "id" text PRIMARY KEY NOT NULL,
  "category_id" text NOT NULL,
  "sku" text,
  "name" text NOT NULL,
  "sale_price_cents" integer NOT NULL,
  "low_stock_threshold" integer DEFAULT 0 NOT NULL,
  "current_stock" integer DEFAULT 0 NOT NULL,
  "is_active" integer DEFAULT true NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON UPDATE no action ON DELETE no action,
  CONSTRAINT "products_name_not_empty" CHECK(length(trim("products"."name")) > 0),
  CONSTRAINT "products_price_positive" CHECK("products"."sale_price_cents" >= 0),
  CONSTRAINT "products_stock_nonnegative" CHECK("products"."current_stock" >= 0)
);
CREATE INDEX IF NOT EXISTS "products_category_idx" ON "products" ("category_id");

CREATE TABLE IF NOT EXISTS "sales" (
  "id" text PRIMARY KEY NOT NULL,
  "total_amount_cents" integer NOT NULL,
  "status" text DEFAULT 'completed' NOT NULL,
  "sold_at" integer NOT NULL,
  "created_by" text NOT NULL,
  "created_at" integer NOT NULL,
  "updated_at" integer NOT NULL,
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
  CONSTRAINT "sales_amount_nonnegative" CHECK("sales"."total_amount_cents" >= 0)
);
CREATE INDEX IF NOT EXISTS "sales_sold_at_idx" ON "sales" ("sold_at");

CREATE TABLE IF NOT EXISTS "sale_items" (
  "id" text PRIMARY KEY NOT NULL,
  "sale_id" text NOT NULL,
  "product_id" text NOT NULL,
  "product_name_snapshot" text NOT NULL,
  "unit_price_cents" integer NOT NULL,
  "quantity" integer NOT NULL,
  "line_total_cents" integer NOT NULL,
  FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE no action ON DELETE no action,
  CONSTRAINT "sale_items_price_nonnegative" CHECK("sale_items"."unit_price_cents" >= 0),
  CONSTRAINT "sale_items_quantity_positive" CHECK("sale_items"."quantity" > 0)
);
CREATE INDEX IF NOT EXISTS "sale_items_sale_idx" ON "sale_items" ("sale_id");
CREATE INDEX IF NOT EXISTS "sale_items_product_idx" ON "sale_items" ("product_id");

CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id" text PRIMARY KEY NOT NULL,
  "product_id" text NOT NULL,
  "type" text NOT NULL,
  "quantity_delta" integer NOT NULL,
  "quantity_after" integer NOT NULL,
  "sale_id" text,
  "reason" text,
  "created_by" text NOT NULL,
  "created_at" integer NOT NULL,
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON UPDATE no action ON DELETE no action,
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action,
  CONSTRAINT "stock_movements_delta_nonzero" CHECK("stock_movements"."quantity_delta" != 0),
  CONSTRAINT "stock_movements_after_nonnegative" CHECK("stock_movements"."quantity_after" >= 0)
);
CREATE INDEX IF NOT EXISTS "stock_movements_product_idx" ON "stock_movements" ("product_id");
`
