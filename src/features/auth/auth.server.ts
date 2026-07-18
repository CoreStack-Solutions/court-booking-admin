import { createHash, randomUUID } from 'node:crypto'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import type { ZodType } from 'zod'

import { auditLogs, loginAttempts, sessions, users } from '@/db/schema'
import { db } from '@/lib/db.server'
import {
  assertSameOrigin,
  createSessionRecord,
  getCurrentSession,
  requireRole,
  requireSession,
  revokeCurrentSession,
  setSessionCookie,
} from '@/lib/auth.server'
import { AppError, validationError } from '@/lib/errors'
import { hashPassword, verifyPassword } from '@/lib/password.server'

import { createUserSchema, loginSchema, updateUserSchema } from './auth.schema'
import type { SafeUser } from './auth.schema'

const dummyPasswordHash =
  '$argon2id$v=19$m=19456,t=2,p=1$v8JqrQOSkLTLxExYctWz7Q$Tl2e2Ea26YIlSyeK9w+3XT7f/gPwCPDu0wacCv4NJhI'

const authErrorMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      if (error instanceof AppError) {
        if (error.code === 'INTERNAL_ERROR') {
          console.error('auth server function failed', {
            name: error.name,
            requestId: error.requestId,
          })
        }
        throw error
      }
      const requestId = randomUUID()
      console.error('auth server function failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        requestId,
      })
      throw new AppError(
        'INTERNAL_ERROR',
        'No se pudo completar la solicitud',
        {},
        requestId,
      )
    }
  },
)

function parseInput<T>(schema: ZodType<T>, data: unknown) {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw validationError({ form: ['Revisa los datos ingresados'] })
  }
  return parsed.data
}

function toSafeUser(
  user: Pick<
    typeof users.$inferSelect,
    'id' | 'name' | 'email' | 'role' | 'isActive'
  >,
): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  }
}

function isUniqueConstraint(error: unknown) {
  return (
    error instanceof Error && error.message.includes('UNIQUE constraint failed')
  )
}

const loginWindowMs = 15 * 60 * 1000
const loginMaxAttempts = 5
const loginBlockMs = 15 * 60 * 1000

function loginAttemptKeys(email: string) {
  const keys = [createHash('sha256').update(`account:${email}`).digest('hex')]
  const address = getRequestHeader('x-real-ip')
  if (address)
    keys.push(createHash('sha256').update(`ip:${address}`).digest('hex'))
  return keys
}

function registerLoginAttempt(email: string, increment = false) {
  const keys = loginAttemptKeys(email)
  const now = Date.now()
  return db.transaction((tx) => {
    tx.run(
      sql`DELETE FROM login_attempts WHERE id IN (
        SELECT id FROM login_attempts
        WHERE updated_at < ${now - loginWindowMs * 2}
        LIMIT 50
      )`,
    )

    let blocked = false
    for (const key of keys) {
      const current = tx
        .select()
        .from(loginAttempts)
        .where(eq(loginAttempts.attemptKey, key))
        .limit(1)
        .get()

      if (current?.blockedUntil && current.blockedUntil > now) {
        blocked = true
        continue
      }
      if (!increment) continue

      if (!current || now - current.windowStartedAt >= loginWindowMs) {
        tx.insert(loginAttempts)
          .values({
            id: randomUUID(),
            attemptKey: key,
            windowStartedAt: now,
            attempts: 1,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: loginAttempts.attemptKey,
            set: {
              windowStartedAt: now,
              attempts: 1,
              blockedUntil: null,
              updatedAt: now,
            },
          })
          .run()
        continue
      }

      const attempts = current.attempts + 1
      tx.update(loginAttempts)
        .set({
          attempts,
          blockedUntil: attempts > loginMaxAttempts ? now + loginBlockMs : null,
          updatedAt: now,
        })
        .where(eq(loginAttempts.id, current.id))
        .run()
      if (attempts > loginMaxAttempts) blocked = true
    }
    return blocked
  })
}

function clearLoginAttempts(email: string) {
  const accountKey = loginAttemptKeys(email)[0]
  db.transaction((tx) => {
    if (accountKey) {
      tx.delete(loginAttempts)
        .where(eq(loginAttempts.attemptKey, accountKey))
        .run()
    }
  })
}

export const login = createServerFn({ method: 'POST' })
  .middleware([authErrorMiddleware])
  .validator((data) =>
    parseInput<ReturnType<typeof loginSchema.parse>>(loginSchema, data),
  )
  .handler(async ({ data }) => {
    assertSameOrigin()
    if (registerLoginAttempt(data.email)) {
      throw new AppError(
        'RATE_LIMITED',
        'Demasiados intentos. Prueba más tarde',
      )
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1)
      .then((result) => result.at(0))

    const passwordMatches = await verifyPassword(
      user?.passwordHash ?? dummyPasswordHash,
      data.password,
    )

    if (!user || !passwordMatches) {
      registerLoginAttempt(data.email, true)
      throw new AppError(
        'INVALID_CREDENTIALS',
        'El correo o la contraseña no son válidos',
      )
    }
    if (!user.isActive) {
      registerLoginAttempt(data.email, true)
      throw new AppError('USER_INACTIVE', 'Tu usuario está inactivo')
    }

    const result = db.transaction((tx) => {
      const current = tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1)
        .get()
      if (
        !current ||
        !current.isActive ||
        current.passwordHash !== user.passwordHash
      ) {
        throw new AppError(
          'INVALID_CREDENTIALS',
          'El correo o la contraseña no son válidos',
        )
      }

      const now = Date.now()
      const session = createSessionRecord(current.id)
      tx.update(users)
        .set({ lastLoginAt: now, updatedAt: now })
        .where(eq(users.id, current.id))
        .run()
      tx.insert(sessions)
        .values({
          id: session.id,
          userId: session.userId,
          tokenHash: session.tokenHash,
          expiresAt: session.expiresAt,
          lastSeenAt: session.lastSeenAt,
          createdAt: session.createdAt,
        })
        .run()
      return { user: current, token: session.token }
    })

    clearLoginAttempts(data.email)
    setSessionCookie(result.token)
    return { user: toSafeUser(result.user) }
  })

