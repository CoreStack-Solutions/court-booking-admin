import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Package,
  Store,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { getCurrentUser } from '@/features/auth/auth'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ location }) => {
    const current = await getCurrentUser()
    if (!current) {
      throw redirect({
        href: `/login?redirect=${encodeURIComponent(location.href)}`,
      })
    }
    return { user: current.user }
  },
  component: Dashboard,
})



const dates = [
  { eyebrow: 'Ayer', day: 'Jueves, 16 de julio', reservations: '9' },
  { eyebrow: 'Hoy', day: 'Viernes, 17 de julio', reservations: '12' },
  { eyebrow: 'Mañana', day: 'Sábado, 18 de julio', reservations: '16' },
]

const stats = [
  {
    label: 'Ingresos de hoy',
    value: 'S/ 1,840.00',
    note: '+12.5% vs. ayer',
    icon: Wallet,
    tone: 'bg-primary text-primary-foreground',
  },
  {
    label: 'Reservas',
    value: '12',
    note: '8 confirmadas · 4 pendientes',
    icon: CalendarDays,
    tone: 'bg-chart-2 text-primary-foreground',
  },
  {
    label: 'Ocupación',
    value: '72%',
    note: '18 de 25 horas disponibles',
    icon: Clock,
    tone: 'bg-chart-3 text-primary-foreground',
  },
  {
    label: 'Ventas quiosco',
    value: 'S/ 396.00',
    note: '24 operaciones',
    icon: Store,
    tone: 'bg-chart-4 text-primary-foreground',
  },
]

const reservations = [
  {
    time: '08:00',
    end: '09:30',
    customer: 'Carlos Mendoza',
    court: 'Cancha 1',
    status: 'Confirmada',
    amount: 'S/ 90.00',
  },
  {
    time: '09:30',
    end: '11:00',
    customer: 'María Torres',
    court: 'Cancha 3',
    status: 'Pendiente',
    amount: 'S/ 90.00',
  },
  {
    time: '11:00',
    end: '12:00',
    customer: 'Diego Salazar',
    court: 'Cancha 2',
    status: 'Confirmada',
    amount: 'S/ 60.00',
  },
  {
    time: '14:00',
    end: '15:30',
    customer: 'Lucía Vega',
    court: 'Cancha 4',
    status: 'Confirmada',
    amount: 'S/ 105.00',
  },
]

const paymentMethods = [
  { label: 'Efectivo', amount: 'S/ 820', width: '72%', color: 'bg-chart-2' },
  { label: 'Yape', amount: 'S/ 540', width: '48%', color: 'bg-chart-3' },
  { label: 'Plin', amount: 'S/ 310', width: '28%', color: 'bg-chart-4' },
  {
    label: 'Transferencia',
    amount: 'S/ 170',
    width: '16%',
    color: 'bg-chart-5',
  },
]

const stockAlerts = [
  { name: 'Agua San Luis 625 ml', stock: '4 unidades', threshold: 'Mín. 10' },
  { name: 'Gatorade 500 ml', stock: '3 unidades', threshold: 'Mín. 8' },
  { name: 'Pelotas Penn x3', stock: '1 unidad', threshold: 'Mín. 4' },
]

const activity = [
  {
    title: 'Pago de reserva registrado',
    detail: 'Carlos Mendoza · S/ 90.00 · Yape',
    time: 'Hace 8 min',
    icon: CheckCircle2,
  },
  {
    title: 'Venta de quiosco',
    detail: '3 productos · S/ 24.00 · Efectivo',
    time: 'Hace 21 min',
    icon: Store,
  },
  {
    title: 'Nueva reserva creada',
    detail: 'Lucía Vega · Cancha 4 · 14:00',
    time: 'Hace 36 min',
    icon: CalendarDays,
  },
]

