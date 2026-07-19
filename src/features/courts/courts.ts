import { randomUUID } from 'node:crypto'
import { and, asc, eq, gt, inArray, lt } from 'drizzle-orm'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import type { ZodType } from 'zod'
import { z } from 'zod'

import { auditLogs, courtHours, courts, reservations } from '@/db/schema'
import { db } from '@/lib/db.server'
import { requireRole, requireSession } from '@/lib/auth.server'
import { AppError, validationError } from '@/lib/errors'

import {
  createCourtSchema,
  listAvailabilitySchema,
  updateCourtHoursSchema,
  updateCourtSchema,
} from './courts.schema'
import type {
  AvailabilityBlock,
  CourtHourEntry,
  SafeCourt,
} from './courts.schema'
import { reservationOverlaps } from '@/features/reservations/reservation-conflicts'
import { reservationBlockingStatuses } from '@/lib/auth.constants'

// ─── Middleware ───────────────────────────────────────────────────────────────

const courtErrorMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      if (error instanceof AppError) throw error
      const requestId = randomUUID()
      console.error('court server function failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        requestId,
      })
      throw new AppError(
        'INTERNAL_ERROR',
        'No se pudo completar la solicitud',
        {},
        requestId,
      )
    }
  },
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseInput<T>(schema: ZodType<T>, data: unknown) {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw validationError({ form: ['Revisa los datos ingresados'] })
  }
  return parsed.data
}

function toSafeCourt(court: typeof courts.$inferSelect): SafeCourt {
  return {
    id: court.id,
    name: court.name,
    color: court.color,
    status: court.status,
    sortOrder: court.sortOrder,
    createdAt: court.createdAt,
    updatedAt: court.updatedAt,
  }
}

function toCourtHourEntry(
  hour: typeof courtHours.$inferSelect,
): CourtHourEntry {
  return {
    id: hour.id,
    courtId: hour.courtId,
    dayOfWeek: hour.dayOfWeek,
    opensAt: hour.opensAt,
    closesAt: hour.closesAt,
    isClosed: hour.isClosed,
  }
}

// ─── Server Functions ─────────────────────────────────────────────────────────

export const listCourts = createServerFn({ method: 'GET' })
  .middleware([courtErrorMiddleware])
  .handler(async () => {
    await requireSession()
    const result = await db
      .select()
      .from(courts)
      .orderBy(asc(courts.sortOrder), asc(courts.name))
    return { courts: result.map(toSafeCourt) }
  })

export const createCourt = createServerFn({ method: 'POST' })
  .middleware([courtErrorMiddleware])
  .validator((data) =>
    parseInput<ReturnType<typeof createCourtSchema.parse>>(
      createCourtSchema,
      data,
    ),
  )
  .handler(async ({ data }) => {
    const session = await requireSession()
    requireRole(session.user, ['admin'])

    const now = Date.now()
    const id = randomUUID()
    const requestId = randomUUID()

    const court = db.transaction((tx) => {
      tx.insert(courts)
        .values({
          id,
          name: data.name,
          color: data.color,
          status: data.status,
          sortOrder: data.sortOrder,
          createdAt: now,
          updatedAt: now,
        })
        .run()

      // Create default hours Mon–Sun 07:00–22:00
      for (let day = 0; day <= 6; day++) {
        tx.insert(courtHours)
          .values({
            id: randomUUID(),
            courtId: id,
            dayOfWeek: day,
            opensAt: '07:00',
            closesAt: '22:00',
            isClosed: false,
          })
          .run()
      }

      const created = tx
        .select()
        .from(courts)
        .where(eq(courts.id, id))
        .limit(1)
        .get()
      if (!created)
        throw new AppError('INTERNAL_ERROR', 'No se pudo crear la cancha')

      const safe = toSafeCourt(created)
      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'court.created',
          entityType: 'court',
          entityId: id,
          afterJson: JSON.stringify(safe),
          createdAt: now,
          requestId,
        })
        .run()

      return safe
    })

    return { court }
  })