export const logout = createServerFn({ method: 'POST' })
  .middleware([authErrorMiddleware])
  .handler(async () => {
    assertSameOrigin()
    await revokeCurrentSession()
    return { ok: true as const }
  })

export const getCurrentUser = createServerFn({ method: 'GET' })
  .middleware([authErrorMiddleware])
  .handler(async () => {
    const session = await getCurrentSession()
    return session ? { user: toSafeUser(session.user) } : null
  })

export const listUsers = createServerFn({ method: 'GET' })
  .middleware([authErrorMiddleware])
  .handler(async () => {
    const session = await requireSession()
    requireRole(session.user, ['admin'])

    const result = await db.select().from(users).orderBy(asc(users.name))
    return { users: result.map(toSafeUser) }
  })

export const createUser = createServerFn({ method: 'POST' })
  .middleware([authErrorMiddleware])
  .validator((data) =>
    parseInput<ReturnType<typeof createUserSchema.parse>>(
      createUserSchema,
      data,
    ),
  )
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin'])
    const requestId = randomUUID()
    const now = Date.now()
    const id = randomUUID()
    const passwordHash = await hashPassword(data.password)

    try {
      const safeUser = db.transaction((tx) => {
        tx.insert(users)
          .values({
            id,
            name: data.name,
            email: data.email,
            passwordHash,
            role: data.role,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          })
          .run()

        const created = tx
          .select()
          .from(users)
          .where(eq(users.id, id))
          .limit(1)
          .get()
        const user = created
        if (!user)
          throw new AppError('INTERNAL_ERROR', 'No se pudo crear el usuario')

        const safe = toSafeUser(user)
        tx.insert(auditLogs)
          .values({
            id: randomUUID(),
            actorUserId: session.user.id,
            action: 'user.created',
            entityType: 'user',
            entityId: id,
            afterJson: JSON.stringify(safe),
            createdAt: now,
            requestId,
          })
          .run()
        return safe
      })
      return { user: safeUser }
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw new AppError(
          'USER_ALREADY_EXISTS',
          'Ya existe un usuario con ese correo',
        )
      }
      throw error
    }
  })

export const updateUser = createServerFn({ method: 'POST' })
  .middleware([authErrorMiddleware])
  .validator((data) =>
    parseInput<ReturnType<typeof updateUserSchema.parse>>(
      updateUserSchema,
      data,
    ),
  )
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin'])
    const requestId = randomUUID()
    const passwordChanged = data.password !== undefined
    const passwordHash =
      data.password === undefined
        ? undefined
        : await hashPassword(data.password)
    const now = Date.now()
    const after = db.transaction((tx) => {
      const current = tx
        .select()
        .from(users)
        .where(eq(users.id, data.id))
        .limit(1)
        .get()
      if (!current) {
        throw new AppError('USER_NOT_FOUND', 'No se encontró el usuario')
      }

      const nextRole = data.role ?? current.role
      const nextIsActive = data.isActive ?? current.isActive
      if (
        current.role === 'admin' &&
        current.isActive &&
        (nextRole !== 'admin' || !nextIsActive)
      ) {
        const activeAdmins =
          tx
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(and(eq(users.role, 'admin'), eq(users.isActive, true)))
            .get()?.count ?? 0
        if (activeAdmins <= 1) {
          throw new AppError(
            'LAST_ADMIN_REQUIRED',
            'Debe existir al menos un administrador activo',
          )
        }
      }

      const changes: Partial<typeof users.$inferInsert> = { updatedAt: now }
      if (data.name !== undefined) changes.name = data.name
      if (data.role !== undefined) changes.role = data.role
      if (data.isActive !== undefined) changes.isActive = data.isActive
      if (passwordHash !== undefined) changes.passwordHash = passwordHash

      tx.update(users).set(changes).where(eq(users.id, current.id)).run()

      if (passwordChanged || data.isActive === false) {
        tx.update(sessions)
          .set({ revokedAt: now })
          .where(
            and(eq(sessions.userId, current.id), isNull(sessions.revokedAt)),
          )
          .run()
      }

      const updated = tx
        .select()
        .from(users)
        .where(eq(users.id, current.id))
        .limit(1)
        .get()
      if (!updated) {
        throw new AppError('INTERNAL_ERROR', 'No se pudo actualizar el usuario')
      }

      const before = toSafeUser(current)
      const safe = toSafeUser(updated)
      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: passwordChanged ? 'user.password_changed' : 'user.updated',
          entityType: 'user',
          entityId: updated.id,
          beforeJson: JSON.stringify(before),
          afterJson: JSON.stringify(safe),
          createdAt: now,
          requestId,
        })
        .run()
      return safe
    })

    return { user: after }
  })
