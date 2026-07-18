import { z } from 'zod'

import { courtStatuses } from '@/lib/auth.constants'

export const courtStatusSchema = z.enum(courtStatuses)

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

export const createCourtSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(80),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido')
    .default('#22c55e'),
  status: courtStatusSchema.default('active'),
  sortOrder: z.number().int().min(0).default(0),
})

export const updateCourtSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80).optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido')
      .optional(),
    status: courtStatusSchema.optional(),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine(
    ({ name, color, status, sortOrder }) =>
      name !== undefined ||
      color !== undefined ||
      status !== undefined ||
      sortOrder !== undefined,
    { message: 'Debes indicar al menos un cambio' },
  )

const courtHourEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opensAt: z
    .string()
    .regex(timePattern, 'Hora inválida (HH:MM)')
    .default('07:00'),
  closesAt: z
    .string()
    .regex(timePattern, 'Hora inválida (HH:MM)')
    .default('22:00'),
  isClosed: z.boolean().default(false),
})

export const updateCourtHoursSchema = z.object({
  courtId: z.string().uuid(),
  hours: z
    .array(courtHourEntrySchema)
    .length(7, 'Debes enviar los 7 días de la semana'),
})

export const listAvailabilitySchema = z.object({
  courtId: z.string().uuid(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)'),
})

export type CreateCourtInput = z.infer<typeof createCourtSchema>
export type UpdateCourtInput = z.infer<typeof updateCourtSchema>
export type UpdateCourtHoursInput = z.infer<typeof updateCourtHoursSchema>
export type ListAvailabilityInput = z.infer<typeof listAvailabilitySchema>

export type SafeCourt = {
  id: string
  name: string
  color: string
  status: z.infer<typeof courtStatusSchema>
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export type CourtHourEntry = {
  id: string
  courtId: string
  dayOfWeek: number
  opensAt: string
  closesAt: string
  isClosed: boolean
}

export type AvailabilityBlock = {
  startsAt: string // HH:MM
  endsAt: string // HH:MM
  available: boolean
}
