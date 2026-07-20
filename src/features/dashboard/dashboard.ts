import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gte, gt, inArray, lt, sql } from 'drizzle-orm'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import type { ZodType } from 'zod'

import {
  auditLogs,
  courtHours,
  courts,
  customers,
  payments,
  reservations,
  users,
  sales,
  products,
} from '@/db/schema'
import { db } from '@/lib/db.server'
import { requireSession } from '@/lib/auth.server'
import { AppError, validationError } from '@/lib/errors'
import { reservationBlockingStatuses } from '@/lib/auth.constants'

import { dashboardDateSchema } from './dashboard.schema'
import type { DashboardSummary } from './dashboard.schema'

const dashboardErrorMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      if (error instanceof AppError) throw error
      const requestId = randomUUID()
      console.error('dashboard server function failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        requestId,
      })
      throw new AppError(
        'INTERNAL_ERROR',
        'No se pudo cargar el resumen',
        {},
        requestId,
      )
    }
  },
)

function parseInput<T>(schema: ZodType<T>, data: unknown) {
  const parsed = schema.safeParse(data)
  if (!parsed.success) throw validationError({ form: ['Fecha inválida'] })
  return parsed.data
}

function dayOfWeekForDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function dayRange(value: string) {
  const startsAt = new Date(`${value}T00:00:00-05:00`).getTime()
  return { startsAt, endsAt: startsAt + 24 * 60 * 60 * 1000 }
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function toEpoch(date: string, minutes: number) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0')
  const remainder = String(minutes % 60).padStart(2, '0')
  return new Date(`${date}T${hours}:${remainder}:00-05:00`).getTime()
}

function overlaps(
  startsAt: number,
  endsAt: number,
  existingStartsAt: number,
  existingEndsAt: number,
) {
  return existingStartsAt < endsAt && existingEndsAt > startsAt
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    'reservation.created': 'Nueva reserva creada',
    'reservation.updated': 'Reserva modificada',
    'reservation.confirmed': 'Reserva confirmada',
    'reservation.cancelled': 'Reserva cancelada',
    'reservation.completed': 'Reserva completada',
    'reservation.no_show': 'Reserva marcada como no-show',
    'customer.created': 'Nuevo cliente creado',
    'court.created': 'Nueva cancha creada',
    'court.updated': 'Cancha modificada',
  }
  return labels[action] ?? action
}

