import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Package,
  Wallet,
} from 'lucide-react'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getCurrentUser } from '@/features/auth/auth'
import { getDashboardSummary } from '@/features/dashboard/dashboard'

const dateSearchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const Route = createFileRoute('/')({
  validateSearch: dateSearchSchema,
  beforeLoad: async ({ location }) => {
    const current = await getCurrentUser()
    if (!current) {
      throw redirect({
        href: `/login?redirect=${encodeURIComponent(location.href)}`,
      })
    }
    return { user: current.user }
  },
  loaderDeps: ({ search }) => ({ date: search.date }),
  loader: async ({ deps }) => {
    const date = deps.date ?? limaDateValue(new Date())
    const result = await getDashboardSummary({ data: { date } })
    return result.summary
  },
  component: Dashboard,
})

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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Lima',
  }).format(timestamp)
}

function formatMoney(amountCents: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amountCents / 100)
}

function Dashboard() {
  const summary = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()

  function setDate(date: string) {
    void navigate({ to: '/', search: { date } })
  }

  return (
    <DashboardLayout user={user}>
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Negocio Core · Operación en vivo
          </p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Resumen operativo
          </h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {formatDate(summary.date)} · Hora local de Lima
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label="Día anterior"
            onClick={() => setDate(shiftDate(summary.date, -1))}
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
            size="icon"
            variant="outline"
            aria-label="Día siguiente"
            onClick={() => setDate(shiftDate(summary.date, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
          <label className="sr-only" htmlFor="dashboard-date">
            Seleccionar fecha
          </label>
          <input
            id="dashboard-date"
            type="date"
            value={summary.date}
            onChange={(event) => {
              if (event.target.value) setDate(event.target.value)
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={CalendarDays}
          label="Reservas"
          value={String(summary.reservations.total)}
          note={`${summary.reservations.confirmed} confirmadas · ${summary.reservations.pending} pendientes · ${summary.reservations.completed} completadas`}
        />
        <SummaryCard
          icon={Clock3}
          label="Ocupación"
          value={`${summary.occupancy.percentage}%`}
          note={`${summary.occupancy.occupiedSlots} de ${summary.occupancy.totalSlots} bloques ocupados`}
        />
        <SummaryCard
          icon={Wallet}
          label="Ingresos"
          value="Pendiente"
          note="Disponible al implementar pagos"
          muted
        />
        <SummaryCard
          icon={Package}
          label="Inventario"
          value="Pendiente"
          note="Disponible al implementar quiosco"
          muted
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Próximas reservas</CardTitle>
            <CardDescription>
              Reservas pendientes y confirmadas para esta fecha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.upcoming.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No hay reservas próximas para esta fecha.
              </div>
            ) : (
              <div className="grid gap-3">
                {summary.upcoming.map((reservation) => (
                  <Link
                    key={reservation.id}
                    to="/reservations/$reservationId"
                    params={{ reservationId: reservation.id }}
                    className="grid gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 sm:grid-cols-[90px_1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-semibold tabular-nums">
                        {formatTime(reservation.startsAt)}
                      </p>
                      <p className="text-xs tabular-nums text-muted-foreground">
                        hasta {formatTime(reservation.endsAt)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {reservation.customerName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {reservation.courtName}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <Badge
                        variant={
                          reservation.status === 'confirmed'
                            ? 'success'
                            : 'secondary'
                        }
                      >
                        {reservation.status === 'confirmed'
                          ? 'Confirmada'
                          : 'Pendiente'}
                      </Badge>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatMoney(reservation.finalAmountCents)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="outline" render={<Link to="/calendar" />}>
                Ver calendario
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
            <CardDescription>
              Acciones registradas por la operación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {summary.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay actividad registrada.
              </p>
            ) : (
              <div className="divide-y">
                {summary.activity.map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium">{item.action}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.actorName ?? 'Sistema'} ·{' '}
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  note,
  muted = false,
}: {
  icon: typeof CalendarDays
  label: string
  value: string
  note: string
  muted?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
          {muted && <Badge variant="secondary">En preparación</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  )
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Lima',
  }).format(timestamp)
}
