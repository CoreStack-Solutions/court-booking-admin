import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import {
  BarChart3,
  Receipt,
  Printer,
  Lock,
  CalendarDays,
} from 'lucide-react'

import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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
import { getDailyRevenueReport } from '@/features/cashier/cashier'
import { z } from 'zod'

const searchSchema = z.object({
  date: z.string().optional(),
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

export const Route = createFileRoute('/reports')({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search: { date } }) => ({ date }),
  beforeLoad: async ({ location }) => {
    const current = await getCurrentUser()
    if (!current) {
      throw redirect({
        href: `/login?redirect=${encodeURIComponent(location.href)}`,
      })
    }
    return { user: current.user }
  },
  loader: async ({ deps: { date } }) => {
    const selectedDate = date || limaDateValue(new Date())
    const res = await getDailyRevenueReport({ data: { date: selectedDate } })
    return { report: res.report }
  },
  component: ReportsPage,
})

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Lima',
  }).format(timestamp)
}

function formatDateFull(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

function formatMoney(amountCents: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amountCents / 100)
}

const methodLabels: Record<string, string> = {
  cash: 'Efectivo',
  yape: 'Yape',
  plin: 'Plin',
  bank_transfer: 'Transferencia',
}

function ReportsPage() {
  const { report } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()

  const [date, setDate] = useState(search.date || limaDateValue(new Date()))
  const [closeOpen, setCloseOpen] = useState(false)
  const [isClosed, setIsClosed] = useState(false)

  function handleDateChange(newDate: string) {
    setDate(newDate)
    void navigate({
      to: '/reports',
      search: { date: newDate },
    })
  }

  return (
    <DashboardLayout user={user}>
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Negocio Core · Operación
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <BarChart3 className="size-6 text-primary" aria-hidden />
            Caja y Reportes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visualiza los ingresos del día, el historial de cobros y realiza el cierre de caja.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Seleccionar fecha">
                <CalendarDays className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={new Date(date + 'T12:00:00')}
                onSelect={(val) => {
                  if (val) handleDateChange(localDateValue(val))
                }}
              />
            </PopoverContent>
          </Popover>
          {user.role === 'admin' && (
            <Button
              onClick={() => {
                setCloseOpen(true)
                setIsClosed(true)
              }}
              variant="default"
              className="gap-2"
            >
              <Lock className="size-4" />
              Cerrar Caja
            </Button>
          )}
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase text-primary/75">
              Ingresos Totales
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-primary">
              {formatMoney(report.totalCents)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[0.68rem] text-muted-foreground">
              Total recaudado del día
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase text-muted-foreground">
              Efectivo
            </CardDescription>
            <CardTitle className="text-xl font-bold tracking-tight">
              {formatMoney(report.byMethod.cashCents)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[0.68rem] text-muted-foreground">
              Cuentas de efectivo físico
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase text-muted-foreground">
              Yape
            </CardDescription>
            <CardTitle className="text-xl font-bold tracking-tight">
              {formatMoney(report.byMethod.yapeCents)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[0.68rem] text-muted-foreground">
              Pagos móviles Yape
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase text-muted-foreground">
              Plin
            </CardDescription>
            <CardTitle className="text-xl font-bold tracking-tight">
              {formatMoney(report.byMethod.plinCents)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[0.68rem] text-muted-foreground">
              Pagos móviles Plin
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase text-muted-foreground">
              Transferencias
            </CardDescription>
            <CardTitle className="text-xl font-bold tracking-tight">
              {formatMoney(report.byMethod.bankTransferCents)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[0.68rem] text-muted-foreground">
              Bancos (BCP, Interbank, etc.)
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Historial de transacciones de caja */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Detalle de Cobros Recibidos</CardTitle>
            <CardDescription>
              Operaciones y pagos validados en la fecha {formatDateFull(date)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {report.payments.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground border-t">
                No hay transacciones ni cobros registrados para esta fecha.
              </div>
            ) : (
              <div className="overflow-x-auto border-t">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="p-4">Hora</th>
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Método</th>
                      <th className="p-4">Referencia</th>
                      <th className="p-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4 font-semibold text-muted-foreground tabular-nums">
                          {formatDateTime(p.paidAt!)}
                        </td>
                        <td className="p-4 font-semibold">{p.customerName}</td>
                        <td className="p-4">
                          <Badge variant="outline">{methodLabels[p.method]}</Badge>
                        </td>
                        <td className="p-4 text-xs text-muted-foreground">
                          {p.reference || '—'}
                        </td>
                        <td className="p-4 text-right font-bold text-green-600 dark:text-green-400 tabular-nums">
                          + {formatMoney(p.amountCents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumen de Caja y Cierre */}
        <Card className="h-fit shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Resumen de Caja</CardTitle>
            <CardDescription>Auditoría rápida del día</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Transacciones</span>
              <span className="font-semibold tabular-nums">
                {report.payments.length}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm border-b pb-3">
              <span className="text-muted-foreground">Acciones Auditadas</span>
              <span className="font-semibold tabular-nums">
                {report.auditCount} logs
              </span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1">
              <span className="text-muted-foreground">Caja del Día</span>
              <Badge variant={isClosed ? 'secondary' : 'success'}>
                {isClosed ? 'Cerrada' : 'Abierta'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cierre de Caja Modal */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="size-5 text-primary" />
              Corte de Caja Completo
            </DialogTitle>
            <DialogDescription>
              Comprobante e informe del cierre de caja del día {date}.
            </DialogDescription>
          </DialogHeader>

          <div className="border-t border-b border-dashed py-4 my-2 text-sm grid gap-2.5 font-mono">
            <div className="flex justify-between">
              <span>ESTABLECIMIENTO:</span>
              <span className="font-bold">CanchasApp Admin</span>
            </div>
            <div className="flex justify-between">
              <span>FECHA DE CORTE:</span>
              <span>{date}</span>
            </div>
            <div className="flex justify-between">
              <span>OPERADOR:</span>
              <span>{user.name}</span>
            </div>
            <div className="border-t border-dashed pt-2 flex justify-between font-bold text-base">
              <span>TOTAL RECAUDADO:</span>
              <span className="text-green-600 dark:text-green-400">
                {formatMoney(report.totalCents)}
              </span>
            </div>
            <div className="pl-4 border-l-2 text-xs text-muted-foreground grid gap-1">
              <div className="flex justify-between">
                <span>EFECTIVO:</span>
                <span>{formatMoney(report.byMethod.cashCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>YAPE:</span>
                <span>{formatMoney(report.byMethod.yapeCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>PLIN:</span>
                <span>{formatMoney(report.byMethod.plinCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>TRANSFERENCIAS:</span>
                <span>{formatMoney(report.byMethod.bankTransferCents)}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 flex sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
              className="gap-2"
            >
              <Printer className="size-4" />
              Imprimir
            </Button>
            <Button type="button" onClick={() => setCloseOpen(false)}>
              Aceptar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
