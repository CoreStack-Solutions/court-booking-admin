import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import * as schema from '@/db/schema'

const isProd = process.env.NODE_ENV === 'production'
const databaseUrl =
  process.env.DATABASE_URL ??
  (isProd ? '/tmp/canchas.db' : './data/canchas.db')

if (databaseUrl !== ':memory:') {
  mkdirSync(dirname(databaseUrl), { recursive: true })
}

export const sqlite = new Database(databaseUrl)
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('busy_timeout = 5000')

export const db = drizzle(sqlite, { schema })

// Auto-migrate + seed on first request in production
if (isProd) {
  try {
    // Check if users table exists and has data
    const tableCheck = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).get()

    if (!tableCheck) {
      // No tables yet, run migrations
      migrate(db, { migrationsFolder: './src/db/migrations' })
      // Seed after migration
      const { seedProduction } = await import('@/db/seed-prod')
      await seedProduction(db)
    } else {
      // Tables exist, check if admin user exists
      const userCheck = sqlite.prepare('SELECT id FROM users LIMIT 1').get()
      if (!userCheck) {
        // No users, seed data
        const { seedProduction } = await import('@/db/seed-prod')
        await seedProduction(db)
      }
    }
  } catch (error) {
    console.error('DB init error:', error)
  }
}
