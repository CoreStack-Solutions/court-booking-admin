import { useState } from 'react'
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import {
  Users,
  Search,
  Plus,
  Phone,
  FileText,
  User,
  Calendar,
  ExternalLink,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getCurrentUser } from '@/features/auth/auth'
import {
  listCustomers,
  createCustomer,
  listReservations,
} from '@/features/reservations/reservations'
import type { SafeCustomer, SafeReservation } from '@/features/reservations/reservations.schema'
import { z } from 'zod'

const searchSchema = z.object({
  q: z.string().optional(),
})

export const Route = createFileRoute('/customers')({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search: { q } }) => ({ q }),
  beforeLoad: async ({ location }) => {
    const current = await getCurrentUser()
    if (!current) {
      throw redirect({
        href: `/login?redirect=${encodeURIComponent(location.href)}`,
      })
    }
    return { user: current.user }
  },
  loader: async ({ deps: { q } }) => {
    const query = q || ''
    const [cRes, rRes] = await Promise.all([
      listCustomers({ data: { query } }),
      listReservations(),
    ])
    return {
      customers: cRes.customers,
      reservations: rRes.reservations,
    }
  },
  component: CustomersPage,
})

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
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

const statusLabels: Record<SafeReservation['status'], string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
  no_show: 'No show',
}

function CustomersPage() {
  const { customers, reservations } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const router = useRouter()

  const [q, setQ] = useState(search.q || '')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<SafeCustomer | null>(null)
  
  // Create form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canOperate = user.role !== 'viewer'

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    void navigate({
      to: '/customers',
      search: { q: q.trim() || undefined },
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await createCustomer({
        data: {
          name: name.trim(),
          phone: phone.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      })
      setName('')
      setPhone('')
      setNotes('')
      setCreateOpen(false)
      router.invalidate()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo crear el cliente',
      )
    } finally {
      setPending(false)
    }
  }

  const selectedReservations = selectedCustomer
    ? reservations.filter((r) => r.customerId === selectedCustomer.id)
    : []

  const selectedStats = selectedCustomer
    ? selectedReservations.reduce(
        (stats, r) => {
          if (r.status !== 'cancelled') {
            stats.totalReservations++
            stats.totalSpent += r.finalAmountCents
          }
          return stats;
        },
        { totalReservations: 0, totalSpent: 0 }
      )
    : { totalReservations: 0, totalSpent: 0 }

  return (
    <DashboardLayout user={user}>
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Negocio Core · Administración
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Users className="size-6 text-primary" aria-hidden />
            Clientes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra la cartera de clientes, información de contacto e historial de reservas.
          </p>
        </div>

        {canOperate && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2 self-start sm:self-auto">
            <Plus className="size-4" />
            Nuevo Cliente
          </Button>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        {/* Left Side: Client List & Search */}
        <Card className="shadow-sm">
          <CardHeader>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o teléfono..."
                  className="pl-9"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <Button type="submit">Buscar</Button>
            </form>
          </CardHeader>
          <CardContent className="p-0">
            {customers.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground border-t">
                No se encontraron clientes.
              </div>
            ) : (
              <div className="overflow-x-auto border-t">
                {/* Desktop View Table */}
                <table className="hidden w-full text-left text-sm sm:table">
                  <thead className="bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="p-4">Nombre</th>
                      <th className="p-4">Teléfono</th>
                      <th className="p-4">Notas</th>
                      <th className="p-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        onClick={() => setSelectedCustomer(customer)}
                        className={`cursor-pointer hover:bg-muted/30 transition-colors ${selectedCustomer?.id === customer.id ? 'bg-muted/50' : ''}`}
                      >
                        <td className="p-4 font-semibold">{customer.name}</td>
                        <td className="p-4 text-muted-foreground">
                          {customer.phone || '—'}
                        </td>
                        <td className="p-4 text-muted-foreground max-w-[200px] truncate">
                          {customer.notes || '—'}
                        </td>
                        <td className="p-4 text-right">
                          <Button size="xs" variant="outline">
                            Ver detalles
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile View List */}
                <div className="divide-y sm:hidden">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      className={`p-4 cursor-pointer hover:bg-muted/30 transition-colors ${selectedCustomer?.id === customer.id ? 'bg-muted/50' : ''}`}
                    >
                      <p className="font-semibold">{customer.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="size-3" />
                        {customer.phone || '—'}
                      </p>
                      {customer.notes && (
                        <p className="mt-1 text-xs text-muted-foreground italic truncate">
                          "{customer.notes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Side: Client Details Sidebar */}
        <Card className="h-fit shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="size-5 text-primary" />
              Detalle del Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedCustomer ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Selecciona un cliente de la lista para ver su historial y estadísticas.
              </div>
            ) : (
              <div className="grid gap-6">
                <div>
                  <h3 className="font-bold text-lg">{selectedCustomer.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
                    <Phone className="size-4 text-primary" />
                    {selectedCustomer.phone || 'Sin teléfono registrado'}
                  </p>
                  {selectedCustomer.notes && (
                    <div className="mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground flex gap-2">
                      <FileText className="size-4 shrink-0 mt-0.5" />
                      <p>{selectedCustomer.notes}</p>
                    </div>
                  )}
                </div>

                <div className="grid gap-2 border-t pt-4 sm:grid-cols-2">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                      Reservas
                    </p>
                    <p className="mt-0.5 text-lg font-bold">
                      {selectedStats.totalReservations}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                      Total Invertido
                    </p>
                    <p className="mt-0.5 text-lg font-bold text-green-600 dark:text-green-400">
                      {formatMoney(selectedStats.totalSpent)}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Historial de Reservas
                  </h4>
                  {selectedReservations.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-6">
                      Este cliente no tiene reservas registradas.
                    </p>
                  ) : (
                    <div className="grid gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {selectedReservations.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-lg border p-3 text-xs flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-muted-foreground">
                              {r.courtName}
                            </span>
                            <Badge
                              variant={
                                r.status === 'confirmed'
                                  ? 'success'
                                  : r.status === 'completed'
                                    ? 'outline'
                                    : 'secondary'
                              }
                              className="text-[0.6rem] px-1.5 py-0"
                            >
                              {statusLabels[r.status]}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" />
                              {formatDateTime(r.startsAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between border-t pt-1.5 mt-0.5">
                            <span className="font-bold text-foreground">
                              {formatMoney(r.finalAmountCents)}
                            </span>
                            <Button
                              variant="link"
                              size="xs"
                              className="h-auto p-0 gap-1 text-[0.65rem]"
                              render={
                                <a
                                  href={`/reservations/${r.id}`}
                                />
                              }
                            >
                              Detalle
                              <ExternalLink className="size-2.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nuevo Cliente Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Registra un nuevo cliente en el sistema.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="grid gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label>Nombre Completo</Label>
              <Input
                required
                placeholder="Ej. Andrea Rojas"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Teléfono (opcional)</Label>
              <Input
                placeholder="Ej. 987654321"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="customer-notes">Notas del cliente (opcional)</Label>
              <Textarea
                id="customer-notes"
                placeholder="Notas adicionales, preferencias, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Registrando…' : 'Registrar Cliente'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
