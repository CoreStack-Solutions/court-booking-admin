import { z } from 'zod'

export const dashboardDateSchema = z.object({
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
})

export type DashboardSummary = {
  date: string
  reservations: {
    total: number
    pending: number
    confirmed: number
    completed: number
  }
  occupancy: {
    occupiedSlots: number
    totalSlots: number
    percentage: number
  }
  upcoming: Array<{
    id: string
    startsAt: number
    endsAt: number
    customerName: string
    courtName: string
    status: 'pending' | 'confirmed'
    finalAmountCents: number
  }>
  activity: Array<{
    id: string
    action: string
    detail: string
    createdAt: number
    actorName: string | null
  }>
  financialsAvailable: boolean
  financials?: {
    totalCents: number
    byMethod: {
      cashCents: number
      yapeCents: number
      plinCents: number
      bankTransferCents: number
    }
  }
  inventoryAvailable: boolean
}
