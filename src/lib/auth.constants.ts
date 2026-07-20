export const userRoles = ['admin', 'operator', 'viewer'] as const
export type UserRole = (typeof userRoles)[number]

export const courtStatuses = ['active', 'maintenance', 'inactive'] as const
export type CourtStatus = (typeof courtStatuses)[number]

export const daysOfWeek = [0, 1, 2, 3, 4, 5, 6] as const
export type DayOfWeek = (typeof daysOfWeek)[number]

export const reservationStatuses = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
] as const
export type ReservationStatus = (typeof reservationStatuses)[number]

export const reservationBlockingStatuses = ['pending', 'confirmed'] as const
