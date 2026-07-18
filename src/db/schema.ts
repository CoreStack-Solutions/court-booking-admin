import { relations, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { userRoles } from '@/lib/auth.constants'

export type { UserRole } from '@/lib/auth.constants'

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
