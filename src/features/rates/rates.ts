import { randomUUID } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import type { ZodType } from 'zod'

import { auditLogs, courts, rateRules } from '@/db/schema'
import { db } from '@/lib/db.server'
import { AppError, validationError } from '@/lib/errors'
import {
  assertSameOrigin,
  requireRole,
  requireSession,
} from '@/lib/auth.server'

import {
  createRateRuleSchema,
  quoteReservationSchema,
  updateRateRuleSchema,
} from './rates.schema'
import type { RateRuleForCalculation } from './rate-calculation'
import { calculateReservationQuote } from './rate-calculation'

const rateErrorMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      if (error instanceof AppError) throw error
      const requestId = randomUUID()
      console.error('rate server function failed', {
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

function parseInput<T>(schema: ZodType<T>, data: unknown) {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw validationError({ form: ['Revisa los datos ingresados'] })
  }
  return parsed.data
}

function toSafeRateRule(
  rule: typeof rateRules.$inferSelect,
  courtName?: string | null,
) {
  return {
    id: rule.id,
    courtId: rule.courtId,
    courtName: courtName ?? null,
    name: rule.name,
    dayOfWeek: rule.dayOfWeek,
    startsAt: rule.startsAt,
    endsAt: rule.endsAt,
    pricePerHourCents: rule.pricePerHourCents,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    isActive: rule.isActive,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  }
}

function asCalculationRule(
  rule: typeof rateRules.$inferSelect,
): RateRuleForCalculation {
  return {
    id: rule.id,
    courtId: rule.courtId,
    name: rule.name,
    dayOfWeek: rule.dayOfWeek,
    startsAt: rule.startsAt,
    endsAt: rule.endsAt,
    pricePerHourCents: rule.pricePerHourCents,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
  }
}

function assertNoAmbiguousRateRule(
  existingRules: (typeof rateRules.$inferSelect)[],
  candidate: typeof rateRules.$inferSelect,
  excludeId?: string,
) {
  const conflict = existingRules.find(
    (existing) =>
      existing.id !== excludeId &&
      existing.isActive &&
      candidate.isActive &&
      existing.courtId === candidate.courtId &&
      existing.dayOfWeek === candidate.dayOfWeek &&
      existing.startsAt < candidate.endsAt &&
      existing.endsAt > candidate.startsAt &&
      existing.effectiveFrom <= (candidate.effectiveTo ?? '9999-12-31') &&
      (existing.effectiveTo ?? '9999-12-31') >= candidate.effectiveFrom,
  )
  if (conflict) {
    throw new AppError(
      'RATE_RULE_CONFLICT',
      'La regla se solapa con otra tarifa del mismo alcance',
      { conflictingRuleId: conflict.id },
    )
  }
}

export const listRateRules = createServerFn({ method: 'GET' })
  .middleware([rateErrorMiddleware])
  .handler(async () => {
    const session = await requireSession()
    requireRole(session.user, ['admin'])
    const rows = await db
      .select({ rule: rateRules, courtName: courts.name })
      .from(rateRules)
      .leftJoin(courts, eq(rateRules.courtId, courts.id))
      .orderBy(asc(rateRules.effectiveFrom), asc(rateRules.startsAt))
    return {
      rateRules: rows.map((row) => toSafeRateRule(row.rule, row.courtName)),
    }
  })

export const createRateRule = createServerFn({ method: 'POST' })
  .middleware([rateErrorMiddleware])
  .validator((data) => parseInput(createRateRuleSchema, data))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin'])
    const now = Date.now()
    const rule = {
      id: randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    }
    const created = db.transaction((tx) => {
      let courtName: string | null = null
      if (rule.courtId) {
        const court = tx
          .select({ id: courts.id, name: courts.name })
          .from(courts)
          .where(eq(courts.id, rule.courtId))
          .limit(1)
          .get()
        if (!court)
          throw new AppError('COURT_NOT_FOUND', 'No se encontró la cancha')
        courtName = court.name
      }
      assertNoAmbiguousRateRule(tx.select().from(rateRules).all(), rule)
      tx.insert(rateRules).values(rule).run()
      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'rate_rule.created',
          entityType: 'rate_rule',
          entityId: rule.id,
          afterJson: JSON.stringify(rule),
          createdAt: now,
          requestId: randomUUID(),
        })
        .run()
      return { rule, courtName }
    })
    return { rateRule: toSafeRateRule(created.rule, created.courtName) }
  })

export const updateRateRule = createServerFn({ method: 'POST' })
  .middleware([rateErrorMiddleware])
  .validator((data) => parseInput(updateRateRuleSchema, data))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin'])
    const now = Date.now()
    const updated = db.transaction((tx) => {
      const current = tx
        .select()
        .from(rateRules)
        .where(eq(rateRules.id, data.id))
        .limit(1)
        .get()
      if (!current)
        throw new AppError('RATE_RULE_NOT_FOUND', 'No se encontró la tarifa')
      let courtName: string | null = null
      if (data.courtId) {
        const court = tx
          .select({ id: courts.id, name: courts.name })
          .from(courts)
          .where(eq(courts.id, data.courtId))
          .limit(1)
          .get()
        if (!court)
          throw new AppError('COURT_NOT_FOUND', 'No se encontró la cancha')
        courtName = court.name
      }
      const next = {
        courtId: data.courtId,
        name: data.name,
        dayOfWeek: data.dayOfWeek,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        pricePerHourCents: data.pricePerHourCents,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo,
        isActive: data.isActive,
        updatedAt: now,
      }
      assertNoAmbiguousRateRule(
        tx.select().from(rateRules).all(),
        { ...current, ...next },
        data.id,
      )
      tx.update(rateRules).set(next).where(eq(rateRules.id, data.id)).run()
      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'rate_rule.updated',
          entityType: 'rate_rule',
          entityId: data.id,
          beforeJson: JSON.stringify(current),
          afterJson: JSON.stringify(next),
          createdAt: now,
          requestId: randomUUID(),
        })
        .run()
      return { rule: { ...current, ...next }, courtName }
    })
    return { rateRule: toSafeRateRule(updated.rule, updated.courtName) }
  })

export const quoteReservation = createServerFn({ method: 'GET' })
  .middleware([rateErrorMiddleware])
  .validator((data) => parseInput(quoteReservationSchema, data))
  .handler(async ({ data }) => {
    await requireSession()
    const court = await db
      .select({ id: courts.id })
      .from(courts)
      .where(eq(courts.id, data.courtId))
      .limit(1)
      .then((result) => result.at(0))
    if (!court)
      throw new AppError('COURT_NOT_FOUND', 'No se encontró la cancha')
    const rules = await db
      .select()
      .from(rateRules)
      .where(eq(rateRules.isActive, true))
    return {
      quote: calculateReservationQuote(
        rules.map(asCalculationRule),
        data.date,
        data.startsAt,
        data.endsAt,
        data.courtId,
      ),
    }
  })

export function calculateQuoteFromRules(
  rules: (typeof rateRules.$inferSelect)[],
  date: string,
  startsAt: string,
  endsAt: string,
  courtId: string,
) {
  return calculateReservationQuote(
    rules.map(asCalculationRule),
    date,
    startsAt,
    endsAt,
    courtId,
  )
}
