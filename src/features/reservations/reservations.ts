import { createHash, randomUUID } from 'node:crypto'
import { and, asc, desc, eq, or, sql } from 'drizzle-orm'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import type { ZodType } from 'zod'

import {
  auditLogs,
  courtHours,
  courts,
  customers,
  idempotencyKeys,
  reservations,
} from '@/db/schema'
import { db, sqlite } from '@/lib/db.server'
import {
  assertSameOrigin,
  requireRole,
  requireSession,
} from '@/lib/auth.server'
import { AppError, validationError } from '@/lib/errors'

import {
  createCustomerSchema,
  createReservationSchema,
  customerSearchSchema,
  updateReservationStatusSchema,
} from './reservations.schema'
import type { SafeCustomer, SafeReservation } from './reservations.schema'
import {
  findReservationConflict,
  reservationTransactionConfig,
} from './reservation-conflicts'

const reservationErrorMiddleware = createMiddleware({
  type: 'function',
}).server(async ({ next }) => {
  try {
    return await next()
  } catch (error) {
    if (error instanceof AppError) throw error
    const requestId = randomUUID()
    console.error('reservation server function failed', {
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
})

function parseInput<T>(schema: ZodType<T>, data: unknown) {
  const parsed = schema.safeParse(data)
  if (!parsed.success)
    throw validationError({ form: ['Revisa los datos ingresados'] })
  return parsed.data
}

function toSafeCustomer(customer: typeof customers.$inferSelect): SafeCustomer {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    notes: customer.notes,
    isActive: customer.isActive,
  }
}

function toSafeReservation(
  reservation: typeof reservations.$inferSelect,
  court: typeof courts.$inferSelect,
  customer: typeof customers.$inferSelect,
): SafeReservation {
  return {
    id: reservation.id,
    courtId: reservation.courtId,
    courtName: court.name,
    customerId: reservation.customerId,
    customerName: customer.name,
    customerPhone: customer.phone,
    startsAt: reservation.startsAt,
    endsAt: reservation.endsAt,
    status: reservation.status,
    createdAt: reservation.createdAt,
  }
}

function toEpoch(date: string, time: string) {
  return new Date(`${date}T${time}:00-05:00`).getTime()
}

export const listCustomers = createServerFn({ method: 'GET' })
  .middleware([reservationErrorMiddleware])
  .validator((data) => parseInput(customerSearchSchema, data))
  .handler(async ({ data }) => {
    await requireSession()
    const result = await db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.isActive, true),
          data.query.trim()
            ? or(
                sql`lower(${customers.name}) like ${`%${data.query.trim().toLowerCase()}%`}`,
                sql`lower(coalesce(${customers.phone}, '')) like ${`%${data.query.trim().toLowerCase()}%`}`,
              )
            : undefined,
        ),
      )
      .orderBy(asc(customers.name))
      .limit(20)
    return { customers: result.map(toSafeCustomer) }
  })

export const createCustomer = createServerFn({ method: 'POST' })
  .middleware([reservationErrorMiddleware])
  .validator((data) => parseInput(createCustomerSchema, data))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin', 'operator'])
    const now = Date.now()
    const customer = {
      id: randomUUID(),
      name: data.name,
      phone: data.phone || null,
      notes: data.notes || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }
    db.transaction((tx) => {
      tx.insert(customers).values(customer).run()
      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'customer.created',
          entityType: 'customer',
          entityId: customer.id,
          afterJson: JSON.stringify(toSafeCustomer(customer)),
          createdAt: now,
          requestId: randomUUID(),
        })
        .run()
    })
    return { customer: toSafeCustomer(customer) }
  })

export const listReservations = createServerFn({ method: 'GET' })
  .middleware([reservationErrorMiddleware])
  .handler(async () => {
    await requireSession()
    const rows = await db
      .select({ reservation: reservations, court: courts, customer: customers })
      .from(reservations)
      .innerJoin(courts, eq(reservations.courtId, courts.id))
      .innerJoin(customers, eq(reservations.customerId, customers.id))
      .orderBy(desc(reservations.startsAt))
      .limit(100)
    return {
      reservations: rows.map((row) =>
        toSafeReservation(row.reservation, row.court, row.customer),
      ),
    }
  })

