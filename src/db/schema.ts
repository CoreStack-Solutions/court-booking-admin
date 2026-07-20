import { relations, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import {
  courtStatuses,
  reservationStatuses,
  userRoles,
} from '@/lib/auth.constants'
import {
  paymentMethods,
  paymentStatuses,
} from '@/features/payments/payments.constants'

export type { UserRole } from '@/lib/auth.constants'
export type { CourtStatus } from '@/lib/auth.constants'

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: userRoles }).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    lastLoginAt: integer('last_login_at', { mode: 'number' }),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(sql`lower(trim(${table.email}))`),
    index('users_role_active_idx').on(table.role, table.isActive),
    check('users_name_not_empty', sql`length(trim(${table.name})) > 0`),
    check(
      'users_role_valid',
      sql`${table.role} in ('admin', 'operator', 'viewer')`,
    ),
    check('users_is_active_boolean', sql`${table.isActive} in (0, 1)`),
  ],
)

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: integer('expires_at', { mode: 'number' }).notNull(),
    lastSeenAt: integer('last_seen_at', { mode: 'number' }).notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'number' }),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_unique').on(table.tokenHash),
    index('sessions_user_idx').on(table.userId),
    index('sessions_expiration_idx').on(table.expiresAt),
  ],
)

export const loginAttempts = sqliteTable(
  'login_attempts',
  {
    id: text('id').primaryKey(),
    attemptKey: text('attempt_key').notNull(),
    windowStartedAt: integer('window_started_at', { mode: 'number' }).notNull(),
    attempts: integer('attempts').notNull(),
    blockedUntil: integer('blocked_until', { mode: 'number' }),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    uniqueIndex('login_attempts_key_unique').on(table.attemptKey),
    index('login_attempts_updated_idx').on(table.updatedAt),
  ],
)

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    actorUserId: text('actor_user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    beforeJson: text('before_json'),
    afterJson: text('after_json'),
    reason: text('reason'),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    requestId: text('request_id').notNull(),
  },
  (table) => [
    index('audit_logs_actor_created_idx').on(
      table.actorUserId,
      table.createdAt,
    ),
    index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  ],
)

export const courts = sqliteTable(
  'courts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#22c55e'),
    status: text('status', { enum: courtStatuses }).notNull().default('active'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('courts_status_idx').on(table.status),
    index('courts_sort_order_idx').on(table.sortOrder),
    check('courts_name_not_empty', sql`length(trim(${table.name})) > 0`),
    check(
      'courts_status_valid',
      sql`${table.status} in ('active', 'maintenance', 'inactive')`,
    ),
  ],
)

