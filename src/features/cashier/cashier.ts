import { randomUUID } from 'node:crypto'
import { and, desc, eq, gte, lt } from 'drizzle-orm'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { auditLogs, payments, reservations, customers } from '@/db/schema'
import { db } from '@/lib/db.server'
import { requireSession } from '@/lib/auth.server'
import { AppError } from '@/lib/errors'

const cashierErrorMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      if (error instanceof AppError) throw error
      const requestId = randomUUID()
      console.error('cashier server function failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        requestId,
      })
      throw new AppError(
        'INTERNAL_ERROR',
        'No se pudo generar el reporte de caja',
        {},
        requestId,
      )
    }
  },
)

const dailyReportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function dayRange(value: string) {
  const startsAt = new Date(`${value}T00:00:00-05:00`).getTime()
  return { startsAt, endsAt: startsAt + 24 * 60 * 60 * 1000 }
}

export const getDailyRevenueReport = createServerFn({ method: 'GET' })
  .middleware([cashierErrorMiddleware])
  .validator((data: unknown) => dailyReportSchema.parse(data))
  .handler(async ({ data }) => {
    await requireSession()
    const { startsAt: dayStart, endsAt: dayEnd } = dayRange(data.date)

    // Fetch payments of the day
    const dayPayments = await db
      .select({
        payment: payments,
        customerName: customers.name,
      })
      .from(payments)
      .leftJoin(reservations, eq(payments.reservationId, reservations.id))
      .leftJoin(customers, eq(reservations.customerId, customers.id))
      .where(
        and(
          gte(payments.paidAt, dayStart),
          lt(payments.paidAt, dayEnd),
          eq(payments.status, 'paid'),
        ),
      )
      .orderBy(desc(payments.paidAt))

    const cashCents = dayPayments
      .filter((p) => p.payment.method === 'cash')
      .reduce((sum, p) => sum + p.payment.amountCents, 0)
    const yapeCents = dayPayments
      .filter((p) => p.payment.method === 'yape')
      .reduce((sum, p) => sum + p.payment.amountCents, 0)
    const plinCents = dayPayments
      .filter((p) => p.payment.method === 'plin')
      .reduce((sum, p) => sum + p.payment.amountCents, 0)
    const bankTransferCents = dayPayments
      .filter((p) => p.payment.method === 'bank_transfer')
      .reduce((sum, p) => sum + p.payment.amountCents, 0)
    const totalCents = cashCents + yapeCents + plinCents + bankTransferCents

    // Fetch active audits of the day
    const dayAudits = await db
      .select()
      .from(auditLogs)
      .where(
        and(
          gte(auditLogs.createdAt, dayStart),
          lt(auditLogs.createdAt, dayEnd),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))

    return {
      report: {
        date: data.date,
        totalCents,
        byMethod: {
          cashCents,
          yapeCents,
          plinCents,
          bankTransferCents,
        },
        payments: dayPayments.map((p) => ({
          id: p.payment.id,
          amountCents: p.payment.amountCents,
          method: p.payment.method,
          reference: p.payment.reference,
          paidAt: p.payment.paidAt,
          customerName: p.customerName || 'Cliente Quiosco',
        })),
        auditCount: dayAudits.length,
      },
    }
  })
