import { describe, expect, it } from 'vitest'

import { createUserSchema, loginSchema, updateUserSchema } from './auth.schema'

describe('auth input schemas', () => {
  it('normalizes email input', () => {
    expect(
      loginSchema.parse({ email: '  ADMIN@Example.COM ', password: 'secret' }),
    ).toEqual({ email: 'admin@example.com', password: 'secret' })
  })

  it('requires a password for new users', () => {
    expect(() =>
      createUserSchema.parse({
        name: 'Operator',
        email: 'operator@example.com',
        password: 'short',
        role: 'operator',
      }),
    ).toThrow()
  })

  it('requires an actual change when updating a user', () => {
    expect(() => updateUserSchema.parse({ id: crypto.randomUUID() })).toThrow()
  })
})
