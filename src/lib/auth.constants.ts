export const userRoles = ['admin', 'operator', 'viewer'] as const
export type UserRole = (typeof userRoles)[number]
