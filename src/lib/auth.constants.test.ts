import { describe, expect, it } from 'vitest'

import { userRoles } from '@/lib/auth.constants'

describe('auth constants', () => {
  it('defines the fixed initial roles', () => {
    expect(userRoles).toEqual(['admin', 'operator', 'viewer'])
  })
})
