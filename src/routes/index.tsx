import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  Bell,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartLineUp,
  CheckCircle,
  Clock,
  GearSix,
  List,
  MagnifyingGlass,
  Package,
  Plus,
  SoccerBall,
  SquaresFour,
  Storefront,
  TrendUp,
  UsersThree,
  Wallet,
  WarningCircle,
  X,
} from '@phosphor-icons/react'

import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({ component: Dashboard })

const navItems = [
  { label: 'Resumen', icon: SquaresFour },
  { label: 'Calendario', icon: CalendarBlank, badge: '12' },
  { label: 'Clientes', icon: UsersThree },
  { label: 'Quiosco', icon: Storefront },
  { label: 'Inventario', icon: Package, badge: '3' },
  { label: 'Caja y reportes', icon: ChartLineUp },
]

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
    icon: CalendarBlank,
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
    icon: Storefront,
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
    icon: CheckCircle,
  },
  {
    title: 'Venta de quiosco',
    detail: '3 productos · S/ 24.00 · Efectivo',
    time: 'Hace 21 min',
    icon: Storefront,
  },
  {
    title: 'Nueva reserva creada',
    detail: 'Lucía Vega · Cancha 4 · 14:00',
    time: 'Hace 36 min',
    icon: CalendarBlank,
  },
]

