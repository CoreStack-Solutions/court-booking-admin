import { randomUUID } from 'node:crypto'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import type { ZodType } from 'zod'

import { auditLogs, sessions, users } from '@/db/schema'
import { db } from '@/lib/db.server'
import {
  createSession,
  getCurrentSession,
  requireRole,
  requireSession,
  revokeCurrentSession,
} from '@/lib/auth.server'
import { AppError, validationError } from '@/lib/errors'
import { hashPassword, verifyPassword } from '@/lib/password.server'

import { createUserSchema, loginSchema, updateUserSchema } from './auth.schema'
import type { SafeUser } from './auth.schema'

const dummyPasswordHash =
  '$argon2id$v=19$m=19456,t=2,p=1$v8JqrQOSkLTLxExYctWz7Q$Tl2e2Ea26YIlSyeK9w+3XT7f/gPwCPDu0wacCv4NJhI'

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

export const login = createServerFn({ method: 'POST' })
  .validator((data) =>
    parseInput<ReturnType<typeof loginSchema.parse>>(loginSchema, data),
  )
  .handler(async ({ data }) => {
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
      throw new AppError(
        'INVALID_CREDENTIALS',
        'El correo o la contraseña no son válidos',
      )
    }
    if (!user.isActive) {
      throw new AppError('USER_INACTIVE', 'Tu usuario está inactivo')
    }

    const now = Date.now()
    await db
      .update(users)
      .set({ lastLoginAt: now, updatedAt: now })
      .where(eq(users.id, user.id))
    await createSession(user.id)

    return { user: toSafeUser(user) }
  })

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await revokeCurrentSession()
  return { ok: true as const }
})

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await getCurrentSession()
    return session ? { user: toSafeUser(session.user) } : null
  },
)

export const listUsers = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await requireSession()
  requireRole(session.user, ['admin'])

  const result = await db.select().from(users).orderBy(asc(users.name))
  return { users: result.map(toSafeUser) }
})

export const createUser = createServerFn({ method: 'POST' })
  .validator((data) =>
    parseInput<ReturnType<typeof createUserSchema.parse>>(
      createUserSchema,
      data,
    ),
  )
  .handler(async ({ data }) => {
    const session = await requireSession()
    requireRole(session.user, ['admin'])
    const requestId = randomUUID()
    const now = Date.now()
    const id = randomUUID()
    const passwordHash = await hashPassword(data.password)

    try {
      const safeUser = await db.transaction(async (tx) => {
        await tx.insert(users).values({
          id,
          name: data.name,
          email: data.email,
          passwordHash,
          role: data.role,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })

        const created = await tx
          .select()
          .from(users)
          .where(eq(users.id, id))
          .limit(1)
        const user = created.at(0)
        if (!user)
          throw new AppError('INTERNAL_ERROR', 'No se pudo crear el usuario')

        const safe = toSafeUser(user)
        await tx.insert(auditLogs).values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'user.created',
          entityType: 'user',
          entityId: id,
          afterJson: JSON.stringify(safe),
          createdAt: now,
          requestId,
        })
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
  .validator((data) =>
    parseInput<ReturnType<typeof updateUserSchema.parse>>(
      updateUserSchema,
      data,
    ),
  )
  .handler(async ({ data }) => {
    const session = await requireSession()
    requireRole(session.user, ['admin'])
    const requestId = randomUUID()
    const current = await db
      .select()
      .from(users)
      .where(eq(users.id, data.id))
      .limit(1)
      .then((result) => result.at(0))

    if (!current)
      throw new AppError('USER_NOT_FOUND', 'No se encontró el usuario')

    const passwordChanged = data.password !== undefined
    const passwordHash =
      data.password === undefined
        ? undefined
        : await hashPassword(data.password)
    const now = Date.now()
    const after = await db.transaction(async (tx) => {
      const nextRole = data.role ?? current.role
      const nextIsActive = data.isActive ?? current.isActive
      if (
        current.role === 'admin' &&
        current.isActive &&
        (nextRole !== 'admin' || !nextIsActive)
      ) {
        const activeAdmins = await tx
          .select({ count: sql<number>`count(*)` })
          .from(users)
          .where(and(eq(users.role, 'admin'), eq(users.isActive, true)))
          .then((result) => Number(result.at(0)?.count ?? 0))
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

      await tx.update(users).set(changes).where(eq(users.id, current.id))

      if (passwordChanged || data.isActive === false) {
        await tx
          .update(sessions)
          .set({ revokedAt: now })
          .where(
            and(eq(sessions.userId, current.id), isNull(sessions.revokedAt)),
          )
      }

      const updated = await tx
        .select()
        .from(users)
        .where(eq(users.id, current.id))
        .limit(1)
        .then((result) => result.at(0))
      if (!updated) {
        throw new AppError('INTERNAL_ERROR', 'No se pudo actualizar el usuario')
      }

      const before = toSafeUser(current)
      const safe = toSafeUser(updated)
      await tx.insert(auditLogs).values({
        id: randomUUID(),
        actorUserId: session.user.id,
        action: 'user.updated',
        entityType: 'user',
        entityId: updated.id,
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify(safe),
        createdAt: now,
        requestId,
      })
      return safe
    })

    return { user: after }
  })
