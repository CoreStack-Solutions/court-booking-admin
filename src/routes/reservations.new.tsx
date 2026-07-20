import { useEffect, useRef, useState } from 'react'
import {
  createFileRoute,
  Link,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { ArrowLeft, UserPlus } from 'lucide-react'
import { z } from 'zod'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorCode } from '@/lib/errors'
import { getCurrentUser } from '@/features/auth/auth'
import { listCourts } from '@/features/courts/courts'
import { quoteReservation } from '@/features/rates/rates'
import {
  createCustomer,
  createReservation,
  listCustomers,
} from '@/features/reservations/reservations'
import type { SafeCustomer } from '@/features/reservations/reservations.schema'

export const Route = createFileRoute('/reservations/new')({
  validateSearch: z.object({
    courtId: z.string().uuid().optional(),
    date: z.string().optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
  }),
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
  loader: async () => {
    const [courtResult, customerResult] = await Promise.all([
      listCourts(),
      listCustomers({ data: { query: '' } }),
    ])
    return { courts: courtResult.courts, customers: customerResult.customers }
  },
  component: NewReservationPage,
})

function NewReservationPage() {
  const { courts, customers: initialCustomers } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<SafeCustomer[]>(initialCustomers)
  const [customerId, setCustomerId] = useState('')
  const [customerQuery, setCustomerQuery] = useState('')
  const [activeCustomerIndex, setActiveCustomerIndex] = useState<number | null>(
    null,
  )
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false)
  const customerRequestId = useRef(0)
  const [newCustomerOpen, setNewCustomerOpen] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [courtId, setCourtId] = useState(
    search.courtId ?? (courts.length > 0 ? courts[0].id : ''),
  )
  const [date, setDate] = useState(search.date ?? '')
  const [startsAt, setStartsAt] = useState(search.startsAt ?? '')
  const [endsAt, setEndsAt] = useState(search.endsAt ?? '')
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<{
    baseAmountCents: number
    finalAmountCents: number
    segments: Array<{ startsAt: string; endsAt: string; amountCents: number }>
  } | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const quoteRequestId = useRef(0)
  const [quoteRefresh, setQuoteRefresh] = useState(0)

  useEffect(() => {
    const currentRequestId = ++customerRequestId.current
    if (!customerQuery.trim()) {
      setCustomers(initialCustomers)
      setActiveCustomerIndex(null)
      return
    }
    const timer = window.setTimeout(() => {
      void listCustomers({ data: { query: customerQuery } }).then(
        (result) => {
          if (currentRequestId !== customerRequestId.current) return
          setCustomers(result.customers)
          setActiveCustomerIndex(null)
        },
        () => {
          if (currentRequestId === customerRequestId.current) setCustomers([])
        },
      )
    }, 250)
    return () => window.clearTimeout(timer)
  }, [customerQuery, initialCustomers])

  useEffect(() => {
    const currentRequestId = ++quoteRequestId.current
    if (!courtId || !date || !startsAt || !endsAt) {
      setQuote(null)
      setQuoteError(null)
      setQuoteLoading(false)
      return
    }
    setQuoteLoading(true)
    setQuoteError(null)
    void quoteReservation({
      data: { courtId, date, startsAt, endsAt },
    })
      .then(
        (result) => {
          if (currentRequestId !== quoteRequestId.current) return
          setQuote(result.quote)
          setQuoteError(null)
          setError(null)
        },
        (caughtError) => {
          if (currentRequestId !== quoteRequestId.current) return
          setQuote(null)
          setQuoteError(
            caughtError instanceof Error
              ? caughtError.message
              : 'No hay una tarifa aplicable para esta franja',
          )
        },
      )
      .finally(() => {
        if (currentRequestId === quoteRequestId.current) setQuoteLoading(false)
      })
  }, [courtId, date, startsAt, endsAt, quoteRefresh])

  async function handleCreateCustomer() {
    setLoading(true)
    setError(null)
    try {
      const result = await createCustomer({
        data: { name: newCustomerName, phone: newCustomerPhone || undefined },
      })
      setCustomers((current) => [result.customer, ...current])
      setCustomerId(result.customer.id)
      setCustomerQuery(result.customer.name)
      setNewCustomerOpen(false)
      setNewCustomerName('')
      setNewCustomerPhone('')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo crear el cliente',
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!quote || quoteLoading) {
      setError('Espera a que exista una cotización válida antes de guardar')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await createReservation({
        data: {
          courtId,
          customerId,
          date,
          startsAt,
          endsAt,
          idempotencyKey,
          expectedFinalAmountCents: quote.finalAmountCents,
        },
      })
      await navigate({
        to: '/reservations/$reservationId',
        params: { reservationId: result.reservation.id },
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
          : 'No se pudo crear la reserva',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout user={user}>
      <div className="mx-auto max-w-2xl">
        <Link
          to="/calendar"
          className="mb-4 inline-flex h-9 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al calendario
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Nueva reserva</CardTitle>
            <CardDescription>
              Registra una franja para un cliente existente o nuevo.
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
                  <option value="">Selecciona una cancha</option>
                  {courts
                    .filter((court) => court.status === 'active')
                    .map((court) => (
                      <option key={court.id} value={court.id}>
                        {court.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="reservation-date">Fecha</Label>
                  <Input
                    id="reservation-date"
                    type="date"
                    required
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reservation-start">Inicio</Label>
                  <Input
                    id="reservation-start"
                    type="time"
                    step="1800"
                    required
                    value={startsAt}
                    onChange={(event) => setStartsAt(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reservation-end">Fin</Label>
                  <Input
                    id="reservation-end"
                    type="time"
                    step="1800"
                    required
                    value={endsAt}
                    onChange={(event) => setEndsAt(event.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="customer-search">Cliente</Label>
                <Input
                  id="customer-search"
                  required={!customerId}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={
                    !customerId && customerMenuOpen && customers.length > 0
                  }
                  aria-controls="customer-options"
                  aria-activedescendant={
                    activeCustomerIndex === null
                      ? undefined
                      : `customer-option-${customers[activeCustomerIndex]?.id}`
                  }
                  placeholder="Busca por nombre o teléfono"
                  value={customerQuery}
                  onChange={(event) => {
                    setCustomerQuery(event.target.value)
                    setCustomerId('')
                    setActiveCustomerIndex(null)
                    setCustomerMenuOpen(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setActiveCustomerIndex(null)
                      setCustomerMenuOpen(false)
                      return
                    }
                    if (!customers.length || customerId) return
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      setCustomerMenuOpen(true)
                      setActiveCustomerIndex((current) =>
                        current === null || current >= customers.length - 1
                          ? 0
                          : current + 1,
                      )
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      setCustomerMenuOpen(true)
                      setActiveCustomerIndex((current) =>
                        current === null || current <= 0
                          ? customers.length - 1
                          : current - 1,
                      )
                    } else if (
                      event.key === 'Enter' &&
                      activeCustomerIndex !== null
                    ) {
                      event.preventDefault()
                      if (activeCustomerIndex >= customers.length) return
                      const customer = customers[activeCustomerIndex]
                      setCustomerId(customer.id)
                      setCustomerQuery(customer.name)
                      setActiveCustomerIndex(null)
                      setCustomerMenuOpen(false)
                    }
                  }}
                />
                {customers.length > 0 && !customerId && customerMenuOpen && (
                  <div
                    id="customer-options"
                    role="listbox"
                    className="grid max-h-40 gap-1 overflow-y-auto rounded-md border p-1"
                  >
                    {customers.map((customer) => (
                      <button
                        type="button"
                        role="option"
                        id={`customer-option-${customer.id}`}
                        aria-selected={
                          customers.indexOf(customer) === activeCustomerIndex
                        }
                        aria-current={
                          customers.indexOf(customer) === activeCustomerIndex
                            ? 'true'
                            : undefined
                        }
                        key={customer.id}
                        className={`rounded px-3 py-2 text-left text-sm hover:bg-muted ${customers.indexOf(customer) === activeCustomerIndex ? 'bg-muted' : ''}`}
                        onClick={() => {
                          setCustomerId(customer.id)
                          setCustomerQuery(customer.name)
                          setActiveCustomerIndex(null)
                          setCustomerMenuOpen(false)
                        }}
                      >
                        {customer.name}
                        {customer.phone ? ` · ${customer.phone}` : ''}
                      </button>
                    ))}
                  </div>
                )}
                {customerId && (
                  <p className="text-xs text-muted-foreground">
                    Cliente seleccionado. Cambia la búsqueda para elegir otro.
                  </p>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit gap-2"
                  onClick={() => setNewCustomerOpen((open) => !open)}
                >
                  <UserPlus className="size-4" aria-hidden />
                  Nuevo cliente
                </Button>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Cotización</p>
                    <p className="text-xs text-muted-foreground">
                      El servidor calculará y congelará este importe.
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
                {quote && (
                  <div className="mt-3 grid gap-1 border-t pt-3 text-xs text-muted-foreground">
                    {quote.segments.map((segment) => (
                      <div
                        key={`${segment.startsAt}-${segment.endsAt}`}
                        className="flex justify-between gap-3"
                      >
                        <span>
                          {segment.startsAt}–{segment.endsAt}
                        </span>
                        <span className="tabular-nums">
                          {formatMoney(segment.amountCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {newCustomerOpen && (
                <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm font-medium">Alta rápida</p>
                  <Label htmlFor="new-customer-name">Nombre completo</Label>
                  <Input
                    id="new-customer-name"
                    placeholder="Nombre completo"
                    value={newCustomerName}
                    onChange={(event) => setNewCustomerName(event.target.value)}
                  />
                  <Label htmlFor="new-customer-phone">Teléfono opcional</Label>
                  <Input
                    id="new-customer-phone"
                    placeholder="Teléfono opcional"
                    value={newCustomerPhone}
                    onChange={(event) =>
                      setNewCustomerPhone(event.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading || !newCustomerName.trim()}
                    onClick={() => void handleCreateCustomer()}
                  >
                    Guardar cliente
                  </Button>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Link
                  to="/calendar"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Cancelar
                </Link>
                <Button
                  type="submit"
                  disabled={loading || !customerId || !quote || quoteLoading}
                >
                  {loading ? 'Guardando…' : 'Crear reserva'}
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
