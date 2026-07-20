import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import type { ZodType } from 'zod'
import { z } from 'zod'

import {
  auditLogs,
  idempotencyKeys,
  payments,
  reservations,
} from '@/db/schema'
import { db } from '@/lib/db.server'
import {
  assertSameOrigin,
  requireRole,
  requireSession,
} from '@/lib/auth.server'
import { AppError, validationError } from '@/lib/errors'

import { recordReservationPaymentSchema } from './payments.schema'

const paymentsErrorMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      if (error instanceof AppError) throw error
      const requestId = randomUUID()
      console.error('payment server function failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        requestId,
      })
      throw new AppError(
        'INTERNAL_ERROR',
        'No se pudo registrar el pago',
        {},
        requestId,
      )
    }
  },
)

function parseInput<T>(schema: ZodType<T>, data: unknown) {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw validationError({ form: ['Revisa los datos ingresados'] })
  }
  return parsed.data
}

export const recordReservationPayment = createServerFn({ method: 'POST' })
  .middleware([paymentsErrorMiddleware])
  .validator((data) => parseInput(recordReservationPaymentSchema, data))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin', 'operator'])
    const now = Date.now()
    const { reservationId, amountCents, method, reference, idempotencyKey } = data

    const result = db.transaction((tx) => {
      // Check idempotency
      const existingKey = tx
        .select()
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.key, idempotencyKey))
        .limit(1)
        .get()

      if (existingKey) {
        if (existingKey.status === 'completed' && existingKey.resultEntityId) {
          const existingPayment = tx
            .select()
            .from(payments)
            .where(eq(payments.id, existingKey.resultEntityId))
            .limit(1)
            .get()
          if (existingPayment) return { payment: existingPayment }
        }
        throw new AppError('IDEMPOTENCY_KEY_REUSED', 'Solicitud duplicada en proceso')
      }

      // Insert processing key
      const keyId = randomUUID()
      tx.insert(idempotencyKeys)
        .values({
          id: keyId,
          scope: 'payment.record',
          actorUserId: session.user.id,
          key: idempotencyKey,
          requestHash: '',
          status: 'processing',
          createdAt: now,
        })
        .run()

      const reservation = tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservationId))
        .limit(1)
        .get()

      if (!reservation) {
        throw new AppError('RESERVATION_NOT_FOUND', 'No se encontró la reserva')
      }

      // Check current payments
      const existingPayments = tx
        .select()
        .from(payments)
        .where(eq(payments.reservationId, reservationId))
        .all()

      const totalPaid = existingPayments.reduce(
        (sum, p) => (p.status === 'paid' ? sum + p.amountCents : sum),
        0,
      )

      const remaining = reservation.finalAmountCents - totalPaid
      if (amountCents > remaining) {
        throw new AppError(
          'VALIDATION_ERROR',
          'El monto ingresado supera el saldo restante de la reserva',
        )
      }

      const paymentId = randomUUID()
      const newPayment = {
        id: paymentId,
        reservationId,
        saleId: null,
        amountCents,
        method,
        status: 'paid' as const,
        reference: reference || null,
        paidAt: now,
        receivedBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      }

      tx.insert(payments).values(newPayment).run()

      // If fully paid and status was pending, update to confirmed
      const newTotalPaid = totalPaid + amountCents
      if (newTotalPaid >= reservation.finalAmountCents && reservation.status === 'pending') {
        tx.update(reservations)
          .set({ status: 'confirmed', updatedAt: now })
          .where(eq(reservations.id, reservationId))
          .run()

        tx.insert(auditLogs)
          .values({
            id: randomUUID(),
            actorUserId: session.user.id,
            action: 'reservation.confirmed',
            entityType: 'reservation',
            entityId: reservationId,
            afterJson: JSON.stringify({ status: 'confirmed' }),
            createdAt: now,
            requestId: randomUUID(),
          })
          .run()
      }

      // Complete idempotency
      tx.update(idempotencyKeys)
        .set({
          status: 'completed',
          resultEntityId: paymentId,
          completedAt: now,
        })
        .where(eq(idempotencyKeys.id, keyId))
        .run()

      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'payment.recorded',
          entityType: 'payment',
          entityId: paymentId,
          afterJson: JSON.stringify(newPayment),
          createdAt: now,
          requestId: randomUUID(),
        })
        .run()

      return { payment: newPayment }
    })

    return result
  })

export const listReservationPayments = createServerFn({ method: 'GET' })
  .middleware([paymentsErrorMiddleware])
  .validator((data) => parseInput(z.object({ reservationId: z.string().uuid() }), data))
  .handler(async ({ data }) => {
    await requireSession()
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.reservationId, data.reservationId))
    return { payments: rows }
  })
