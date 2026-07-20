import { AppError } from '@/lib/errors'

export type RateRuleForCalculation = {
  id: string
  courtId: string | null
  name: string
  dayOfWeek: number | null
  startsAt: string
  endsAt: string
  pricePerHourCents: number
  effectiveFrom: string
  effectiveTo: string | null
}

export type QuoteSegment = {
  startsAt: string
  endsAt: string
  ruleId: string
  ruleName: string
  amountCents: number
}

export type ReservationQuote = {
  baseAmountCents: number
  discountAmountCents: number
  finalAmountCents: number
  segments: QuoteSegment[]
}

export function calculateReservationQuote(
  rules: RateRuleForCalculation[],
  date: string,
  startsAt: string,
  endsAt: string,
  courtId: string,
): ReservationQuote {
  const dayOfWeek = dayOfWeekForDate(date)
  const startMinutes = toMinutes(startsAt)
  const endMinutes = toMinutes(endsAt)
  const segments: QuoteSegment[] = []

  for (let current = startMinutes; current < endMinutes; current += 30) {
    const next = current + 30
    const matchingRules = rules
      .filter(
        (candidate) =>
          (candidate.courtId === courtId || candidate.courtId === null) &&
          (candidate.dayOfWeek === dayOfWeek || candidate.dayOfWeek === null) &&
          candidate.effectiveFrom <= date &&
          (!candidate.effectiveTo || candidate.effectiveTo >= date) &&
          toMinutes(candidate.startsAt) <= current &&
          toMinutes(candidate.endsAt) >= next,
      )
      .sort((left, right) => {
        const courtSpecificity =
          Number(right.courtId === courtId) - Number(left.courtId === courtId)
        if (courtSpecificity !== 0) return courtSpecificity
        const daySpecificity =
          Number(right.dayOfWeek === dayOfWeek) -
          Number(left.dayOfWeek === dayOfWeek)
        if (daySpecificity !== 0) return daySpecificity
        const effectiveDate = right.effectiveFrom.localeCompare(
          left.effectiveFrom,
        )
        if (effectiveDate !== 0) return effectiveDate
        return right.id.localeCompare(left.id)
      })
    const rule = matchingRules.at(0)

    if (!rule) {
      throw new AppError(
        'RATE_NOT_FOUND',
        'No existe una tarifa para todo el horario seleccionado',
        { date, startsAt, endsAt, segment: formatTime(current) },
      )
    }

    segments.push({
      startsAt: formatTime(current),
      endsAt: formatTime(next),
      ruleId: rule.id,
      ruleName: rule.name,
      amountCents: (rule.pricePerHourCents * 30) / 60,
    })
  }

  const baseAmountCents = segments.reduce(
    (total, segment) => total + segment.amountCents,
    0,
  )
  return {
    baseAmountCents,
    discountAmountCents: 0,
    finalAmountCents: baseAmountCents,
    segments,
  }
}

function dayOfWeekForDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}
