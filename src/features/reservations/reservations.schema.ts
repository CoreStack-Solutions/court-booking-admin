import { z } from 'zod'

import { reservationStatuses } from '@/lib/auth.constants'

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

export const customerSearchSchema = z.object({
  query: z.string().trim().max(80).default(''),
})

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(120),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
})

export const createReservationSchema = z
  .object({
    courtId: z.string().uuid(),
    customerId: z.string().uuid(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
      .refine((value) => {
        const parsed = new Date(`${value}T00:00:00Z`)
        return (
          !Number.isNaN(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value
        )
      }, 'Fecha inválida'),
    startsAt: z.string().regex(timePattern, 'Hora inválida'),
    endsAt: z.string().regex(timePattern, 'Hora inválida'),
    idempotencyKey: z.string().uuid(),
  })
  .superRefine((value, context) => {
    const startMinutes = toMinutes(value.startsAt)
    const endMinutes = toMinutes(value.endsAt)
    if (startMinutes % 30 !== 0 || endMinutes % 30 !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['startsAt'],
        message: 'Las horas deben alinearse a bloques de 30 minutos',
      })
    }
    if (endMinutes <= startMinutes) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'La hora de fin debe ser posterior al inicio',
      })
    }
  })

export const reservationStatusSchema = z.enum(reservationStatuses)

export const updateReservationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['confirmed', 'completed', 'no_show', 'cancelled']),
  reason: z.string().trim().max(500).optional(),
})

export const getReservationSchema = z.object({
  id: z.string().uuid(),
})

export const updateReservationSchema = z
  .object({
    id: z.string().uuid(),
    courtId: z.string().uuid(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
      .refine((value) => {
        const parsed = new Date(`${value}T00:00:00Z`)
        return (
          !Number.isNaN(parsed.getTime()) &&
          parsed.toISOString().slice(0, 10) === value
        )
      }, 'Fecha inválida'),
    startsAt: z.string().regex(timePattern, 'Hora inválida'),
    endsAt: z.string().regex(timePattern, 'Hora inválida'),
  })
  .superRefine((value, context) => {
    const startMinutes = toMinutes(value.startsAt)
    const endMinutes = toMinutes(value.endsAt)
    if (startMinutes % 30 !== 0 || endMinutes % 30 !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['startsAt'],
        message: 'Las horas deben alinearse a bloques de 30 minutos',
      })
    }
    if (endMinutes <= startMinutes) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'La hora de fin debe ser posterior al inicio',
      })
    }
  })

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type CreateReservationInput = z.infer<typeof createReservationSchema>
export type UpdateReservationStatusInput = z.infer<
  typeof updateReservationStatusSchema
>
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>

export type SafeCustomer = {
  id: string
  name: string
  phone: string | null
  notes: string | null
  isActive: boolean
}

export type SafeReservation = {
  id: string
  courtId: string
  courtName: string
  customerId: string
  customerName: string
  customerPhone: string | null
  startsAt: number
  endsAt: number
  status: z.infer<typeof reservationStatusSchema>
  createdAt: number
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}