export const courtHours = sqliteTable(
  'court_hours',
  {
    id: text('id').primaryKey(),
    courtId: text('court_id')
      .notNull()
      .references(() => courts.id),
    dayOfWeek: integer('day_of_week').notNull(),
    opensAt: text('opens_at').notNull().default('07:00'),
    closesAt: text('closes_at').notNull().default('22:00'),
    isClosed: integer('is_closed', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (table) => [
    uniqueIndex('court_hours_court_day_unique').on(
      table.courtId,
      table.dayOfWeek,
    ),
    check('court_hours_day_valid', sql`${table.dayOfWeek} between 0 and 6`),
    check('court_hours_is_closed_boolean', sql`${table.isClosed} in (0, 1)`),
  ],
)

export const rateRules = sqliteTable(
  'rate_rules',
  {
    id: text('id').primaryKey(),
    courtId: text('court_id').references(() => courts.id),
    name: text('name').notNull(),
    dayOfWeek: integer('day_of_week'),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    pricePerHourCents: integer('price_per_hour_cents').notNull(),
    effectiveFrom: text('effective_from').notNull(),
    effectiveTo: text('effective_to'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('rate_rules_lookup_idx').on(
      table.courtId,
      table.dayOfWeek,
      table.effectiveFrom,
    ),
    check('rate_rules_name_not_empty', sql`length(trim(${table.name})) > 0`),
    check(
      'rate_rules_day_valid',
      sql`${table.dayOfWeek} is null or ${table.dayOfWeek} between 0 and 6`,
    ),
    check('rate_rules_price_positive', sql`${table.pricePerHourCents} > 0`),
    check(
      'rate_rules_price_even_cents',
      sql`${table.pricePerHourCents} % 2 = 0`,
    ),
    check(
      'rate_rules_effective_range_valid',
      sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
  ],
)

export const customers = sqliteTable(
  'customers',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone'),
    notes: text('notes'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('customers_name_idx').on(table.name),
    index('customers_phone_idx').on(table.phone),
    check('customers_name_not_empty', sql`length(trim(${table.name})) > 0`),
  ],
)

export const reservations = sqliteTable(
  'reservations',
  {
    id: text('id').primaryKey(),
    courtId: text('court_id')
      .notNull()
      .references(() => courts.id),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id),
    startsAt: integer('starts_at', { mode: 'number' }).notNull(),
    endsAt: integer('ends_at', { mode: 'number' }).notNull(),
    status: text('status', { enum: reservationStatuses })
      .notNull()
      .default('pending'),
    baseAmountCents: integer('base_amount_cents').notNull().default(0),
    discountAmountCents: integer('discount_amount_cents').notNull().default(0),
    finalAmountCents: integer('final_amount_cents').notNull().default(0),
    overrideReason: text('override_reason'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    cancelledBy: text('cancelled_by').references(() => users.id),
    cancelledAt: integer('cancelled_at', { mode: 'number' }),
    cancellationReason: text('cancellation_reason'),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('reservations_court_time_idx').on(
      table.courtId,
      table.startsAt,
      table.endsAt,
    ),
    index('reservations_customer_idx').on(table.customerId),
    index('reservations_status_idx').on(table.status),
    check('reservations_time_order', sql`${table.endsAt} > ${table.startsAt}`),
    check(
      'reservations_status_valid',
      sql`${table.status} in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')`,
    ),
    check(
      'reservations_amounts_nonnegative',
      sql`${table.baseAmountCents} >= 0 and ${table.discountAmountCents} >= 0 and ${table.finalAmountCents} >= 0`,
    ),
  ],
)

export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    id: text('id').primaryKey(),
    scope: text('scope').notNull(),
    actorUserId: text('actor_user_id')
      .notNull()
      .references(() => users.id),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    status: text('status').notNull(),
    resultEntityId: text('result_entity_id'),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    completedAt: integer('completed_at', { mode: 'number' }),
  },
  (table) => [
    uniqueIndex('idempotency_scope_actor_key_unique').on(
      table.scope,
      table.actorUserId,
      table.key,
    ),
    check(
      'idempotency_status_valid',
      sql`${table.status} in ('processing', 'completed')`,
    ),
  ],
)

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    reservationId: text('reservation_id').references(() => reservations.id),
    saleId: text('sale_id'),
    amountCents: integer('amount_cents').notNull(),
    method: text('method', { enum: paymentMethods }).notNull(),
    status: text('status', { enum: paymentStatuses })
      .notNull()
      .default('pending'),
    reference: text('reference'),
    paidAt: integer('paid_at', { mode: 'number' }),
    receivedBy: text('received_by').references(() => users.id),
    voidReason: text('void_reason'),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('payments_paid_at_method_status_idx').on(
      table.paidAt,
      table.method,
      table.status,
    ),
    index('payments_reservation_idx').on(table.reservationId),
    check('payments_amount_positive', sql`${table.amountCents} > 0`),
    check(
      'payments_amount_integer',
      sql`typeof(${table.amountCents}) = 'integer'`,
    ),
    check(
      'payments_method_valid',
      sql`${table.method} in ('cash', 'yape', 'plin', 'bank_transfer')`,
    ),
    check(
      'payments_status_valid',
      sql`${table.status} in ('pending', 'paid', 'voided', 'refunded')`,
    ),
    check(
      'payments_exactly_one_origin',
      sql`(${table.reservationId} is not null and ${table.saleId} is null) or (${table.reservationId} is null and ${table.saleId} is not null)`,
    ),
  ],
)

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  auditLogs: many(auditLogs),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
}))

export const courtsRelations = relations(courts, ({ many }) => ({
  courtHours: many(courtHours),
}))

export const courtHoursRelations = relations(courtHours, ({ one }) => ({
  court: one(courts, {
    fields: [courtHours.courtId],
    references: [courts.id],
  }),
}))

