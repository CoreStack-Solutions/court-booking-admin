import { z } from 'zod'

import { userRoles } from '@/lib/auth.constants'

export const userRoleSchema = z.enum(userRoles)

const passwordSchema = z
  .string()
  .min(12, 'La contraseña debe tener al menos 12 caracteres')
  .max(256, 'La contraseña es demasiado larga')

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(256),
})

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: passwordSchema,
  role: userRoleSchema,
})

export const updateUserSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(120).optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .refine(
    ({ name, role, isActive, password }) =>
      name !== undefined ||
      role !== undefined ||
      isActive !== undefined ||
      password !== undefined,
    { message: 'Debes indicar al menos un cambio' },
  )

export type SafeUser = {
  id: string
  name: string
  email: string
  role: z.infer<typeof userRoleSchema>
  isActive: boolean
}
