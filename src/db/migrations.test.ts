import Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function applyMigrations(database: Database.Database) {
  const directory = resolve(process.cwd(), 'src/db/migrations')
  const files = readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const sql = readFileSync(resolve(directory, file), 'utf8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      database.exec(statement)
    }
  }
}

describe('SQLite migrations', () => {
  it('apply from empty and enforce auth invariants', () => {
    const database = new Database(':memory:')
    applyMigrations(database)

    database
      .prepare(
        'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run('user-1', 'Admin', 'admin@example.com', 'hash', 'admin', 1, 1, 1)

    expect(() =>
      database
        .prepare(
          'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          'user-2',
          'Operator',
          'ADMIN@EXAMPLE.COM',
          'hash',
          'operator',
          1,
          1,
          1,
        ),
    ).toThrow()

    expect(() =>
      database
        .prepare(
          'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          'user-3',
          'Viewer',
          'viewer@example.com',
          'hash',
          'unknown',
          1,
          1,
          1,
        ),
    ).toThrow()

    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'login_attempts_updated_idx'",
        )
        .get(),
    ).toBeTruthy()

    database.close()
  })
})
