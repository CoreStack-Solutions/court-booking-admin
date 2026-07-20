import { mkdirSync, existsSync } from 'node:fs'
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

// Auto-migrate + seed on cold start in production
if (isProd && !existsSync(databaseUrl)) {
  migrate(db, { migrationsFolder: './src/db/migrations' })
  const { seedProduction } = await import('@/db/seed-prod')
  await seedProduction(db)
}
