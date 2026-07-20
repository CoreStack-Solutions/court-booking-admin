import { describe, expect, it } from 'vitest'

import { hashPassword, verifyPassword } from '@/lib/password.server'

describe('password hashing', () => {
  it('verifies a password without storing it in plaintext', async () => {
    const password = 'correct horse battery staple'
    const hash = await hashPassword(password)

    expect(hash).not.toBe(password)
    await expect(verifyPassword(hash, password)).resolves.toBe(true)
    await expect(verifyPassword(hash, 'wrong password')).resolves.toBe(false)
  })
})
