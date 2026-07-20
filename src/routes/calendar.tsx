import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getCurrentUser } from '@/features/auth/auth'
import { listAvailability, listCourts } from '@/features/courts/courts'
import type {
  AvailabilityBlock,
  SafeCourt,
} from '@/features/courts/courts.schema'

export const Route = createFileRoute('/calendar')({
  beforeLoad: async ({ location }) => {
    const current = await getCurrentUser()
    if (!current) {
      throw redirect({
        href: `/login?redirect=${encodeURIComponent(location.href)}`,
      })
    }
    return { user: current.user }
  },
  loader: async () => {
    const result = await listCourts()
    return { courts: result.courts, today: limaDateValue(new Date()) }
  },
  component: CalendarPage,
})

type CourtAvailability = {
  court: SafeCourt
  blocks: AvailabilityBlock[]
}

function localDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function limaDateValue(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return localDateValue(date)
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function CalendarPage() {
  const { courts, today } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const [date, setDate] = useState(today)
  const [availability, setAvailability] = useState<CourtAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCourtId, setSelectedCourtId] = useState<string>('all')
  const requestId = useRef(0)

  async function loadAvailability(selectedDate: string) {
    const currentRequestId = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(
        courts.map((court) =>
          listAvailability({ data: { courtId: court.id, date: selectedDate } }),
        ),
      )
      if (currentRequestId !== requestId.current) return
      setAvailability(results)
    } catch (caughtError) {
      if (currentRequestId !== requestId.current) return
      setAvailability([])
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo cargar la disponibilidad',
      )
    } finally {
      if (currentRequestId === requestId.current) setLoading(false)
    }
  }

  useEffect(() => {
    void loadAvailability(date)
  }, [date])

  const visibleCourts = courts.filter((court) => court.status !== 'inactive')
  const allBlocks = availability.flatMap((item) => item.blocks)
  const timeLabels = Array.from(
    new Set(allBlocks.map((block) => block.startsAt)),
  )
  timeLabels.sort()
  const showTableSemantics = !loading && timeLabels.length > 0

  return (
    <DashboardLayout user={user}>
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Negocio Core · Operación
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <CalendarDays className="size-6 text-primary" aria-hidden />
            Calendario
          </h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {formatDate(date)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Día anterior"
            onClick={() => setDate((current) => shiftDate(current, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            onClick={() => setDate(limaDateValue(new Date()))}
          >
            Hoy
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Día siguiente"
            onClick={() => setDate((current) => shiftDate(current, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
          <label className="sr-only" htmlFor="calendar-date">
            Seleccionar fecha
          </label>
          <input
            id="calendar-date"
            type="date"
            value={date}
            onChange={(event) => {
              if (event.target.value) setDate(event.target.value)
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      </section>

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Badge variant="success" className="bg-transparent border border-dashed border-muted-foreground/30 text-muted-foreground font-normal">Disponible</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary font-normal">Reservado</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Badge variant="secondary" className="bg-muted text-muted-foreground/60 border-transparent font-normal">No disponible / Pasado</Badge>
        </div>
        <span className="hidden sm:inline text-muted-foreground/60">
          · Bloques de 30 minutos
        </span>
      </div>

      {/* Selector de cancha para móviles */}
      <div className="mb-4 flex gap-1 overflow-x-auto pb-1 lg:hidden">
        <Button
          variant={selectedCourtId === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCourtId('all')}
        >
          Todas
        </Button>
        {visibleCourts.map((court) => (
          <Button
            key={court.id}
            variant={selectedCourtId === court.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCourtId(court.id)}
            style={{
              borderColor: selectedCourtId === court.id ? undefined : court.color,
              color: selectedCourtId === court.id ? undefined : court.color,
            }}
          >
            {court.name}
          </Button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadAvailability(date)}
            >
              <RefreshCw className="mr-2 size-4" aria-hidden />
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!loading && !error && visibleCourts.length === 0 && (
        <Card className="py-16 text-center">
          <CardHeader>
            <CardTitle>No hay canchas operativas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Activa una cancha para verla aquí.
          </CardContent>
        </Card>
      )}

      {!error && visibleCourts.length > 0 && (() => {
        const courtsToRender = selectedCourtId === 'all'
          ? visibleCourts
          : visibleCourts.filter(c => c.id === selectedCourtId)

        return (
          <Card className="overflow-hidden shadow-sm">
            <CardContent className="overflow-x-auto p-0">
              <div
                className="min-w-[720px] lg:min-w-0"
                role={showTableSemantics ? 'table' : undefined}
                aria-label={
                  showTableSemantics ? 'Disponibilidad de canchas' : undefined
                }
              >
                <div
                  role={showTableSemantics ? 'row' : undefined}
                  className="grid grid-cols-[5.5rem_repeat(var(--court-count),minmax(10rem,1fr))] border-b bg-muted/20"
                  style={
                    {
                      '--court-count': courtsToRender.length,
                    } as React.CSSProperties
                  }
                >
                  <div
                    role={showTableSemantics ? 'columnheader' : undefined}
                    className="border-r p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground/75 flex items-center justify-center bg-muted/10"
                  >
                    Hora
                  </div>
                  {courtsToRender.map((court) => (
                    <div
                      role={showTableSemantics ? 'columnheader' : undefined}
                      key={court.id}
                      className="border-r p-3 last:border-r-0 flex flex-col justify-center"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: court.color }}
                        />
                        <p className="font-semibold text-sm">{court.name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 pl-4">
                        {court.status === 'maintenance'
                          ? 'Mantenimiento'
                          : 'Operativa'}
                      </p>
                    </div>
                  ))}
                </div>

                {loading ? (
                  <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="size-4 animate-spin" aria-hidden />
                    Cargando disponibilidad…
                  </div>
                ) : timeLabels.length === 0 ? (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                    <Clock3 className="size-5" aria-hidden />
                    No hay horario configurado para esta fecha.
                  </div>
                ) : (
                  timeLabels.map((time) => (
                    <div
                      role={showTableSemantics ? 'row' : undefined}
                      key={time}
                      className="grid grid-cols-[5.5rem_repeat(var(--court-count),minmax(10rem,1fr))] border-b last:border-b-0 hover:bg-muted/5 transition-colors"
                      style={
                        {
                          '--court-count': courtsToRender.length,
                        } as React.CSSProperties
                      }
                    >
                      <div
                        role={showTableSemantics ? 'rowheader' : undefined}
                        className="border-r p-3 text-sm font-semibold text-muted-foreground/80 flex items-center justify-center bg-muted/5"
                      >
                        {time}
                      </div>
                      {courtsToRender.map((court) => {
                        const result = availability.find(
                          (item) => item.court.id === court.id,
                        )
                        const block = result?.blocks.find(
                          (item) => item.startsAt === time,
                        )
                        const available = block?.available ?? false
                        const blockStart = new Date(
                          `${date}T${time}:00-05:00`,
                        ).getTime()
                        const isPast = blockStart <= Date.now()
                        return (
                          <div
                            role={showTableSemantics ? 'cell' : undefined}
                            key={court.id}
                            className="border-r p-2 last:border-r-0"
                          >
                            {block?.reservationId ? (
                              <Link
                                to="/reservations/$reservationId"
                                params={{ reservationId: block.reservationId }}
                                aria-label={`${court.name}, ${time}: Reserva de ${block.reservationCustomerName ?? 'cliente'}`}
                                className="flex min-h-[3.25rem] flex-col items-center justify-center rounded-lg border px-2 py-1 text-center transition-all hover:brightness-95 hover:shadow-sm"
                                style={{
                                  backgroundColor: `${court.color}15`,
                                  borderColor: `${court.color}35`,
                                  color: court.color,
                                }}
                              >
                                <span className="font-bold text-[0.72rem] tracking-wide uppercase">Reservada</span>
                                {block.reservationCustomerName && (
                                  <span className="max-w-full truncate text-[0.68rem] font-normal opacity-90">
                                    {block.reservationCustomerName}
                                  </span>
                                )}
                              </Link>
                            ) : available && !isPast ? (
                              user.role === 'viewer' ? (
                                <div
                                  aria-label={`${court.name}, ${time}: Disponible`}
                                  className="flex min-h-[3.25rem] items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 bg-transparent text-[0.72rem] font-medium text-muted-foreground/40"
                                >
                                  Disponible
                                </div>
                              ) : (
                                <Link
                                  to="/reservations/new"
                                  search={{
                                    courtId: court.id,
                                    date,
                                    startsAt: time,
                                    endsAt: block?.endsAt ?? time,
                                  }}
                                  aria-label={`${court.name}, ${time}: Disponible. Crear reserva`}
                                  className="group flex min-h-[3.25rem] items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 bg-transparent text-[0.72rem] font-medium text-muted-foreground/40 hover:text-green-600 hover:bg-green-500/10 hover:border-solid hover:border-green-500/30 transition-all cursor-pointer"
                                >
                                  <span className="hidden group-hover:inline font-bold">+ Reservar</span>
                                  <span className="inline group-hover:hidden font-normal">Disponible</span>
                                </Link>
                              )
                            ) : (
                              <div
                                aria-label={`${court.name}, ${time}: ${isPast ? 'Pasado' : 'No disponible'}`}
                                className="flex min-h-[3.25rem] items-center justify-center rounded-lg border border-border bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(100,100,100,0.03)_6px,rgba(100,100,100,0.03)_12px)] bg-muted/40 text-[0.7rem] text-muted-foreground/40 select-none cursor-not-allowed"
                              >
                                {isPast ? 'Pasado' : 'No disponible'}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )
      })()}
    </DashboardLayout>
  )
}
