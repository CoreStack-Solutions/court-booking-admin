import { describe, expect, it } from 'vitest'

import {
  createReservationSchema,
  updateReservationSchema,
} from './reservations.schema'

const validReservation = {
  courtId: '00000000-0000-4000-8000-000000000001',
  customerId: '00000000-0000-4000-8000-000000000002',
  date: '2026-07-19',
  startsAt: '08:00',
  endsAt: '09:30',
  idempotencyKey: '00000000-0000-4000-8000-000000000003',
}

describe('createReservationSchema', () => {
  it('accepts aligned valid input', () => {
    expect(createReservationSchema.safeParse(validReservation).success).toBe(
      true,
    )
  })

  it('rejects impossible dates and unaligned times', () => {
    expect(
      createReservationSchema.safeParse({
        ...validReservation,
        date: '2026-02-31',
        startsAt: '08:15',
      }).success,
    ).toBe(false)
  })

  it('requires an idempotency key', () => {
    const { idempotencyKey: _idempotencyKey, ...withoutKey } = validReservation
    expect(createReservationSchema.safeParse(withoutKey).success).toBe(false)
  })
})

describe('updateReservationSchema', () => {
  it('accepts a valid reschedule payload', () => {
    expect(
      updateReservationSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000004',
        courtId: validReservation.courtId,
        date: validReservation.date,
        startsAt: '10:00',
        endsAt: '11:30',
      }).success,
    ).toBe(true)
  })

  it('rejects a reschedule that crosses midnight or uses unaligned blocks', () => {
    expect(
      updateReservationSchema.safeParse({
        id: '00000000-0000-4000-8000-000000000004',
        courtId: validReservation.courtId,
        date: validReservation.date,
        startsAt: '23:30',
        endsAt: '00:30',
      }).success,
    ).toBe(false)
  })
})
