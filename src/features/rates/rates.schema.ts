import { z } from 'zod'

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/

const validDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

const ruleFields = z
  .object({
    courtId: z.string().uuid().nullable().default(null),
    name: z.string().trim().min(1, 'El nombre es requerido').max(100),
    dayOfWeek: z.number().int().min(0).max(6).nullable().default(null),
    startsAt: z.string().regex(timePattern, 'Hora inválida'),
    endsAt: z.string().regex(timePattern, 'Hora inválida'),
    pricePerHourCents: z.number().int().positive(),
    effectiveFrom: z
      .string()
      .regex(datePattern, 'Fecha inválida')
      .refine(validDate, 'Fecha inválida'),
    effectiveTo: z
      .string()
      .regex(datePattern, 'Fecha inválida')
      .refine(validDate, 'Fecha inválida')
      .nullable()
      .default(null),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    const startsAt = toMinutes(value.startsAt)
    const endsAt = toMinutes(value.endsAt)
    if (startsAt % 30 !== 0 || endsAt % 30 !== 0 || endsAt <= startsAt) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'La regla debe usar un rango válido de bloques de 30 minutos',
      })
    }
    if (value.pricePerHourCents % 2 !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['pricePerHourCents'],
        message: 'El precio por hora debe expresarse en centavos pares',
      })
    }
    if (value.effectiveTo && value.effectiveTo < value.effectiveFrom) {
      context.addIssue({
        code: 'custom',
        path: ['effectiveTo'],
        message: 'La vigencia final no puede ser anterior a la inicial',
      })
    }
  })

export const createRateRuleSchema = ruleFields

export const updateRateRuleSchema = ruleFields.extend({ id: z.string().uuid() })

export const quoteReservationSchema = z
  .object({
    courtId: z.string().uuid(),
    date: z
      .string()
      .regex(datePattern, 'Fecha inválida')
      .refine(validDate, 'Fecha inválida'),
    startsAt: z.string().regex(timePattern, 'Hora inválida'),
    endsAt: z.string().regex(timePattern, 'Hora inválida'),
  })
  .superRefine((value, context) => {
    const startsAt = toMinutes(value.startsAt)
    const endsAt = toMinutes(value.endsAt)
    if (startsAt % 30 !== 0 || endsAt % 30 !== 0 || endsAt <= startsAt) {
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'La reserva debe usar bloques válidos de 30 minutos',
      })
    }
  })

export type CreateRateRuleInput = z.infer<typeof createRateRuleSchema>
export type UpdateRateRuleInput = z.infer<typeof updateRateRuleSchema>
export type QuoteReservationInput = z.infer<typeof quoteReservationSchema>

export type SafeRateRule = {
  id: string
  courtId: string | null
  courtName: string | null
  name: string
  dayOfWeek: number | null
  startsAt: string
  endsAt: string
  pricePerHourCents: number
  effectiveFrom: string
  effectiveTo: string | null
  isActive: boolean
  createdAt: number
  updatedAt: number
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}
