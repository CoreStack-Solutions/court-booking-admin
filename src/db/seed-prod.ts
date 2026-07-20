import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import { courtHours, courts, rateRules, users } from './schema'
import { hashPassword } from '../lib/password.server'
import type * as schema from './schema'

export async function seedProduction(db: BetterSQLite3Database<typeof schema>) {
  const email = process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.AUTH_ADMIN_PASSWORD

  if (!email || !password || password.length < 12) {
    console.warn('AUTH_ADMIN_EMAIL/AUTH_ADMIN_PASSWORD not set, skipping admin seed')
    return
  }

  const now = Date.now()
  const passwordHash = await hashPassword(password)

  // Upsert admin user
  const existing = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
    .get()

  if (existing) {
    db.update(users)
      .set({ passwordHash, role: 'admin', isActive: true, updatedAt: now })
      .where(eq(users.id, existing.id))
      .run()
  } else {
    db.insert(users).values({
      id: randomUUID(),
      name: 'Administrador',
      email,
      passwordHash,
      role: 'admin',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).run()
  }

  // Seed courts if empty
  const courtCount = db.select({ id: courts.id }).from(courts).limit(1).get()
  if (!courtCount) {
    const seedCourts = [
      { name: 'Cancha 1', color: '#22c55e', sortOrder: 1 },
      { name: 'Cancha 2', color: '#3b82f6', sortOrder: 2 },
      { name: 'Cancha 3', color: '#f59e0b', sortOrder: 3 },
      { name: 'Cancha 4', color: '#ec4899', sortOrder: 4 },
    ]

    for (const c of seedCourts) {
      const courtId = randomUUID()
      db.insert(courts).values({
        id: courtId,
        name: c.name,
        color: c.color,
        status: 'active',
        sortOrder: c.sortOrder,
        createdAt: now,
        updatedAt: now,
      }).run()

      for (let day = 0; day <= 6; day++) {
        const isWeekend = day === 0 || day === 6
        db.insert(courtHours).values({
          id: randomUUID(),
          courtId,
          dayOfWeek: day,
          opensAt: isWeekend ? '08:00' : '07:00',
          closesAt: isWeekend ? '20:00' : '22:00',
          isClosed: false,
        }).run()
      }
    }
  }

  // Seed rates if empty
  const rateCount = db.select({ id: rateRules.id }).from(rateRules).limit(1).get()
  if (!rateCount) {
    db.insert(rateRules).values([
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
    ]).run()
  }

  console.log('Production seed complete')
}
