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
  TrendingUp,
  BarChart3,
  AlertTriangle,
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
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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

function localDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Seleccionar fecha">
                <CalendarDays className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={new Date(summary.date + 'T12:00:00')}
                onSelect={(val) => {
                  if (val) setDate(localDateValue(val))
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={CalendarDays}
          label="Reservas de Canchas"
          value={String(summary.reservations.total)}
          note={`${summary.reservations.confirmed} confirmadas · ${summary.reservations.pending} pendientes · ${summary.reservations.completed} completadas`}
        />
        <SummaryCard
          icon={Clock3}
          label="Ocupación Horaria"
          value={`${summary.occupancy.percentage}%`}
          note={`${summary.occupancy.occupiedSlots} de ${summary.occupancy.totalSlots} bloques reservados`}
        />
        <SummaryCard
          icon={Wallet}
          label="Ingresos Totales"
          value={
            summary.financials
              ? formatMoney(summary.financials.totalCents)
              : 'S/ 0.00'
          }
          note={
            summary.financials
              ? `Efe: ${formatMoney(summary.financials.byMethod.cashCents)} · Yap: ${formatMoney(summary.financials.byMethod.yapeCents)} · Pli: ${formatMoney(summary.financials.byMethod.plinCents)} · Tra: ${formatMoney(summary.financials.byMethod.bankTransferCents)}`
              : 'Sin cobros registrados'
          }
        />
        <SummaryCard
          icon={Package}
          label="Kiosco e Inventario"
          value={summary.kioskSales ? formatMoney(summary.kioskSales.totalCents) : 'S/ 0.00'}
          note={`${summary.kioskSales?.count ?? 0} ventas completadas · ${summary.lowStockProductsCount ?? 0} productos sin stock`}
          warning={(summary.lowStockProductsCount ?? 0) > 0}
        />
      </section>

      {/* SECCIÓN DE GRÁFICOS Y MÉTRICAS DETALLADAS */}
      <section className="mb-6 grid gap-6 md:grid-cols-2">
        {/* Gráfico 1: Análisis de Ocupación e Ingresos */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              Eficiencia Operativa e Ingresos
            </CardTitle>
            <CardDescription>
              Comparativa de ocupación física de canchas e ingresos monetarios por categoría.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-around p-6">
            {/* Ocupación Visual (Radial) */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative size-32">
                <svg className="size-full -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    className="stroke-muted fill-transparent"
                    strokeWidth="10"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="52"
                    className="stroke-primary fill-transparent transition-all duration-500"
                    strokeWidth="10"
                    strokeDasharray={2 * Math.PI * 52}
                    strokeDashoffset={2 * Math.PI * 52 * (1 - summary.occupancy.percentage / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-foreground tabular-nums">
                    {summary.occupancy.percentage}%
                  </span>
                  <span className="text-[0.65rem] font-medium text-muted-foreground uppercase">
                    Ocupado
                  </span>
                </div>
              </div>
              <p className="text-xs font-semibold text-muted-foreground text-center">
                Ocupación de Canchas
              </p>
            </div>

            {/* Categorías (Alquileres vs Kiosco) */}
            <div className="flex-1 max-w-[260px] space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2.5 rounded-full bg-primary" />
                    Alquiler de Canchas
                  </span>
                  <span className="font-bold">
                    {formatMoney(summary.financials?.byCategory?.rentalsCents ?? 0)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${
                        summary.financials?.totalCents
                          ? Math.round(
                              ((summary.financials.byCategory?.rentalsCents ?? 0) /
                                summary.financials.totalCents) *
                                100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2.5 rounded-full bg-emerald-500" />
                    Ventas del Kiosco
                  </span>
                  <span className="font-bold">
                    {formatMoney(summary.financials?.byCategory?.kioskCents ?? 0)}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-emerald-500"
                    style={{
                      width: `${
                        summary.financials?.totalCents
                          ? Math.round(
                              ((summary.financials.byCategory?.kioskCents ?? 0) /
                                summary.financials.totalCents) *
                                100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {summary.lowStockProductsCount && summary.lowStockProductsCount > 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-600 dark:text-amber-500 mt-2">
                  <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                  <span>
                    Hay <strong>{summary.lowStockProductsCount}</strong> productos con stock crítico en el Kiosco.
                  </span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Gráfico 2: Métodos de Pago Distribución */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              Distribución de Métodos de Pago
            </CardTitle>
            <CardDescription>
              Preferencia de pago y recaudación para el día de hoy.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex flex-col justify-center h-[160px] sm:h-full gap-4">
            {summary.financials && summary.financials.totalCents > 0 ? (() => {
              const total = summary.financials.totalCents
              const cash = summary.financials.byMethod.cashCents
              const yape = summary.financials.byMethod.yapeCents
              const plin = summary.financials.byMethod.plinCents
              const trans = summary.financials.byMethod.bankTransferCents

              const pCash = Math.round((cash / total) * 100)
              const pYape = Math.round((yape / total) * 100)
              const pPlin = Math.round((plin / total) * 100)
              const pTrans = 100 - pCash - pYape - pPlin

              return (
                <div className="space-y-4">
                  {/* Segmented bar chart */}
                  <div className="h-5 w-full rounded-md overflow-hidden flex bg-muted">
                    {cash > 0 && (
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${pCash}%` }}
                        title={`Efectivo: ${pCash}%`}
                      />
                    )}
                    {yape > 0 && (
                      <div
                        className="h-full bg-purple-500 transition-all"
                        style={{ width: `${pYape}%` }}
                        title={`Yape: ${pYape}%`}
                      />
                    )}
                    {plin > 0 && (
                      <div
                        className="h-full bg-cyan-500 transition-all"
                        style={{ width: `${pPlin}%` }}
                        title={`Plin: ${pPlin}%`}
                      />
                    )}
                    {trans > 0 && (
                      <div
                        className="h-full bg-amber-500 transition-all"
                        style={{ width: `${pTrans}%` }}
                        title={`Transferencia: ${pTrans}%`}
                      />
                    )}
                  </div>

                  {/* Legend Grid */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="flex flex-col border-l-2 border-emerald-500 pl-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Efectivo</span>
                      <span className="text-xs font-bold">{pCash}%</span>
                      <span className="text-[10px] text-muted-foreground">{formatMoney(cash)}</span>
                    </div>
                    <div className="flex flex-col border-l-2 border-purple-500 pl-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Yape</span>
                      <span className="text-xs font-bold">{pYape}%</span>
                      <span className="text-[10px] text-muted-foreground">{formatMoney(yape)}</span>
                    </div>
                    <div className="flex flex-col border-l-2 border-cyan-500 pl-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Plin</span>
                      <span className="text-xs font-bold">{pPlin}%</span>
                      <span className="text-[10px] text-muted-foreground">{formatMoney(plin)}</span>
                    </div>
                    <div className="flex flex-col border-l-2 border-amber-500 pl-2">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Transferencia</span>
                      <span className="text-xs font-bold">{pTrans}%</span>
                      <span className="text-[10px] text-muted-foreground">{formatMoney(trans)}</span>
                    </div>
                  </div>
                </div>
              )
            })() : (
              <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg bg-muted/10">
                No hay transacciones ni cobros registrados para hoy.
              </div>
            )}
          </CardContent>
        </Card>
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
  warning = false,
}: {
  icon: typeof CalendarDays
  label: string
  value: string
  note: string
  muted?: boolean
  warning?: boolean
}) {
  return (
    <Card className={cn(warning && "border-amber-500/35 bg-amber-500/5")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <span className={cn(
            "grid size-10 place-items-center rounded-full text-primary",
            warning ? "bg-amber-500/10 text-amber-500" : "bg-primary/10"
          )}>
            <Icon className="size-5" aria-hidden />
          </span>
          {muted && <Badge variant="secondary">En preparación</Badge>}
          {warning && (
            <Badge className="bg-amber-500 text-white hover:bg-amber-600 border-transparent text-[10px] py-0.5 px-1.5 font-bold">
              Stock Crítico
            </Badge>
          )}
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
