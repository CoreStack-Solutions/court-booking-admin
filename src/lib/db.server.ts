import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from '@/db/schema'

const databaseUrl = process.env.DATABASE_URL ?? './data/canchas.db'

if (databaseUrl !== ':memory:') {
  mkdirSync(dirname(databaseUrl), { recursive: true })
}

export const sqlite = new Database(databaseUrl)
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('busy_timeout = 5000')

export const db = drizzle(sqlite, { schema })
