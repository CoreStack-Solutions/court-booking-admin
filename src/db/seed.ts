import 'dotenv/config'

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { courtHours, courts, rateRules, sessions, users } from './schema'
import { db } from '../lib/db.server'
import { hashPassword } from '../lib/password.server'
import { createUserSchema } from '../features/auth/auth.schema'

if (process.env.NODE_ENV !== 'development') {
  console.warn('Warning: Running seed in non-development environment (NODE_ENV=' + process.env.NODE_ENV + ')')
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

// ─── Courts Seed ──────────────────────────────────────────────────────────────

const seedCourts = [
  { name: 'Cancha 1', color: '#22c55e', sortOrder: 1 },
  { name: 'Cancha 2', color: '#3b82f6', sortOrder: 2 },
  { name: 'Cancha 3', color: '#f59e0b', sortOrder: 3 },
  { name: 'Cancha 4', color: '#ec4899', sortOrder: 4 },
]

const existingCourts = await db.select({ name: courts.name }).from(courts)

const existingNames = new Set(existingCourts.map((c) => c.name))

for (const seedCourt of seedCourts) {
  if (existingNames.has(seedCourt.name)) {
    console.log(`Court already exists, skipping: ${seedCourt.name}`)
    continue
  }

  const courtId = randomUUID()
  db.transaction((tx) => {
    tx.insert(courts)
      .values({
        id: courtId,
        name: seedCourt.name,
        color: seedCourt.color,
        status: 'active',
        sortOrder: seedCourt.sortOrder,
        createdAt: now,
        updatedAt: now,
      })
      .run()

    // Default hours: Mon-Fri 07:00-22:00, Sat-Sun 08:00-20:00
    for (let day = 0; day <= 6; day++) {
      const isWeekend = day === 0 || day === 6
      tx.insert(courtHours)
        .values({
          id: randomUUID(),
          courtId,
          dayOfWeek: day,
          opensAt: isWeekend ? '08:00' : '07:00',
          closesAt: isWeekend ? '20:00' : '22:00',
          isClosed: false,
        })
        .run()
    }
    console.log(`Court seeded: ${seedCourt.name}`)
  })
}

console.log('Seed complete ✓')

// Clean existing rates to avoid duplicates or old rules
await db.delete(rateRules).run()

const defaultRates = [
  {
    id: randomUUID(),
    courtId: null,
    name: 'Tarifa día',
    dayOfWeek: null,
    startsAt: '07:00',
    endsAt: '17:00',
    pricePerHourCents: 6000,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: randomUUID(),
    courtId: null,
    name: 'Tarifa noche',
    dayOfWeek: null,
    startsAt: '17:00',
    endsAt: '23:00',
    pricePerHourCents: 8000,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
]

await db.insert(rateRules).values(defaultRates).run()
console.log('Default rates seeded')

