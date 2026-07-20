import type Database from 'better-sqlite3'

import { reservationBlockingStatuses } from '@/lib/auth.constants'

export function reservationOverlaps(
  startsAt: number,
  endsAt: number,
  existingStartsAt: number,
  existingEndsAt: number,
) {
  return existingStartsAt < endsAt && existingEndsAt > startsAt
}

export const reservationConflictSql = `SELECT id FROM reservations
       WHERE court_id = ?
         AND starts_at < ?
         AND ends_at > ?
         AND status IN (${reservationBlockingStatuses.map(() => '?').join(', ')})
       LIMIT 1`

const reservationConflictExcludingSql = `SELECT id FROM reservations
       WHERE court_id = ?
         AND starts_at < ?
         AND ends_at > ?
         AND status IN (${reservationBlockingStatuses.map(() => '?').join(', ')})
         AND id <> ?
       LIMIT 1`

export const reservationTransactionConfig = {
  behavior: 'immediate' as const,
}

export function findReservationConflict(
  database: Database.Database,
  courtId: string,
  startsAt: number,
  endsAt: number,
  excludeReservationId?: string,
) {
  const query = excludeReservationId
    ? reservationConflictExcludingSql
    : reservationConflictSql
  const values = excludeReservationId
    ? [
        courtId,
        endsAt,
        startsAt,
        ...reservationBlockingStatuses,
        excludeReservationId,
      ]
    : [courtId, endsAt, startsAt, ...reservationBlockingStatuses]
  return database.prepare(query).get(...values) as { id: string } | undefined
}
