import { redirect } from '@tanstack/react-router'

import { getCurrentUser } from '@/features/auth/auth.server'

export async function requireAuthenticatedRoute(location: { href: string }) {
  const current = await getCurrentUser()
  if (!current) {
    throw redirect({
      href: `/login?redirect=${encodeURIComponent(location.href)}`,
    })
  }
  return current.user
}