export const rateRulesRelations = relations(rateRules, ({ one }) => ({
  court: one(courts, {
    fields: [rateRules.courtId],
    references: [courts.id],
  }),
}))

export const customersRelations = relations(customers, ({ many }) => ({
  reservations: many(reservations),
}))

export const reservationsRelations = relations(reservations, ({ one }) => ({
  court: one(courts, {
    fields: [reservations.courtId],
    references: [courts.id],
  }),
  customer: one(customers, {
    fields: [reservations.customerId],
    references: [customers.id],
  }),
  creator: one(users, {
    fields: [reservations.createdBy],
    references: [users.id],
  }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  reservation: one(reservations, {
    fields: [payments.reservationId],
    references: [reservations.id],
  }),
  sale: one(sales, {
    fields: [payments.saleId],
    references: [sales.id],
  }),
  receiver: one(users, {
    fields: [payments.receivedBy],
    references: [users.id],
  }),
}))

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    check('categories_name_not_empty', sql`length(trim(${table.name})) > 0`),
  ],
)

export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    categoryId: text('category_id')
      .references(() => categories.id)
      .notNull(),
    sku: text('sku'),
    name: text('name').notNull(),
    salePriceCents: integer('sale_price_cents').notNull(),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(0),
    currentStock: integer('current_stock').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('products_category_idx').on(table.categoryId),
    check('products_name_not_empty', sql`length(trim(${table.name})) > 0`),
    check('products_price_positive', sql`${table.salePriceCents} >= 0`),
    check('products_stock_nonnegative', sql`${table.currentStock} >= 0`),
  ],
)

export const sales = sqliteTable(
  'sales',
  {
    id: text('id').primaryKey(),
    totalAmountCents: integer('total_amount_cents').notNull(),
    status: text('status', { enum: ['completed', 'voided'] })
      .notNull()
      .default('completed'),
    soldAt: integer('sold_at', { mode: 'number' }).notNull(),
    createdBy: text('created_by')
      .references(() => users.id)
      .notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('sales_sold_at_idx').on(table.soldAt),
    check('sales_amount_nonnegative', sql`${table.totalAmountCents} >= 0`),
  ],
)

export const saleItems = sqliteTable(
  'sale_items',
  {
    id: text('id').primaryKey(),
    saleId: text('sale_id')
      .references(() => sales.id)
      .notNull(),
    productId: text('product_id')
      .references(() => products.id)
      .notNull(),
    productNameSnapshot: text('product_name_snapshot').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull(),
    lineTotalCents: integer('line_total_cents').notNull(),
  },
  (table) => [
    index('sale_items_sale_idx').on(table.saleId),
    index('sale_items_product_idx').on(table.productId),
    check('sale_items_price_nonnegative', sql`${table.unitPriceCents} >= 0`),
    check('sale_items_quantity_positive', sql`${table.quantity} > 0`),
  ],
)

export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .references(() => products.id)
      .notNull(),
    type: text('type', {
      enum: ['initial', 'sale', 'adjustment', 'return', 'void'],
    }).notNull(),
    quantityDelta: integer('quantity_delta').notNull(),
    quantityAfter: integer('quantity_after').notNull(),
    saleId: text('sale_id').references(() => sales.id),
    reason: text('reason'),
    createdBy: text('created_by')
      .references(() => users.id)
      .notNull(),
    createdAt: integer('created_at', { mode: 'number' }).notNull(),
  },
  (table) => [
    index('stock_movements_product_idx').on(table.productId),
    check('stock_movements_delta_nonzero', sql`${table.quantityDelta} != 0`),
    check(
      'stock_movements_after_nonnegative',
      sql`${table.quantityAfter} >= 0`,
    ),
  ],
)

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  saleItems: many(saleItems),
  stockMovements: many(stockMovements),
}))

export const salesRelations = relations(sales, ({ one, many }) => ({
  creator: one(users, {
    fields: [sales.createdBy],
    references: [users.id],
  }),
  items: many(saleItems),
  payments: many(payments),
}))

export const saleItemsRelations = relations(saleItems, ({ one }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
}))

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  sale: one(sales, {
    fields: [stockMovements.saleId],
    references: [sales.id],
  }),
  creator: one(users, {
    fields: [stockMovements.createdBy],
    references: [users.id],
  }),
}))