export const createReservation = createServerFn({ method: 'POST' })
  .middleware([reservationErrorMiddleware])
  .validator((data) => parseInput(createReservationSchema, data))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin', 'operator'])
    const startsAt = toEpoch(data.date, data.startsAt)
    const endsAt = toEpoch(data.date, data.endsAt)
    const now = Date.now()
    const id = randomUUID()
    const requestId = randomUUID()
    const idempotencyKey = data.idempotencyKey
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ ...data, idempotencyKey: undefined }))
      .digest('hex')

    const result = db.transaction((tx) => {
      const previous = tx
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.scope, 'reservation.create'),
            eq(idempotencyKeys.actorUserId, session.user.id),
            eq(idempotencyKeys.key, idempotencyKey),
          ),
        )
        .limit(1)
        .get()
      if (previous) {
        if (previous.requestHash !== requestHash) {
          throw new AppError(
            'IDEMPOTENCY_KEY_REUSED',
            'La clave de reintento ya fue usada con otros datos',
          )
        }
        if (previous.status === 'completed' && previous.resultEntityId) {
          const original = tx
            .select({
              reservation: reservations,
              court: courts,
              customer: customers,
            })
            .from(reservations)
            .innerJoin(courts, eq(reservations.courtId, courts.id))
            .innerJoin(customers, eq(reservations.customerId, customers.id))
            .where(eq(reservations.id, previous.resultEntityId))
            .limit(1)
            .get()
          if (original) {
            return toSafeReservation(
              original.reservation,
              original.court,
              original.customer,
            )
          }
        }
        throw new AppError(
          'INTERNAL_ERROR',
          'La operación anterior no tiene un resultado recuperable',
        )
      }
      const insertedKey = tx
        .insert(idempotencyKeys)
        .values({
          id: randomUUID(),
          scope: 'reservation.create',
          actorUserId: session.user.id,
          key: idempotencyKey,
          requestHash,
          status: 'processing',
          createdAt: now,
        })
        .onConflictDoNothing()
        .run()
      if (insertedKey.changes === 0) {
        const completed = tx
          .select()
          .from(idempotencyKeys)
          .where(
            and(
              eq(idempotencyKeys.scope, 'reservation.create'),
              eq(idempotencyKeys.actorUserId, session.user.id),
              eq(idempotencyKeys.key, idempotencyKey),
            ),
          )
          .limit(1)
          .get()
        if (completed?.status === 'completed' && completed.resultEntityId) {
          const original = tx
            .select({
              reservation: reservations,
              court: courts,
              customer: customers,
            })
            .from(reservations)
            .innerJoin(courts, eq(reservations.courtId, courts.id))
            .innerJoin(customers, eq(reservations.customerId, customers.id))
            .where(eq(reservations.id, completed.resultEntityId))
            .limit(1)
            .get()
          if (original) {
            return toSafeReservation(
              original.reservation,
              original.court,
              original.customer,
            )
          }
        }
        throw new AppError(
          'INTERNAL_ERROR',
          'La operación anterior no tiene un resultado recuperable',
        )
      }
      if (startsAt <= Date.now()) {
        throw new AppError(
          'RESERVATION_STATE_INVALID',
          'No se puede crear una reserva en una franja pasada',
        )
      }
      const court = tx
        .select()
        .from(courts)
        .where(eq(courts.id, data.courtId))
        .limit(1)
        .get()
      if (!court)
        throw new AppError('COURT_NOT_FOUND', 'No se encontró la cancha')
      if (court.status !== 'active') {
        throw new AppError('FORBIDDEN', 'La cancha no acepta nuevas reservas')
      }
      const [year, month, day] = data.date.split('-').map(Number)
      const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
      const hours = tx
        .select()
        .from(courtHours)
        .where(
          and(
            eq(courtHours.courtId, data.courtId),
            eq(courtHours.dayOfWeek, dayOfWeek),
          ),
        )
        .limit(1)
        .get()
      const toMinutes = (value: string) => {
        const [hour, minute] = value.split(':').map(Number)
        return hour * 60 + minute
      }
      if (
        !hours ||
        hours.isClosed ||
        toMinutes(data.startsAt) < toMinutes(hours.opensAt) ||
        toMinutes(data.endsAt) > toMinutes(hours.closesAt)
      ) {
        throw new AppError(
          'COURT_HOURS_CONFLICT',
          'La reserva está fuera del horario de la cancha',
        )
      }
      const customer = tx
        .select()
        .from(customers)
        .where(
          and(eq(customers.id, data.customerId), eq(customers.isActive, true)),
        )
        .limit(1)
        .get()
      if (!customer) {
        throw new AppError('CUSTOMER_NOT_FOUND', 'No se encontró el cliente')
      }
      const conflict = findReservationConflict(
        sqlite,
        data.courtId,
        startsAt,
        endsAt,
      )
      if (conflict) {
        throw new AppError(
          'RESERVATION_CONFLICT',
          'La cancha ya está reservada en ese horario',
        )
      }

      const reservation = {
        id,
        courtId: data.courtId,
        customerId: data.customerId,
        startsAt,
        endsAt,
        status: 'pending' as const,
        baseAmountCents: 0,
        discountAmountCents: 0,
        finalAmountCents: 0,
        overrideReason: null,
        createdBy: session.user.id,
        cancelledBy: null,
        cancelledAt: null,
        cancellationReason: null,
        createdAt: now,
        updatedAt: now,
      }
      tx.insert(reservations).values(reservation).run()
      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'reservation.created',
          entityType: 'reservation',
          entityId: id,
          afterJson: JSON.stringify(reservation),
          createdAt: now,
          requestId,
        })
        .run()
      tx.update(idempotencyKeys)
        .set({
          status: 'completed',
          resultEntityId: id,
          completedAt: now,
        })
        .where(
          and(
            eq(idempotencyKeys.scope, 'reservation.create'),
            eq(idempotencyKeys.actorUserId, session.user.id),
            eq(idempotencyKeys.key, idempotencyKey),
          ),
        )
        .run()
      return toSafeReservation(reservation, court, customer)
    }, reservationTransactionConfig)
    return { reservation: result }
  })

