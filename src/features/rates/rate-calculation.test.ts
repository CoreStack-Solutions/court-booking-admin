import { describe, expect, it } from 'vitest'

import { calculateReservationQuote } from './rate-calculation'

const courtId = '00000000-0000-4000-8000-000000000001'

describe('calculateReservationQuote', () => {
  it('prices each half-hour segment with the applicable rule', () => {
    const result = calculateReservationQuote(
      [
        {
          id: 'day',
          courtId: null,
          name: 'Día',
          dayOfWeek: null,
          startsAt: '07:00',
          endsAt: '18:00',
          pricePerHourCents: 6000,
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
        },
        {
          id: 'night',
          courtId: null,
          name: 'Noche',
          dayOfWeek: null,
          startsAt: '18:00',
          endsAt: '22:00',
          pricePerHourCents: 8000,
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
        },
      ],
      '2026-07-20',
      '17:30',
      '18:30',
      courtId,
    )

    expect(result.baseAmountCents).toBe(7000)
    expect(result.segments).toEqual([
      {
        startsAt: '17:30',
        endsAt: '18:00',
        ruleId: 'day',
        ruleName: 'Día',
        amountCents: 3000,
      },
      {
        startsAt: '18:00',
        endsAt: '18:30',
        ruleId: 'night',
        ruleName: 'Noche',
        amountCents: 4000,
      },
    ])
  })

  it('prefers a court-specific rule over a global rule', () => {
    const result = calculateReservationQuote(
      [
        {
          id: 'global',
          courtId: null,
          name: 'Global',
          dayOfWeek: null,
          startsAt: '07:00',
          endsAt: '22:00',
          pricePerHourCents: 6000,
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
        },
        {
          id: 'court',
          courtId,
          name: 'Cancha',
          dayOfWeek: null,
          startsAt: '07:00',
          endsAt: '22:00',
          pricePerHourCents: 9000,
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
        },
      ],
      '2026-07-20',
      '08:00',
      '09:00',
      courtId,
    )

    expect(result.finalAmountCents).toBe(9000)
    expect(result.segments.every((segment) => segment.ruleId === 'court')).toBe(
      true,
    )
  })

  it('fails when a segment has no applicable rate', () => {
    expect(() =>
      calculateReservationQuote([], '2026-07-20', '08:00', '09:00', courtId),
    ).toThrow('No existe una tarifa')
  })
})
