import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RefreshCw,
  Lock,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getCurrentUser } from '@/features/auth/auth'
import { listAvailability, listCourts } from '@/features/courts/courts'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
  const hourLabels = Array.from(
    new Set(allBlocks.map((block) => block.startsAt.split(':')[0] + ':00')),
  )
  hourLabels.sort()
  const showTableSemantics = !loading && hourLabels.length > 0

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
          <p className="mt-1 text-sm text-muted-foreground">
            Monitorea la disponibilidad de las canchas y gestiona reservas activas en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDate(shiftDate(date, -1))}
            aria-label="Día anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-semibold tracking-tight">
            {formatDate(date)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setDate(shiftDate(date, 1))}
            aria-label="Siguiente día"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDate(today)}
            disabled={date === today}
            className="text-xs font-semibold"
          >
            Hoy
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Seleccionar fecha específica">
                <CalendarDays className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={new Date(date + 'T12:00:00')}
                onSelect={(val) => {
                  if (val) {
                    setDate(localDateValue(val))
                  }
                }}
              />
            </PopoverContent>
          </Popover>
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
          · Bloques de 1 hora (y fracciones)
        </span>
      </div>

      {/* Selector de cancha para móviles */}
      <div className="mb-4 flex gap-1 overflow-x-auto pb-1 lg:hidden">
        <Button
          variant={selectedCourtId === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCourtId('all')}
        >
          Todas las canchas
        </Button>
        {visibleCourts.map((court) => (
          <Button
            key={court.id}
            variant={selectedCourtId === court.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCourtId(court.id)}
            className="flex items-center gap-2 shrink-0"
          >
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: court.color }}
            />
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
                ) : hourLabels.length === 0 ? (
                  <div className="flex min-h-64 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                    <Clock3 className="size-5" aria-hidden />
                    No hay horario configurado para esta fecha.
                  </div>
                ) : (
                  hourLabels.map((time) => (
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

                        const hourPart = time.split(':')[0]
                        const timeA = `${hourPart}:00`
                        const timeB = `${hourPart}:30`
                        const nextHourTime = `${String(Number(hourPart) + 1).padStart(2, '0')}:00`

                        const blockA = result?.blocks.find((item) => item.startsAt === timeA)
                        const blockB = result?.blocks.find((item) => item.startsAt === timeB)

                        const isPastA = blockA ? new Date(`${date}T${blockA.startsAt}:00-05:00`).getTime() <= Date.now() : true
                        const isPastB = blockB ? new Date(`${date}T${blockB.startsAt}:00-05:00`).getTime() <= Date.now() : true

                        const canMerge = (() => {
                          if (!blockA && !blockB) return true
                          if (!blockA || !blockB) return false
                          if (blockA.reservationId && blockA.reservationId === blockB.reservationId) return true
                          if (blockA.available && !isPastA && blockB.available && !isPastB) return true
                          if (!blockA.reservationId && isPastA && !blockB.reservationId && isPastB) return true
                          if (!blockA.reservationId && !blockA.available && !isPastA &&
                              !blockB.reservationId && !blockB.available && !isPastB) return true
                          return false
                        })()

                        const renderSingleBlock = (
                          block: typeof blockA,
                          startsAt: string,
                          endsAt: string,
                          isPast: boolean,
                        ) => {
                          if (!block) {
                            return (
                              <div
                                aria-label={`${court.name}, ${startsAt}: No disponible`}
                                className="flex h-full flex-1 items-center justify-center gap-1 rounded-lg border border-border/80 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(100,100,100,0.03)_6px,rgba(100,100,100,0.03)_12px)] bg-muted/40 text-[0.68rem] text-muted-foreground/45 font-semibold select-none cursor-not-allowed py-1"
                              >
                                <Lock className="size-3 text-muted-foreground/40" />
                                Cerrado
                              </div>
                            )
                          }

                          if (block.reservationId) {
                            return (
                              <Link
                                to="/reservations/$reservationId"
                                params={{ reservationId: block.reservationId }}
                                aria-label={`${court.name}, ${startsAt}-${endsAt}: Reserva de ${block.reservationCustomerName ?? 'cliente'}`}
                                className="flex h-full flex-1 flex-col items-center justify-center rounded-lg border px-2 py-0.5 text-center transition-all hover:brightness-95 hover:shadow-sm"
                                style={{
                                  backgroundColor: `${court.color}15`,
                                  borderColor: `${court.color}35`,
                                  color: court.color,
                                }}
                              >
                                <span className="font-bold text-[0.7rem] tracking-wide uppercase">Reservada</span>
                                {block.reservationCustomerName && (
                                  <span className="max-w-full truncate text-[0.65rem] font-normal opacity-90 leading-none mt-0.5">
                                    {block.reservationCustomerName}
                                  </span>
                                )}
                              </Link>
                            )
                          }

                          if (block.available && !isPast) {
                            if (user.role === 'viewer') {
                              return (
                                <div
                                  aria-label={`${court.name}, ${startsAt}: Disponible`}
                                  className="flex h-full flex-1 items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 bg-transparent text-[0.7rem] font-medium text-muted-foreground/40 py-1"
                                >
                                  Disponible
                                </div>
                              )
                            }

                            return (
                              <Link
                                to="/reservations/new"
                                search={{
                                  courtId: court.id,
                                  date,
                                  startsAt,
                                  endsAt,
                                }}
                                aria-label={`${court.name}, ${startsAt}-${endsAt}: Disponible. Crear reserva`}
                                className="group flex h-full flex-1 items-center justify-center rounded-lg border border-dashed border-muted-foreground/20 bg-transparent text-[0.7rem] font-medium text-muted-foreground/40 hover:text-green-600 hover:bg-green-500/10 hover:border-solid hover:border-green-500/30 transition-all cursor-pointer py-1"
                              >
                                <span className="hidden group-hover:inline font-bold">+ Reservar</span>
                                <span className="inline group-hover:hidden font-normal">Disponible</span>
                              </Link>
                            )
                          }

                          if (isPast) {
                            return (
                              <div
                                aria-label={`${court.name}, ${startsAt}: Pasado`}
                                className="flex h-full flex-1 items-center justify-center rounded-lg border border-border/50 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(100,100,100,0.02)_6px,rgba(100,100,100,0.02)_12px)] bg-muted/20 text-[0.68rem] text-muted-foreground/30 font-medium select-none cursor-not-allowed py-1"
                              >
                                Expirado
                              </div>
                            )
                          }

                          return (
                            <div
                              aria-label={`${court.name}, ${startsAt}: No disponible`}
                              className="flex h-full flex-1 items-center justify-center gap-1 rounded-lg border border-border/80 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(100,100,100,0.03)_6px,rgba(100,100,100,0.03)_12px)] bg-muted/40 text-[0.68rem] text-muted-foreground/45 font-semibold select-none cursor-not-allowed py-1"
                            >
                              <Lock className="size-3 text-muted-foreground/40" />
                              Cerrado
                            </div>
                          )
                        }

                        return (
                          <div
                            role={showTableSemantics ? 'cell' : undefined}
                            key={court.id}
                            className="border-r p-2 last:border-r-0 flex flex-col gap-1 min-h-[3.75rem] justify-stretch h-full"
                          >
                            {canMerge ? (
                              renderSingleBlock(blockA ?? blockB, timeA, nextHourTime, isPastA && isPastB)
                            ) : (
                              <>
                                {renderSingleBlock(blockA, timeA, timeB, isPastA)}
                                {renderSingleBlock(blockB, timeB, nextHourTime, isPastB)}
                              </>
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