export const updateReservationStatus = createServerFn({ method: 'POST' })
  .middleware([reservationErrorMiddleware])
  .validator((data) => parseInput(updateReservationStatusSchema, data))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin', 'operator'])
    const now = Date.now()
    const result = db.transaction((tx) => {
      const current = tx
        .select({
          reservation: reservations,
          court: courts,
          customer: customers,
        })
        .from(reservations)
        .innerJoin(courts, eq(reservations.courtId, courts.id))
        .innerJoin(customers, eq(reservations.customerId, customers.id))
        .where(eq(reservations.id, data.id))
        .limit(1)
        .get()
      if (!current)
        throw new AppError('RESERVATION_NOT_FOUND', 'No se encontró la reserva')
      if (current.reservation.status === 'cancelled') {
        throw new AppError(
          'RESERVATION_STATE_INVALID',
          'La reserva ya está cancelada',
        )
      }
      const allowedTransitions: Record<string, string[]> = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['completed', 'no_show', 'cancelled'],
      }
      const transitions = allowedTransitions[current.reservation.status] ?? []
      if (!transitions.includes(data.status)) {
        throw new AppError(
          'RESERVATION_STATE_INVALID',
          'El cambio de estado no está permitido',
        )
      }
      if (data.status === 'cancelled' && !data.reason?.trim()) {
        throw validationError({ reason: ['Indica el motivo de cancelación'] })
      }
      if (data.status === 'completed' && now < current.reservation.endsAt) {
        throw new AppError(
          'RESERVATION_STATE_INVALID',
          'No se puede completar una reserva antes de su hora de fin',
        )
      }
      if (data.status === 'confirmed' && now >= current.reservation.startsAt) {
        throw new AppError(
          'RESERVATION_STATE_INVALID',
          'No se puede confirmar una reserva ya iniciada',
        )
      }
      if (data.status === 'no_show' && now < current.reservation.startsAt) {
        throw new AppError(
          'RESERVATION_STATE_INVALID',
          'No se puede marcar no-show antes de la hora de inicio',
        )
      }
      if (data.status === 'cancelled' && now >= current.reservation.startsAt) {
        throw new AppError(
          'RESERVATION_STATE_INVALID',
          'No se puede cancelar una reserva ya iniciada',
        )
      }
      const next = {
        status: data.status,
        updatedAt: now,
        ...(data.status === 'cancelled'
          ? {
              cancelledBy: session.user.id,
              cancelledAt: now,
              cancellationReason: data.reason || null,
            }
          : {}),
      }
      tx.update(reservations)
        .set(next)
        .where(eq(reservations.id, data.id))
        .run()
      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: `reservation.${data.status}`,
          entityType: 'reservation',
          entityId: data.id,
          beforeJson: JSON.stringify(current.reservation),
          afterJson: JSON.stringify(next),
          reason: data.reason || null,
          createdAt: now,
          requestId: randomUUID(),
        })
        .run()
      return toSafeReservation(
        { ...current.reservation, ...next },
        current.court,
        current.customer,
      )
    })
    return { reservation: result }
  })
