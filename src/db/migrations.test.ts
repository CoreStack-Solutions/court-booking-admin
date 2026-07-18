import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function migrationFiles() {
  const directory = resolve(process.cwd(), 'src/db/migrations')
  return readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

function applyMigrations(
  database: Database.Database,
  files = migrationFiles(),
) {
  const directory = resolve(process.cwd(), 'src/db/migrations')
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
    database.pragma('foreign_keys = ON')
    migrate(drizzle(database), {
      migrationsFolder: resolve(process.cwd(), 'src/db/migrations'),
    })

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

  it('fails safely when legacy emails collide after normalization', () => {
    const database = new Database(':memory:')
    database.pragma('foreign_keys = ON')
    applyMigrations(database, ['0000_orange_hardball.sql'])
    const insert = database.prepare(
      'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    insert.run('user-1', 'Admin', 'Admin@example.com', 'hash', 'admin', 1, 1, 1)
    insert.run(
      'user-2',
      'Admin 2',
      'admin@example.com',
      'hash',
      'admin',
      1,
      1,
      1,
    )

    expect(() =>
      database.transaction(() =>
        applyMigrations(database, ['0001_cuddly_human_robot.sql']),
      )(),
    ).toThrow()
    expect(
      database.prepare('SELECT count(*) AS count FROM users').get(),
    ).toEqual({
      count: 2,
    })
    expect(
      database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'users_email_unique'",
        )
        .get(),
    ).toBeTruthy()
    database.close()
  })
})