export const updateCourt = createServerFn({ method: 'POST' })
  .middleware([courtErrorMiddleware])
  .validator((data) =>
    parseInput<ReturnType<typeof updateCourtSchema.parse>>(
      updateCourtSchema,
      data,
    ),
  )
  .handler(async ({ data }) => {
    const session = await requireSession()
    requireRole(session.user, ['admin'])

    const now = Date.now()
    const requestId = randomUUID()

    const after = db.transaction((tx) => {
      const current = tx
        .select()
        .from(courts)
        .where(eq(courts.id, data.id))
        .limit(1)
        .get()
      if (!current)
        throw new AppError('COURT_NOT_FOUND', 'No se encontró la cancha')

      const changes: Partial<typeof courts.$inferInsert> = { updatedAt: now }
      if (data.name !== undefined) changes.name = data.name
      if (data.color !== undefined) changes.color = data.color
      if (data.status !== undefined) changes.status = data.status
      if (data.sortOrder !== undefined) changes.sortOrder = data.sortOrder

      tx.update(courts).set(changes).where(eq(courts.id, data.id)).run()

      const updated = tx
        .select()
        .from(courts)
        .where(eq(courts.id, data.id))
        .limit(1)
        .get()
      if (!updated)
        throw new AppError('INTERNAL_ERROR', 'No se pudo actualizar la cancha')

      const before = toSafeCourt(current)
      const safe = toSafeCourt(updated)

      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'court.updated',
          entityType: 'court',
          entityId: data.id,
          beforeJson: JSON.stringify(before),
          afterJson: JSON.stringify(safe),
          createdAt: now,
          requestId,
        })
        .run()

      return safe
    })

    return { court: after }
  })

export const listCourtHours = createServerFn({ method: 'GET' })
  .middleware([courtErrorMiddleware])
  .validator((data) => {
    const parsed = z_courtId.safeParse(data)
    if (!parsed.success)
      throw validationError({ form: ['ID de cancha inválido'] })
    return parsed.data
  })
  .handler(async ({ data }) => {
    await requireSession()

    const courtExists = await db
      .select({ id: courts.id })
      .from(courts)
      .where(eq(courts.id, data.courtId))
      .limit(1)
      .then((r) => r.at(0))
    if (!courtExists)
      throw new AppError('COURT_NOT_FOUND', 'No se encontró la cancha')

    const hours = await db
      .select()
      .from(courtHours)
      .where(eq(courtHours.courtId, data.courtId))
      .orderBy(asc(courtHours.dayOfWeek))

    return { hours: hours.map(toCourtHourEntry) }
  })

export const updateCourtHours = createServerFn({ method: 'POST' })
  .middleware([courtErrorMiddleware])
  .validator((data) =>
    parseInput<ReturnType<typeof updateCourtHoursSchema.parse>>(
      updateCourtHoursSchema,
      data,
    ),
  )
  .handler(async ({ data }) => {
    const session = await requireSession()
    requireRole(session.user, ['admin'])

    const now = Date.now()
    const requestId = randomUUID()

    const hours = db.transaction((tx) => {
      const courtExists = tx
        .select({ id: courts.id })
        .from(courts)
        .where(eq(courts.id, data.courtId))
        .limit(1)
        .get()
      if (!courtExists)
        throw new AppError('COURT_NOT_FOUND', 'No se encontró la cancha')

      // Upsert hours for all 7 days
      for (const entry of data.hours) {
        const existing = tx
          .select()
          .from(courtHours)
          .where(
            and(
              eq(courtHours.courtId, data.courtId),
              eq(courtHours.dayOfWeek, entry.dayOfWeek),
            ),
          )
          .limit(1)
          .get()

        if (existing) {
          tx.update(courtHours)
            .set({
              opensAt: entry.opensAt,
              closesAt: entry.closesAt,
              isClosed: entry.isClosed,
            })
            .where(eq(courtHours.id, existing.id))
            .run()
        } else {
          tx.insert(courtHours)
            .values({
              id: randomUUID(),
              courtId: data.courtId,
              dayOfWeek: entry.dayOfWeek,
              opensAt: entry.opensAt,
              closesAt: entry.closesAt,
              isClosed: entry.isClosed,
            })
            .run()
        }
      }

      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'court.hours_updated',
          entityType: 'court',
          entityId: data.courtId,
          afterJson: JSON.stringify(data.hours),
          createdAt: now,
          requestId,
        })
        .run()

      return tx
        .select()
        .from(courtHours)
        .where(eq(courtHours.courtId, data.courtId))
        .orderBy(asc(courtHours.dayOfWeek))
        .all()
    })

    return { hours: hours.map(toCourtHourEntry) }
  })

