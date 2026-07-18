import 'dotenv/config'

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { sessions, users } from './schema'
import { db } from '../lib/db.server'
import { hashPassword } from '../lib/password.server'
import { createUserSchema } from '../features/auth/auth.schema'

if (process.env.NODE_ENV !== 'development') {
  throw new Error('The development seed requires NODE_ENV=development')
}

const email = process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.AUTH_ADMIN_PASSWORD

if (!email || !password || password.length < 12) {
  throw new Error('AUTH_ADMIN_EMAIL and AUTH_ADMIN_PASSWORD are required')
}

createUserSchema.parse({
  name: 'Administrador local',
  email,
  password,
  role: 'admin',
})

const now = Date.now()
const passwordHash = await hashPassword(password)
const existing = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, email))
  .limit(1)
  .then((result) => result.at(0))

if (existing) {
  db.transaction((tx) => {
    tx.update(users)
      .set({
        name: 'Administrador local',
        passwordHash,
        role: 'admin',
        isActive: true,
        updatedAt: now,
      })
      .where(eq(users.id, existing.id))
      .run()
    tx.update(sessions)
      .set({ revokedAt: now })
      .where(eq(sessions.userId, existing.id))
      .run()
  })
} else {
  await db.insert(users).values({
    id: randomUUID(),
    name: 'Administrador local',
    email,
    passwordHash,
    role: 'admin',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })
}

console.log(`Development admin ready: ${email}`)
