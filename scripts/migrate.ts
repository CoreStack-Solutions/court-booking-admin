/**
 * Smart migration runner: marks already-applied migrations as done
 * (by checking existing tables AND indexes), then applies any pending ones.
 */
import 'dotenv/config'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const databaseUrl = process.env.DATABASE_URL ?? './data/canchas.db'
const db = new Database(databaseUrl)
db.pragma('foreign_keys = ON')
db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 5000')

// Ensure drizzle migrations table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    created_at INTEGER
  )
`)

// Get already-tracked migrations
const trackedHashes = new Set(
  db
    .prepare('SELECT hash FROM "__drizzle_migrations"')
    .all()
    .map((r: unknown) => (r as { hash: string }).hash),
)

// Get existing tables in the DB
const existingTables = new Set(
  db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
    .all()
    .map((r: unknown) => (r as { name: string }).name),
)

// Get existing indexes in the DB
const existingIndexes = new Set(
  db
    .prepare(`SELECT name FROM sqlite_master WHERE type='index'`)
    .all()
    .map((r: unknown) => (r as { name: string }).name),
)

const migrationsDir = './src/db/migrations'
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

let ran = 0

for (const file of files) {
  const hash = file.replace('.sql', '')

  // If already tracked, skip
  if (trackedHashes.has(hash)) {
    console.log(`  [skip] ${file} (already tracked)`)
    continue
  }

  const sql = readFileSync(join(migrationsDir, file), 'utf-8')

  // Check if all CREATE TABLE / CREATE INDEX already exist
  const tableMatches = [...sql.matchAll(/CREATE TABLE [`"](\w+)[`"]/gi)]
  const indexMatches = [...sql.matchAll(/CREATE (?:UNIQUE )?INDEX [`"](\w+)[`"]/gi)]

  const tablesInMigration = tableMatches.map((m) => m[1]!)
  const indexesInMigration = indexMatches.map((m) => m[1]!)
  const allObjects = [...tablesInMigration, ...indexesInMigration]

  const allExist =
    allObjects.length > 0 &&
    tablesInMigration.every((t) => existingTables.has(t)) &&
    indexesInMigration.every((i) => existingIndexes.has(i))

  if (allExist) {
    db.prepare(
      'INSERT OR IGNORE INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
    ).run(hash, Date.now())
    console.log(`  [mark] ${file} (already applied, marked as done)`)
    continue
  }

  // Run the migration
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)

  const applyMigration = db.transaction(() => {
    for (const stmt of statements) {
      db.exec(stmt)
    }
    db.prepare(
      'INSERT OR IGNORE INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)',
    ).run(hash, Date.now())
  })

  applyMigration()
  console.log(`  [done] ${file}`)
  ran++
}

console.log(`\n✓ Migrations complete: ${ran} new applied.`)
db.close()
