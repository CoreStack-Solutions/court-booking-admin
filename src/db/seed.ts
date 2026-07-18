import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { users } from './schema'
import { db } from '../lib/db.server'
import { hashPassword } from '../lib/password.server'

if (process.env.NODE_ENV === 'production') {
  throw new Error('The development seed cannot run in production')
}

const email = process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase()
const password = process.env.AUTH_ADMIN_PASSWORD

if (!email || !password) {
  throw new Error('AUTH_ADMIN_EMAIL and AUTH_ADMIN_PASSWORD are required')
}

const now = Date.now()
const passwordHash = await hashPassword(password)
const existing = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, email))
  .limit(1)
  .then((result) => result.at(0))

if (existing) {
  await db
    .update(users)
    .set({
      name: 'Administrador local',
      passwordHash,
      role: 'admin',
      isActive: true,
      updatedAt: now,
    })
    .where(eq(users.id, existing.id))
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
