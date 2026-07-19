import { useEffect, useRef, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
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

      <div className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="success">Disponible</Badge>
        <Badge variant="secondary">No disponible</Badge>
        <span className="ml-1">
          Las franjas se muestran en bloques de 30 minutos.
        </span>
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

      {!error && visibleCourts.length > 0 && (
        <Card className="overflow-hidden">
          <CardContent className="overflow-x-auto p-0">
            <div
              className="min-w-[720px]"
              role={showTableSemantics ? 'table' : undefined}
              aria-label={
                showTableSemantics ? 'Disponibilidad de canchas' : undefined
              }
            >
              <div
                role={showTableSemantics ? 'row' : undefined}
                className="grid grid-cols-[5.5rem_repeat(var(--court-count),minmax(10rem,1fr))] border-b bg-muted/30"
                style={
                  {
                    '--court-count': visibleCourts.length,
                  } as React.CSSProperties
                }
              >
                <div
                  role={showTableSemantics ? 'columnheader' : undefined}
                  className="border-r p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Hora
                </div>
                {visibleCourts.map((court) => (
                  <div
                    role={showTableSemantics ? 'columnheader' : undefined}
                    key={court.id}
                    className="border-r p-3 last:border-r-0"
                  >
                    <p className="font-semibold">{court.name}</p>
                    <p className="text-xs text-muted-foreground">
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
                    className="grid grid-cols-[5.5rem_repeat(var(--court-count),minmax(10rem,1fr))] border-b last:border-b-0"
                    style={
                      {
                        '--court-count': visibleCourts.length,
                      } as React.CSSProperties
                    }
                  >
                    <div
                      role={showTableSemantics ? 'rowheader' : undefined}
                      className="border-r p-3 text-sm font-medium text-muted-foreground"
                    >
                      {time}
                    </div>
                    {visibleCourts.map((court) => {
                      const result = availability.find(
                        (item) => item.court.id === court.id,
                      )
                      const block = result?.blocks.find(
                        (item) => item.startsAt === time,
                      )
                      const available = block?.available ?? false
                      return (
                        <div
                          role={showTableSemantics ? 'cell' : undefined}
                          key={court.id}
                          className="border-r p-2 last:border-r-0"
                        >
                          <div
                            aria-label={`${court.name}, ${time}: ${available ? 'Disponible' : 'No disponible'}`}
                            className={
                              available
                                ? 'flex min-h-12 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-xs font-medium text-primary'
                                : 'flex min-h-12 items-center justify-center rounded-md border border-border bg-muted/50 text-xs text-muted-foreground'
                            }
                          >
                            {available ? 'Disponible' : 'No disponible'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  )
}
