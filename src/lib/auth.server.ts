import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import {
  deleteCookie,
  getCookie,
  setCookie,
} from '@tanstack/react-start/server'

import { sessions, users } from '@/db/schema'
import { db } from '@/lib/db.server'
import { AppError } from '@/lib/errors'

const sessionLifetimeSeconds = Number(
  process.env.SESSION_MAX_AGE_SECONDS ?? 2_592_000,
)
const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? 'canchas_session'
const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

type SessionUser = typeof users.$inferSelect

export type AuthSession = {
  sessionId: string
  user: SessionUser
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string) {
  const now = Date.now()
  const token = randomBytes(32).toString('base64url')

  await db.insert(sessions).values({
    id: randomUUID(),
    userId,
    tokenHash: hashToken(token),
    expiresAt: now + sessionLifetimeSeconds * 1000,
    lastSeenAt: now,
    createdAt: now,
  })

  setCookie(sessionCookieName, token, {
    ...sessionCookieOptions,
    maxAge: sessionLifetimeSeconds,
  })
}

export async function getCurrentSession(): Promise<AuthSession | null> {
  const token = getCookie(sessionCookieName)
  if (!token) return null

  const now = Date.now()
  const result = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, now),
        isNull(sessions.revokedAt),
        eq(users.isActive, true),
      ),
    )
    .limit(1)

  const current = result.at(0)
  if (!current) {
    clearSessionCookie()
    return null
  }

  if (now - current.session.lastSeenAt > 300_000) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now })
      .where(eq(sessions.id, current.session.id))
  }

  return { sessionId: current.session.id, user: current.user }
}

export async function requireSession() {
  const session = await getCurrentSession()
  if (!session) {
    throw new AppError('UNAUTHENTICATED', 'Debes iniciar sesión')
  }
  return session
}

export async function revokeCurrentSession() {
  const token = getCookie(sessionCookieName)
  if (token) {
    await db
      .update(sessions)
      .set({ revokedAt: Date.now() })
      .where(
        and(
          eq(sessions.tokenHash, hashToken(token)),
          isNull(sessions.revokedAt),
        ),
      )
  }
  clearSessionCookie()
}

export function clearSessionCookie() {
  deleteCookie(sessionCookieName, sessionCookieOptions)
}

export function requireRole(
  user: SessionUser,
  roles: readonly SessionUser['role'][],
) {
  if (!roles.includes(user.role)) {
    throw new AppError('FORBIDDEN', 'No tienes permisos para esta acción')
  }
}