export const listAvailability = createServerFn({ method: 'GET' })
  .middleware([courtErrorMiddleware])
  .validator((data) =>
    parseInput<ReturnType<typeof listAvailabilitySchema.parse>>(
      listAvailabilitySchema,
      data,
    ),
  )
  .handler(async ({ data }) => {
    await requireSession()

    const court = await db
      .select()
      .from(courts)
      .where(eq(courts.id, data.courtId))
      .limit(1)
      .then((r) => r.at(0))
    if (!court)
      throw new AppError('COURT_NOT_FOUND', 'No se encontró la cancha')

    // Get day of week for the requested date (0=Sunday)
    const [year, month, day] = data.date.split('-').map(Number)
    const requestedDate = new Date(year, month - 1, day)
    const dayOfWeek = requestedDate.getDay()

    const dayHours = await db
      .select()
      .from(courtHours)
      .where(
        and(
          eq(courtHours.courtId, data.courtId),
          eq(courtHours.dayOfWeek, dayOfWeek),
        ),
      )
      .limit(1)
      .then((r) => r.at(0))

    if (!dayHours || dayHours.isClosed || court.status === 'inactive') {
      return { court: toSafeCourt(court), blocks: [] as AvailabilityBlock[] }
    }

    const dayStart = new Date(`${data.date}T00:00:00-05:00`).getTime()
    const dayEnd = dayStart + 24 * 60 * 60 * 1000
    const booked = await db
      .select({ startsAt: reservations.startsAt, endsAt: reservations.endsAt })
      .from(reservations)
      .where(
        and(
          eq(reservations.courtId, data.courtId),
          lt(reservations.startsAt, dayEnd),
          gt(reservations.endsAt, dayStart),
          inArray(reservations.status, reservationBlockingStatuses),
        ),
      )

    // Generate 30-min blocks between opensAt and closesAt
    const blocks: AvailabilityBlock[] = []
    const [openH, openM] = dayHours.opensAt.split(':').map(Number)
    const [closeH, closeM] = dayHours.closesAt.split(':').map(Number)
    let currentMinutes = openH * 60 + openM
    const endMinutes = closeH * 60 + closeM

    while (currentMinutes < endMinutes) {
      const nextMinutes = currentMinutes + 30
      const format = (m: number) =>
        `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
      blocks.push({
        startsAt: format(currentMinutes),
        endsAt: format(nextMinutes),
        available:
          court.status === 'active' &&
          !booked.some((reservation) => {
            const blockStart = new Date(
              `${data.date}T${format(currentMinutes)}:00-05:00`,
            ).getTime()
            const blockEnd = new Date(
              `${data.date}T${format(nextMinutes)}:00-05:00`,
            ).getTime()
            return reservationOverlaps(
              blockStart,
              blockEnd,
              reservation.startsAt,
              reservation.endsAt,
            )
          }),
      })
      currentMinutes = nextMinutes
    }

    return { court: toSafeCourt(court), blocks }
  })

const z_courtId = z.object({ courtId: z.string().uuid() })