function Dashboard() {
  const [activeNav, setActiveNav] = useState('Resumen')
  const [dateIndex, setDateIndex] = useState(1)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [reservationOpen, setReservationOpen] = useState(false)
  const [notice, setNotice] = useState(false)
  const date = dates[dateIndex]

  function saveReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReservationOpen(false)
    setNotice(true)
  }

  return (
    <div className="min-h-screen bg-muted/30 lg:grid lg:grid-cols-[248px_1fr]">
      {mobileNavOpen && (
        <button
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Cerrar navegación"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[248px] -translate-x-full flex-col border-r bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          mobileNavOpen && 'translate-x-0',
        )}
      >
        <div className="flex h-20 items-center gap-3 border-b px-5">
          <div className="grid size-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <SoccerBall weight="fill" className="size-6" />
          </div>
          <div>
            <p className="text-base font-bold leading-none">Central Padel</p>
            <p className="mt-1 text-xs text-sidebar-foreground/60">
              Centro deportivo
            </p>
          </div>
          <Button
            className="ml-auto lg:hidden"
            size="icon-sm"
            variant="ghost"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Cerrar menú"
          >
            <X />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Navegación principal">
          <p className="px-3 pb-2 pt-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
            Operación
          </p>
          {navItems.map((item) => (
            <button
              key={item.label}
              className={cn(
                'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                activeNav === item.label &&
                  'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
              )}
              onClick={() => {
                setActiveNav(item.label)
                setMobileNavOpen(false)
              }}
            >
              <item.icon
                className="size-[1.1rem]"
                weight={activeNav === item.label ? 'fill' : 'regular'}
              />
              {item.label}
              {item.badge && (
                <span
                  className={cn(
                    'ml-auto rounded-full bg-sidebar-accent px-2 py-0.5 text-[0.65rem] font-semibold text-sidebar-accent-foreground',
                    activeNav === item.label &&
                      'bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground',
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t p-3">
          <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sidebar-accent">
            <span className="grid size-9 place-items-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
              FV
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                Fernando Vega
              </span>
              <span className="block text-xs text-sidebar-foreground/55">
                Administrador
              </span>
            </span>
            <GearSix className="size-4 text-sidebar-foreground/55" />
          </button>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6 xl:px-8">
          <Button
            size="icon"
            variant="outline"
            className="lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Abrir menú"
          >
            <List />
          </Button>
          <div className="relative hidden max-w-md flex-1 md:block">
            <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-lg border bg-muted/40 pl-9 pr-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              placeholder="Buscar cliente, reserva o venta..."
              aria-label="Buscar"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ModeToggle />
            <Button
              size="icon"
              variant="outline"
              className="relative"
              aria-label="Notificaciones"
            >
              <Bell />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-destructive" />
            </Button>
            <Button
              className="hidden sm:inline-flex"
              onClick={() => setReservationOpen(true)}
            >
              <Plus data-icon="inline-start" />
              Nueva reserva
            </Button>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] p-4 md:p-6 xl:p-8">
          {notice && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm">
              <CheckCircle className="size-5 text-primary" weight="fill" />
              <span className="font-medium">
                Reserva demo creada correctamente.
              </span>
              <button
                className="ml-auto text-muted-foreground hover:text-foreground"
                onClick={() => setNotice(false)}
              >
                <X className="size-4" />
                <span className="sr-only">Cerrar aviso</span>
              </button>
            </div>
          )}

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
                <CaretLeft />
              </Button>
              <Button variant="outline" className="min-w-36 justify-between">
                <CalendarBlank />
                {date.day.split(',')[0]}
                <CaretDown />
              </Button>
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
                <CaretRight />
              </Button>
              <Button
                className="sm:hidden"
                size="icon"
                onClick={() => setReservationOpen(true)}
                aria-label="Nueva reserva"
              >
                <Plus />
              </Button>
            </div>
          </section>

          <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <article
                key={stat.label}
                className="rounded-2xl border bg-card p-4 shadow-sm md:p-5"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={cn(
                      'grid size-9 place-items-center rounded-xl',
                      stat.tone,
                    )}
                  >
                    <stat.icon className="size-[1.1rem]" weight="fill" />
                  </div>
                  {stat.label === 'Ingresos de hoy' && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-foreground">
                      <TrendUp className="size-3.5" /> 12.5%
                    </span>
                  )}
                </div>
                <p className="mt-5 text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <p className="mt-1 text-2xl font-bold tracking-tight">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.note}
                </p>
              </article>
            ))}
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
            <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-4 md:px-5">
                <div>
                  <h2 className="font-semibold">Próximas reservas</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {date.reservations} reservas programadas para el día
                  </p>
                </div>
                <Button variant="ghost" size="sm">
                  Ver calendario <ArrowRight data-icon="inline-end" />
                </Button>
              </div>

              <div className="divide-y">
                {reservations.map((reservation, index) => (
                  <article
                    key={`${reservation.time}-${reservation.court}`}
                    className="group grid grid-cols-[56px_1fr_auto] items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/45 md:grid-cols-[72px_1fr_120px_100px] md:px-5"
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
                    <span
                      className={cn(
                        'hidden w-fit rounded-full px-2.5 py-1 text-xs font-semibold md:inline-flex',
                        reservation.status === 'Confirmada'
                          ? 'bg-primary/10 text-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {reservation.status}
                    </span>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {reservation.amount}
                      </p>
                      <button className="mt-1 text-xs text-muted-foreground hover:text-foreground">
                        Detalles
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold">Ingresos por método</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Cobros válidos de hoy
                  </p>
                </div>
                <span className="rounded-lg bg-muted px-2 py-1 text-xs font-medium">
                  PEN
                </span>
              </div>
              <div className="my-6 flex items-end gap-2">
                <span className="text-3xl font-bold tracking-tight">
                  S/ 1,840
                </span>
                <span className="mb-1 text-xs text-muted-foreground">neto</span>
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
              <Button variant="outline" className="mt-6 w-full">
                Abrir reporte de caja
              </Button>
            </section>

            <section className="rounded-2xl border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-4 md:px-5">
                <div>
                  <h2 className="font-semibold">Alertas de inventario</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Productos bajo el umbral mínimo
                  </p>
                </div>
                <span className="grid size-8 place-items-center rounded-full bg-destructive/10 text-destructive">
                  <WarningCircle className="size-4" weight="fill" />
                </span>
              </div>
              <div className="divide-y px-4 md:px-5">
                {stockAlerts.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center gap-3 py-3.5"
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
            </section>

            <section className="rounded-2xl border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b px-4 py-4 md:px-5">
                <div>
                  <h2 className="font-semibold">Actividad reciente</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Trazabilidad de la operación
                  </p>
                </div>
                <Button size="sm" variant="ghost">
                  Ver auditoría
                </Button>
              </div>
              <div className="divide-y px-4 md:px-5">
                {activity.map((item) => (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 py-3.5"
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
            </section>
          </div>
        </div>
      </main>

      {reservationOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-end bg-foreground/45 p-0 sm:place-items-center sm:p-4">
          <section
            className="w-full rounded-t-2xl border bg-background shadow-2xl sm:max-w-lg sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reservation-title"
          >
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h2 id="reservation-title" className="font-semibold">
                  Nueva reserva
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Los horarios se validarán antes de guardar.
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setReservationOpen(false)}
                aria-label="Cerrar"
              >
                <X />
              </Button>
            </div>
            <form
              onSubmit={saveReservation}
              className="grid gap-4 p-5 sm:grid-cols-2"
            >
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                Cliente
                <input
                  required
                  defaultValue="Andrea Rojas"
                  className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Cancha
                <select className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring">
                  <option>Cancha 1</option>
                  <option>Cancha 2</option>
                  <option>Cancha 3</option>
                  <option>Cancha 4</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Fecha
                <input
                  type="date"
                  defaultValue="2026-07-17"
                  className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Inicio
                <input
                  type="time"
                  step="1800"
                  defaultValue="16:00"
                  className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Fin
                <input
                  type="time"
                  step="1800"
                  defaultValue="17:30"
                  className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-ring"
                />
              </label>
              <div className="flex items-center justify-between rounded-xl bg-muted p-3 sm:col-span-2">
                <span className="text-sm text-muted-foreground">
                  Cotización estimada
                </span>
                <span className="font-bold">S/ 90.00</span>
              </div>
              <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReservationOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">Crear reserva</Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