export const getDashboardSummary = createServerFn({ method: 'GET' })
  .middleware([dashboardErrorMiddleware])
  .validator((data) => parseInput(dashboardDateSchema, data))
  .handler(async ({ data }) => {
    await requireSession()
    const { startsAt: dayStart, endsAt: dayEnd } = dayRange(data.date)
    const dayOfWeek = dayOfWeekForDate(data.date)
    const now = Date.now()

    const activeCourts = await db
      .select()
      .from(courts)
      .where(eq(courts.status, 'active'))
      .orderBy(asc(courts.sortOrder), asc(courts.name))
    const courtIds = activeCourts.map((court) => court.id)
    const hours = courtIds.length
      ? await db
          .select()
          .from(courtHours)
          .where(
            and(
              inArray(courtHours.courtId, courtIds),
              eq(courtHours.dayOfWeek, dayOfWeek),
            ),
          )
      : []
    const dayReservations = await db
      .select({ reservation: reservations })
      .from(reservations)
      .where(
        and(
          lt(reservations.startsAt, dayEnd),
          gt(reservations.endsAt, dayStart),
        ),
      )
    const occupancyReservations = dayReservations.filter(
      ({ reservation }) =>
        reservation.status !== 'cancelled' && reservation.status !== 'no_show',
    )

    const totalSlots = hours.reduce((total, hour) => {
      if (hour.isClosed) return total
      return (
        total +
        Math.max(0, (toMinutes(hour.closesAt) - toMinutes(hour.opensAt)) / 30)
      )
    }, 0)
    let occupiedSlots = 0
    for (const hour of hours) {
      if (hour.isClosed) continue
      for (
        let current = toMinutes(hour.opensAt);
        current < toMinutes(hour.closesAt);
        current += 30
      ) {
        const slotStart = toEpoch(data.date, current)
        const slotEnd = toEpoch(data.date, current + 30)
        if (
          occupancyReservations.some(
            ({ reservation }) =>
              reservation.courtId === hour.courtId &&
              overlaps(
                slotStart,
                slotEnd,
                reservation.startsAt,
                reservation.endsAt,
              ),
          )
        ) {
          occupiedSlots++
        }
      }
    }

    const counts = dayReservations.reduce(
      (result, { reservation }) => {
        if (reservation.status === 'pending') result.pending++
        if (reservation.status === 'confirmed') result.confirmed++
        if (reservation.status === 'completed') result.completed++
        if (
          reservation.status !== 'cancelled' &&
          reservation.status !== 'no_show'
        ) {
          result.total++
        }
        return result
      },
      { total: 0, pending: 0, confirmed: 0, completed: 0 },
    )

    const upcomingRows = await db
      .select({ reservation: reservations, court: courts, customer: customers })
      .from(reservations)
      .innerJoin(courts, eq(reservations.courtId, courts.id))
      .innerJoin(customers, eq(reservations.customerId, customers.id))
      .where(
        and(
          gte(reservations.startsAt, Math.max(dayStart, now)),
          lt(reservations.startsAt, dayEnd),
          inArray(reservations.status, reservationBlockingStatuses),
        ),
      )
      .orderBy(asc(reservations.startsAt))
      .limit(8)

    const activityRows = await db
      .select({ audit: auditLogs, actor: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(8)

    const dayPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          gte(payments.paidAt, dayStart),
          lt(payments.paidAt, dayEnd),
          eq(payments.status, 'paid'),
        ),
      )

    const cashCents = dayPayments
      .filter((p) => p.method === 'cash')
      .reduce((sum, p) => sum + p.amountCents, 0)
    const yapeCents = dayPayments
      .filter((p) => p.method === 'yape')
      .reduce((sum, p) => sum + p.amountCents, 0)
    const plinCents = dayPayments
      .filter((p) => p.method === 'plin')
      .reduce((sum, p) => sum + p.amountCents, 0)
    const bankTransferCents = dayPayments
      .filter((p) => p.method === 'bank_transfer')
      .reduce((sum, p) => sum + p.amountCents, 0)
    const totalCents = cashCents + yapeCents + plinCents + bankTransferCents

    // Rentals vs Kiosk financials
    const rentalsCents = dayPayments
      .filter((p) => p.reservationId !== null)
      .reduce((sum, p) => sum + p.amountCents, 0)
    const kioskCents = dayPayments
      .filter((p) => p.saleId !== null)
      .reduce((sum, p) => sum + p.amountCents, 0)

    // Fetch kiosk sales
    const daySales = await db
      .select()
      .from(sales)
      .where(
        and(
          gte(sales.soldAt, dayStart),
          lt(sales.soldAt, dayEnd),
          eq(sales.status, 'completed'),
        ),
      )
    const totalSalesCents = daySales.reduce((sum, s) => sum + s.totalAmountCents, 0)
    const salesCount = daySales.length

    // Fetch low stock products
    const lowStockResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          sql`${products.currentStock} <= ${products.lowStockThreshold}`
        )
      )
      .get()
    const lowStockProductsCount = lowStockResult?.count ?? 0

    const summary: DashboardSummary = {
      date: data.date,
      reservations: counts,
      occupancy: {
        occupiedSlots,
        totalSlots,
        percentage: totalSlots
          ? Math.round((occupiedSlots / totalSlots) * 100)
          : 0,
      },
      upcoming: upcomingRows.map(({ reservation, court, customer }) => ({
        id: reservation.id,
        startsAt: reservation.startsAt,
        endsAt: reservation.endsAt,
        customerName: customer.name,
        courtName: court.name,
        status: reservation.status as 'pending' | 'confirmed',
        finalAmountCents: reservation.finalAmountCents,
      })),
      activity: activityRows.map(({ audit, actor }) => ({
        id: audit.id,
        action: actionLabel(audit.action),
        detail: `${audit.entityType} · ${audit.entityId.slice(0, 8)}`,
        createdAt: audit.createdAt,
        actorName: actor,
      })),
      financialsAvailable: true,
      financials: {
        totalCents,
        byMethod: {
          cashCents,
          yapeCents,
          plinCents,
          bankTransferCents,
        },
        byCategory: {
          rentalsCents,
          kioskCents,
        },
      },
      kioskSales: {
        count: salesCount,
        totalCents: totalSalesCents,
      },
      lowStockProductsCount,
      inventoryAvailable: true,
    }
    return { summary }
  })