function Dashboard() {
  const user = Route.useRouteContext().user
  const [dateIndex, setDateIndex] = useState(1)
  const date = dates[dateIndex]

  return (
    <DashboardLayout user={user}>

          <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                {date.eyebrow} · Operación en vivo
              </p>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Todo bajo control
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {date.day} · Hora local de Lima
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() =>
                  setDateIndex((current) => Math.max(0, current - 1))
                }
                disabled={dateIndex === 0}
                aria-label="Día anterior"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" />}>
                  <CalendarDays aria-hidden="true" />
                  {date.day.split(',')[0]}
                  <ChevronDown aria-hidden="true" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {dates.map((option, index) => (
                    <DropdownMenuItem
                      key={option.day}
                      onClick={() => setDateIndex(index)}
                    >
                      {option.eyebrow}: {option.day}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="icon"
                variant="outline"
                onClick={() =>
                  setDateIndex((current) =>
                    Math.min(dates.length - 1, current + 1),
                  )
                }
                disabled={dateIndex === dates.length - 1}
                aria-label="Día siguiente"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </section>

          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        'grid size-10 place-items-center rounded-full',
                        stat.tone,
                      )}
                    >
                      <stat.icon className="size-5" aria-hidden="true" />
                    </div>
                    {stat.label === 'Ingresos de hoy' && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
                        <TrendingUp className="size-3.5" aria-hidden="true" />
                        12.5%
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {stat.note}
                  </p>
                </CardContent>
              </Card>
            ))}
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>
                      <h2>Próximas reservas</h2>
                    </CardTitle>
                    <CardDescription>
                      {date.reservations} reservas programadas para el día
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm">
                    Ver calendario <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  {reservations.map((reservation, index) => (
                    <article
                      key={`${reservation.time}-${reservation.court}`}
                      className="grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-lg border p-3 md:grid-cols-[72px_1fr_120px_100px]"
                    >
                      <div>
                        <p className="text-sm font-bold tabular-nums">
                          {reservation.time}
                        </p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {reservation.end}
                        </p>
                      </div>
                      <div className="min-w-0 border-l pl-3 md:pl-4">
                        <p className="truncate text-sm font-semibold">
                          {reservation.customer}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={cn(
                              'size-2 rounded-full',
                              [
                                'bg-chart-2',
                                'bg-chart-3',
                                'bg-chart-4',
                                'bg-chart-5',
                              ][index],
                            )}
                          />
                          {reservation.court}
                        </div>
                      </div>
                      <Badge
                        variant={
                          reservation.status === 'Confirmada'
                            ? 'success'
                            : 'secondary'
                        }
                        className="hidden md:inline-flex"
                      >
                        {reservation.status}
                      </Badge>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {reservation.amount}
                        </p>
                        <Button variant="link" size="sm">
                          Detalles
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>
                      <h2>Ingresos por método</h2>
                    </CardTitle>
                    <CardDescription>Cobros válidos de hoy</CardDescription>
                  </div>
                  <Badge variant="secondary">PEN</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-6 flex items-end gap-2">
                  <span className="text-3xl font-bold tracking-tight">
                    S/ 1,840
                  </span>
                  <span className="mb-1 text-xs text-muted-foreground">
                    neto
                  </span>
                </div>
                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div key={method.label}>
                      <div className="mb-1.5 flex justify-between text-xs">
                        <span className="font-medium">{method.label}</span>
                        <span className="font-semibold tabular-nums">
                          {method.amount}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', method.color)}
                          style={{ width: method.width }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline">Abrir reporte de caja</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>
                      <h2>Alertas de inventario</h2>
                    </CardTitle>
                    <CardDescription>
                      Productos bajo el umbral mínimo
                    </CardDescription>
                  </div>
                  <span className="grid size-8 place-items-center rounded-full bg-destructive/10 text-destructive">
                    <AlertCircle className="size-4" aria-hidden="true" />
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {stockAlerts.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0"
                    >
                      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <Package className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-xs text-destructive">
                          {item.stock}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {item.threshold}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>
                      <h2>Actividad reciente</h2>
                    </CardTitle>
                    <CardDescription>
                      Trazabilidad de la operación
                    </CardDescription>
                  </div>
                  <Button size="sm" variant="ghost">
                    Ver auditoría
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {activity.map((item) => (
                    <div
                      key={item.title}
                      className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0"
                    >
                      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                        <item.icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.detail}
                        </p>
                      </div>
                      <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                        {item.time}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
    </DashboardLayout>
  )
}
