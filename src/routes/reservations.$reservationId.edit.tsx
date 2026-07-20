import { useState } from 'react'
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCurrentUser } from '@/features/auth/auth'
import { listCourts } from '@/features/courts/courts'
import {
  getReservation,
  updateReservation,
} from '@/features/reservations/reservations'

export const Route = createFileRoute('/reservations/$reservationId/edit')({
  beforeLoad: async ({ location }) => {
    const current = await getCurrentUser()
    if (!current) {
      throw redirect({
        href: `/login?redirect=${encodeURIComponent(location.href)}`,
      })
    }
    if (current.user.role === 'viewer') {
      throw redirect({ to: '/reservations' })
    }
    return { user: current.user }
  },
  loader: async ({ params }) => {
    const [reservationResult, courtResult] = await Promise.all([
      getReservation({ data: { id: params.reservationId } }),
      listCourts(),
    ])
    return {
      reservation: reservationResult.reservation,
      courts: courtResult.courts,
    }
  },
  component: EditReservationPage,
})

function localDate(timestamp: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(timestamp)
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

function localTime(timestamp: number) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(timestamp)
}

function EditReservationPage() {
  const { reservation, courts } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()
  const [courtId, setCourtId] = useState(reservation.courtId)
  const [date, setDate] = useState(localDate(reservation.startsAt))
  const [startsAt, setStartsAt] = useState(localTime(reservation.startsAt))
  const [endsAt, setEndsAt] = useState(localTime(reservation.endsAt))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await updateReservation({
        data: {
          id: reservation.id,
          courtId,
          date,
          startsAt,
          endsAt,
        },
      })
      await navigate({
        to: '/reservations/$reservationId',
        params: { reservationId: reservation.id },
      })
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo actualizar la reserva',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout user={user}>
      <div className="mx-auto max-w-2xl">
        <Link
          to="/reservations/$reservationId"
          params={{ reservationId: reservation.id }}
          className="mb-4 inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al detalle
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Editar reserva</CardTitle>
            <CardDescription>
              Ajusta la cancha o la franja. El servidor volverá a validar la
              disponibilidad.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-5">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-2">
                <Label htmlFor="reservation-court">Cancha</Label>
                <select
                  id="reservation-court"
                  required
                  value={courtId}
                  onChange={(event) => setCourtId(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {courts
                    .filter(
                      (court) =>
                        court.status === 'active' ||
                        court.id === reservation.courtId,
                    )
                    .map((court) => (
                      <option key={court.id} value={court.id}>
                        {court.name}
                        {court.status === 'maintenance'
                          ? ' · Mantenimiento'
                          : ''}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="reservation-date">Fecha</Label>
                  <Input
                    id="reservation-date"
                    type="date"
                    required
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reservation-start">Inicio</Label>
                  <Input
                    id="reservation-start"
                    type="time"
                    step="1800"
                    required
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reservation-end">Fin</Label>
                  <Input
                    id="reservation-end"
                    type="time"
                    step="1800"
                    required
                    value={endsAt}
                    onChange={(event) => setEndsAt(event.target.value)}
                  />
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">Cliente</p>
                <p className="mt-1 text-muted-foreground">
                  {reservation.customerName}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  render={
                    <Link
                      to="/reservations/$reservationId"
                      params={{ reservationId: reservation.id }}
                    />
                  }
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Guardando…' : 'Guardar cambios'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
