import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import * as schema from '@/db/schema'
import { seedProduction } from '@/db/seed-prod'

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
    const tableCheck = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    ).get()

    if (!tableCheck) {
      console.log('[db] No tables found, running migrations...')
      migrate(db, { migrationsFolder: './src/db/migrations' })
      console.log('[db] Migrations complete, seeding...')
      seedProduction(db).then(() => {
        console.log('[db] Seed complete')
      }).catch((err) => {
        console.error('[db] Seed failed:', err)
      })
    } else {
      const userCheck = sqlite.prepare('SELECT id FROM users LIMIT 1').get()
      if (!userCheck) {
        console.log('[db] No users found, seeding...')
        seedProduction(db).then(() => {
          console.log('[db] Seed complete')
        }).catch((err) => {
          console.error('[db] Seed failed:', err)
        })
      }
    }
  } catch (error) {
    console.error('[db] Init error:', error)
  }
}
