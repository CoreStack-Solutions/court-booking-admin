import { useEffect, useRef, useState } from 'react'
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { ArrowLeft, CalendarDays } from 'lucide-react'

import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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
import { Label } from '@/components/ui/label'
import { TimePicker } from '@/components/ui/time-picker'
import { getCurrentUser } from '@/features/auth/auth'
import { listCourts } from '@/features/courts/courts'
import { quoteReservation } from '@/features/rates/rates'
import { getErrorCode } from '@/lib/errors'
import {
  getReservation,
  updateReservation,
} from '@/features/reservations/reservations'

function localDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDatePE(dateStr: string) {
  if (!dateStr) return 'Seleccionar fecha'
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

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
  const originalDate = localDate(reservation.startsAt)
  const originalStartsAt = localTime(reservation.startsAt)
  const originalEndsAt = localTime(reservation.endsAt)
  const scheduleChanged =
    courtId !== reservation.courtId ||
    date !== originalDate ||
    startsAt !== originalStartsAt ||
    endsAt !== originalEndsAt
  const [quote, setQuote] = useState<{ finalAmountCents: number } | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoteRefresh, setQuoteRefresh] = useState(0)
  const quoteRequestId = useRef(0)

  useEffect(() => {
    const currentRequestId = ++quoteRequestId.current
    if (!scheduleChanged) {
      if (currentRequestId !== quoteRequestId.current) return
      setQuote({ finalAmountCents: reservation.finalAmountCents })
      setQuoteLoading(false)
      setQuoteError(null)
      return
    }
    setQuoteLoading(true)
    setQuoteError(null)
    void quoteReservation({ data: { courtId, date, startsAt, endsAt } }).then(
      (result) => {
        if (currentRequestId !== quoteRequestId.current) return
        setQuote(result.quote)
        setQuoteLoading(false)
        setQuoteError(null)
        setError(null)
      },
      (caughtError) => {
        if (currentRequestId !== quoteRequestId.current) return
        setQuote(null)
        setQuoteLoading(false)
        setQuoteError(
          caughtError instanceof Error
            ? caughtError.message
            : 'No hay una tarifa aplicable para esta franja',
        )
      },
    )
  }, [
    courtId,
    date,
    startsAt,
    endsAt,
    quoteRefresh,
    scheduleChanged,
    reservation,
  ])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!quote || quoteLoading) {
      setError('Espera a que exista una cotización válida antes de guardar')
      return
    }
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
          expectedFinalAmountCents: quote.finalAmountCents,
        },
      })
      await navigate({
        to: '/reservations/$reservationId',
        params: { reservationId: reservation.id },
      })
    } catch (caughtError) {
      if (getErrorCode(caughtError) === 'QUOTE_CHANGED') {
        setQuote(null)
        setQuoteError('La tarifa cambió. Actualizando la cotización…')
        setQuoteRefresh((current) => current + 1)
      }
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal h-10 gap-2">
                        <CalendarDays className="size-4 text-muted-foreground shrink-0" />
                        {formatDatePE(date)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date ? new Date(date + 'T12:00:00') : undefined}
                        onSelect={(val) => {
                          if (val) {
                            setDate(localDateValue(val))
                          }
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reservation-start">Inicio</Label>
                  <TimePicker
                    value={startsAt}
                    onChange={(val) => setStartsAt(val)}
                    label="Hora inicio"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reservation-end">Fin</Label>
                  <TimePicker
                    value={endsAt}
                    onChange={(val) => setEndsAt(val)}
                    label="Hora fin"
                  />
                </div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">Cliente</p>
                <p className="mt-1 text-muted-foreground">
                  {reservation.customerName}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Nueva cotización</p>
                    <p className="text-xs text-muted-foreground">
                      El importe se actualiza solo si cambia la franja.
                    </p>
                  </div>
                  <p className="text-lg font-semibold tabular-nums">
                    {quoteLoading
                      ? 'Calculando…'
                      : quote
                        ? formatMoney(quote.finalAmountCents)
                        : '—'}
                  </p>
                </div>
                {quoteError && (
                  <p className="mt-2 text-sm text-destructive">{quoteError}</p>
                )}
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
                <Button
                  type="submit"
                  disabled={loading || !quote || quoteLoading}
                >
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

function formatMoney(amountCents: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amountCents / 100)
}
