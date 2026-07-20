import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { unlinkSync } from 'node:fs'
import { Worker } from 'node:worker_threads'
import { describe, expect, it } from 'vitest'

import {
  findReservationConflict,
  reservationConflictSql,
  reservationTransactionConfig,
  reservationOverlaps,
} from './reservation-conflicts'
import { reservationBlockingStatuses } from '@/lib/auth.constants'

function createDatabase(path = ':memory:') {
  const database = new Database(path)
  database.pragma('foreign_keys = ON')
  migrate(drizzle(database), {
    migrationsFolder: resolve(process.cwd(), 'src/db/migrations'),
  })
  database
    .prepare(
      'INSERT INTO users (id, name, email, password_hash, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run('user-1', 'Admin', 'admin@example.com', 'hash', 'admin', 1, 1, 1)
  database
    .prepare(
      'INSERT INTO courts (id, name, color, status, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run('court-1', 'Cancha 1', '#22c55e', 'active', 1, 1, 1)
  database
    .prepare(
      'INSERT INTO customers (id, name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run('customer-1', 'Cliente Uno', 1, 1, 1)
  return database
}

function concurrentReservation(
  path: string,
  id: string,
  barrier: SharedArrayBuffer,
) {
  const require = createRequire(import.meta.url)
  const driverPath = require.resolve('better-sqlite3')
  const workerCode = `
    const { parentPort, workerData } = require('node:worker_threads')
    const Database = require(workerData.driverPath)
    const barrier = new Int32Array(workerData.barrier)
    let database
    try {
      database = new Database(workerData.path)
      database.pragma('busy_timeout = 5000')
      const arrived = Atomics.add(barrier, 0, 1) + 1
      if (arrived === 2) Atomics.notify(barrier, 0, 1)
      else Atomics.wait(barrier, 0, 1)
      database.exec('BEGIN ' + workerData.transactionBehavior.toUpperCase())
      const conflict = database
        .prepare(workerData.conflictSql)
        .get('court-1', 200, 100, ...workerData.blockingStatuses)
      if (conflict) throw new Error('RESERVATION_CONFLICT')
      database.prepare('INSERT INTO reservations (id, court_id, customer_id, starts_at, ends_at, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(workerData.id, 'court-1', 'customer-1', 100, 200, 'pending', 'user-1', 1, 1)
      database.exec('COMMIT')
      parentPort.postMessage({ ok: true })
    } catch (error) {
      try {
        if (database) database.exec('ROLLBACK')
      } catch {}
      Atomics.store(barrier, 0, 2)
      Atomics.notify(barrier, 0, 1)
      parentPort.postMessage({ ok: false, error: error.message })
    } finally {
      if (database) database.close()
    }
  `
  return new Promise<{ ok: boolean; error?: string }>((resolveWorker) => {
    const worker = new Worker(workerCode, {
      eval: true,
      workerData: {
        driverPath,
        path,
        id,
        barrier,
        conflictSql: reservationConflictSql,
        blockingStatuses: reservationBlockingStatuses,
        transactionBehavior: reservationTransactionConfig.behavior,
      },
    })
    let result: { ok: boolean; error?: string } | undefined
    worker.once('message', (message) => {
      result = message
    })
    worker.once('error', (error) => {
      const sharedBarrier = new Int32Array(barrier)
      Atomics.store(sharedBarrier, 0, 2)
      Atomics.notify(sharedBarrier, 0, 1)
      result = { ok: false, error: error.message }
    })
    worker.once('exit', (code) => {
      resolveWorker(result ?? { ok: false, error: `worker exit ${code}` })
    })
  })
}

function reserve(
  database: Database.Database,
  id: string,
  startsAt: number,
  endsAt: number,
) {
  database.exec('BEGIN IMMEDIATE')
  try {
    const conflict = findReservationConflict(
      database,
      'court-1',
      startsAt,
      endsAt,
    )
    if (conflict) throw new Error('RESERVATION_CONFLICT')
    database
      .prepare(
        'INSERT INTO reservations (id, court_id, customer_id, starts_at, ends_at, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        'court-1',
        'customer-1',
        startsAt,
        endsAt,
        'pending',
        'user-1',
        1,
        1,
      )
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

describe('reservation overlap protection', () => {
  it('uses half-open ranges for overlap checks', () => {
    expect(reservationOverlaps(100, 200, 200, 300)).toBe(false)
    expect(reservationOverlaps(100, 200, 199, 300)).toBe(true)
    expect(reservationOverlaps(100, 200, 50, 100)).toBe(false)
  })

  it('uses the production conflict query for every blocking status', () => {
    const database = createDatabase()
    reserve(database, 'reservation-1', 100, 200)
    expect(findReservationConflict(database, 'court-1', 150, 250)).toEqual({
      id: 'reservation-1',
    })
    database
      .prepare("UPDATE reservations SET status = 'confirmed' WHERE id = ?")
      .run('reservation-1')
    expect(findReservationConflict(database, 'court-1', 150, 250)).toEqual({
      id: 'reservation-1',
    })
    database
      .prepare("UPDATE reservations SET status = 'completed' WHERE id = ?")
      .run('reservation-1')
    expect(
      findReservationConflict(database, 'court-1', 150, 250),
    ).toBeUndefined()
    database.close()
  })

  it('configures SQLite reservation transactions for immediate writes', () => {
    const database = createDatabase()
    drizzle(database).transaction((transaction) => {
      transaction.run(sql`SELECT 1`)
    }, reservationTransactionConfig)
    database.close()
  })

  it('rejects an overlapping write inside an immediate transaction', () => {
    const database = createDatabase()
    reserve(database, 'reservation-1', 100, 200)
    expect(() => reserve(database, 'reservation-2', 150, 250)).toThrow(
      'RESERVATION_CONFLICT',
    )
    expect(
      database.prepare('SELECT count(*) AS count FROM reservations').get(),
    ).toEqual({ count: 1 })
    database.close()
  })

  it('can ignore the reservation being rescheduled', () => {
    const database = createDatabase()
    reserve(database, 'reservation-1', 100, 200)
    expect(
      findReservationConflict(database, 'court-1', 100, 200, 'reservation-1'),
    ).toBeUndefined()
    database.close()
  })

  it('allows adjacent ranges and ignores cancelled reservations', () => {
    const database = createDatabase()
    reserve(database, 'reservation-1', 100, 200)
    reserve(database, 'reservation-2', 200, 300)
    database
      .prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?")
      .run('reservation-1')
    database
      .prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?")
      .run('reservation-2')
    reserve(database, 'reservation-3', 150, 250)
    expect(
      database.prepare('SELECT count(*) AS count FROM reservations').get(),
    ).toEqual({ count: 3 })
    database.close()
  })

  it('allows only one concurrent writer to claim an overlapping range', async () => {
    const path = resolve(tmpdir(), `canchas-${randomUUID()}.db`)
    const database = createDatabase(path)
    database.close()
    const barrier = new SharedArrayBuffer(4)
    try {
      const results = await Promise.all([
        concurrentReservation(path, 'reservation-a', barrier),
        concurrentReservation(path, 'reservation-b', barrier),
      ])
      const reopened = new Database(path)
      expect(results.filter((result) => result.ok)).toHaveLength(1)
      expect(
        results.filter((result) => result.error === 'RESERVATION_CONFLICT'),
      ).toHaveLength(1)
      expect(
        reopened.prepare('SELECT count(*) AS count FROM reservations').get(),
      ).toEqual({ count: 1 })
      reopened.close()
    } finally {
      try {
        unlinkSync(path)
      } catch {
        // The worker may have reported an error before creating the file.
      }
    }
  })
})
