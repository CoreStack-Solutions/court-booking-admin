import { z } from 'zod'

import { paymentMethods } from './payments.constants'

export const recordReservationPaymentSchema = z.object({
  reservationId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  method: z.enum(paymentMethods),
  reference: z.string().trim().max(120).optional(),
  idempotencyKey: z.string().uuid(),
})

export type RecordReservationPaymentInput = z.infer<
  typeof recordReservationPaymentSchema
>
