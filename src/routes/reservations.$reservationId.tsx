import { useState } from 'react'
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Pencil,
  UserRound,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getCurrentUser } from '@/features/auth/auth'
import {
  getReservation,
  updateReservationStatus,
} from '@/features/reservations/reservations'
import type { SafeReservation } from '@/features/reservations/reservations.schema'

export const Route = createFileRoute('/reservations/$reservationId')({
  beforeLoad: async ({ location }) => {
    const current = await getCurrentUser()
    if (!current) {
      throw redirect({
        href: `/login?redirect=${encodeURIComponent(location.href)}`,
      })
    }
    return { user: current.user }
  },
  loader: async ({ params }) =>
    getReservation({ data: { id: params.reservationId } }),
  component: ReservationDetailRouteComponent,
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
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(timestamp)
}

function ReservationDetailRouteComponent() {
  const activeRouteId = useRouterState({
    select: (state) => state.matches.at(-1)?.routeId,
  })
  return activeRouteId === '/reservations/$reservationId' ? (
    <ReservationDetailPage />
  ) : (
    <Outlet />
  )
}

function ReservationDetailPage() {
  const { reservation } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canOperate = user.role !== 'viewer'

  async function changeStatus(
    status: 'confirmed' | 'completed' | 'no_show' | 'cancelled',
    cancellationReason?: string,
  ) {
    setPending(true)
    setError(null)
    try {
      await updateReservationStatus({
        data: { id: reservation.id, status, reason: cancellationReason },
      })
      setCancelOpen(false)
      await navigate({ to: '/reservations' })
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo actualizar la reserva',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <DashboardLayout user={user}>
      <div className="mx-auto max-w-3xl">
        <Link
          to="/reservations"
          className="mb-4 inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a reservas
        </Link>

        <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Negocio Core · Operación
            </p>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Detalle de reserva
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Consulta la franja y el estado actual de la operación.
            </p>
          </div>
          <Badge
            variant={
              reservation.status === 'confirmed' ? 'success' : 'secondary'
            }
          >
            {statusLabels[reservation.status]}
          </Badge>
        </section>

        {error && (
          <Alert variant="destructive" className="mb-5">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{reservation.customerName}</CardTitle>
            <CardDescription>
              {reservation.customerPhone ?? 'Sin teléfono registrado'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <CalendarDays
                className="mt-0.5 size-5 text-primary"
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium">Cancha</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {reservation.courtName}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-4">
              <Clock3 className="mt-0.5 size-5 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">Horario</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateTime(reservation.startsAt)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Hasta {formatDateTime(reservation.endsAt)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-4 sm:col-span-2">
              <UserRound className="mt-0.5 size-5 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">Registrada</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateTime(reservation.createdAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {canOperate && (
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {reservation.status === 'pending' && (
              <Button
                disabled={pending}
                onClick={() => void changeStatus('confirmed')}
              >
                Confirmar
              </Button>
            )}
            {reservation.status === 'confirmed' && (
              <>
                <Button
                  disabled={pending}
                  onClick={() => void changeStatus('completed')}
                >
                  Completar
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => void changeStatus('no_show')}
                >
                  No-show
                </Button>
              </>
            )}
            {(reservation.status === 'pending' ||
              reservation.status === 'confirmed') && (
              <>
                <Button
                  variant="outline"
                  disabled={pending}
                  render={
                    <Link
                      to="/reservations/$reservationId/edit"
                      params={{ reservationId: reservation.id }}
                    />
                  }
                >
                  <Pencil className="mr-2 size-4" aria-hidden />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setCancelOpen(true)}
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar reserva</DialogTitle>
            <DialogDescription>
              La reserva se conservará en el historial. Indica el motivo para
              continuar.
            </DialogDescription>
          </DialogHeader>
          <label
            htmlFor="reservation-detail-cancellation-reason"
            className="text-sm font-medium"
          >
            Motivo de cancelación
          </label>
          <textarea
            id="reservation-detail-cancellation-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo de cancelación"
            maxLength={500}
            rows={4}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setCancelOpen(false)}
            >
              Volver
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !reason.trim()}
              onClick={() => void changeStatus('cancelled', reason.trim())}
            >
              {pending ? 'Cancelando…' : 'Confirmar cancelación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
