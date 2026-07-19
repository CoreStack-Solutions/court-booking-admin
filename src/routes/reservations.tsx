import { useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { CalendarDays, Plus, UserRound } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getCurrentUser } from '@/features/auth/auth'
import {
  listReservations,
  updateReservationStatus,
} from '@/features/reservations/reservations'
import type { SafeReservation } from '@/features/reservations/reservations.schema'

export const Route = createFileRoute('/reservations')({
  beforeLoad: async ({ location }) => {
    const current = await getCurrentUser()
    if (!current) {
      throw redirect({
        href: `/login?redirect=${encodeURIComponent(location.href)}`,
      })
    }
    return { user: current.user }
  },
  loader: async () => listReservations(),
  component: ReservationsPage,
})

const statusLabels: Record<SafeReservation['status'], string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No se presentó',
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(timestamp)
}

function ReservationsPage() {
  const { reservations: initialReservations } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const [reservations, setReservations] = useState(initialReservations)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function changeStatus(
    id: string,
    status: 'confirmed' | 'completed' | 'no_show' | 'cancelled',
    reason?: string,
  ) {
    setPendingId(id)
    setError(null)
    try {
      const result = await updateReservationStatus({
        data: {
          id,
          status,
          reason,
        },
      })
      setReservations((current) =>
        current.map((reservation) =>
          reservation.id === id ? result.reservation : reservation,
        ),
      )
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo actualizar la reserva',
      )
    } finally {
      setPendingId(null)
    }
  }

  return (
    <DashboardLayout user={user}>
      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Negocio Core · Operación
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <CalendarDays className="size-6 text-primary" aria-hidden />
            Reservas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta y administra las reservas registradas.
          </p>
        </div>
        {user.role !== 'viewer' && (
          <Link
            to="/reservations/new"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" aria-hidden />
            Nueva reserva
          </Link>
        )}
      </section>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {reservations.length === 0 ? (
        <Card className="py-16 text-center">
          <CardHeader>
            <CardTitle>No hay reservas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {user.role !== 'viewer' && (
              <Link
                to="/reservations/new"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
              >
                Crear la primera reserva
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-3" aria-label="Lista de reservas">
          {reservations.map((reservation) => (
            <Card key={reservation.id}>
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {reservation.customerName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {reservation.courtName} ·{' '}
                      {formatDateTime(reservation.startsAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Hasta {formatDateTime(reservation.endsAt)}
                      {reservation.customerPhone
                        ? ` · ${reservation.customerPhone}`
                        : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Badge
                    variant={
                      reservation.status === 'confirmed'
                        ? 'success'
                        : 'secondary'
                    }
                  >
                    {statusLabels[reservation.status]}
                  </Badge>
                  {user.role !== 'viewer' &&
                    reservation.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          disabled={pendingId === reservation.id}
                          onClick={() =>
                            void changeStatus(reservation.id, 'confirmed')
                          }
                        >
                          Confirmar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingId === reservation.id}
                          onClick={() => {
                            const reason = window.prompt(
                              'Motivo de cancelación',
                            )
                            if (reason?.trim())
                              void changeStatus(
                                reservation.id,
                                'cancelled',
                                reason,
                              )
                          }}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                  {user.role !== 'viewer' &&
                    reservation.status === 'confirmed' && (
                      <>
                        <Button
                          size="sm"
                          disabled={pendingId === reservation.id}
                          onClick={() =>
                            void changeStatus(reservation.id, 'completed')
                          }
                        >
                          Completar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingId === reservation.id}
                          onClick={() =>
                            void changeStatus(reservation.id, 'no_show')
                          }
                        >
                          No-show
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingId === reservation.id}
                          onClick={() => {
                            const reason = window.prompt(
                              'Motivo de cancelación',
                            )
                            if (reason?.trim())
                              void changeStatus(
                                reservation.id,
                                'cancelled',
                                reason,
                              )
                          }}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </DashboardLayout>
  )
}
