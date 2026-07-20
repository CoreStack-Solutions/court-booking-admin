import { useEffect, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Clock3, Pencil, Plus } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCurrentUser } from '@/features/auth/auth'
import { listCourts } from '@/features/courts/courts'
import {
  createRateRule,
  listRateRules,
  updateRateRule,
} from '@/features/rates/rates'
import type { SafeRateRule } from '@/features/rates/rates.schema'

export const Route = createFileRoute('/rates')({
  beforeLoad: async ({ location }) => {
    const current = await getCurrentUser()
    if (!current) {
      throw redirect({
        href: `/login?redirect=${encodeURIComponent(location.href)}`,
      })
    }
    if (current.user.role !== 'admin') throw redirect({ to: '/' })
    return { user: current.user }
  },
  loader: async () => {
    const [ruleResult, courtResult] = await Promise.all([
      listRateRules(),
      listCourts(),
    ])
    return { rateRules: ruleResult.rateRules, courts: courtResult.courts }
  },
  component: RatesPage,
})

const dayLabels = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

type RateForm = {
  courtId: string
  name: string
  dayOfWeek: string
  startsAt: string
  endsAt: string
  pricePerHour: string
  effectiveFrom: string
  effectiveTo: string
  isActive: boolean
}

function todayValue() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

function emptyForm(): RateForm {
  return {
    courtId: '',
    name: '',
    dayOfWeek: '',
    startsAt: '07:00',
    endsAt: '22:00',
    pricePerHour: '',
    effectiveFrom: todayValue(),
    effectiveTo: '',
    isActive: true,
  }
}

function formFromRule(rule: SafeRateRule): RateForm {
  return {
    courtId: rule.courtId ?? '',
    name: rule.name,
    dayOfWeek: rule.dayOfWeek === null ? '' : String(rule.dayOfWeek),
    startsAt: rule.startsAt,
    endsAt: rule.endsAt,
    pricePerHour: (rule.pricePerHourCents / 100).toFixed(2),
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo ?? '',
    isActive: rule.isActive,
  }
}

function formatMoney(amountCents: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amountCents / 100)
}

function ruleDescription(rule: SafeRateRule) {
  const day =
    rule.dayOfWeek === null ? 'Todos los días' : dayLabels[rule.dayOfWeek]
  const court = rule.courtName ?? 'Todas las canchas'
  const end = rule.effectiveTo ? ` hasta ${rule.effectiveTo}` : ''
  return `${court} · ${day} · ${rule.startsAt}–${rule.endsAt} · desde ${rule.effectiveFrom}${end}`
}

function RatesPage() {
  const { rateRules: initialRules, courts } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const [rules, setRules] = useState(initialRules)
  const [target, setTarget] = useState<SafeRateRule | null>(null)
  const [open, setOpen] = useState(false)

  function openCreate() {
    setTarget(null)
    setOpen(true)
  }

  function openEdit(rule: SafeRateRule) {
    setTarget(rule)
    setOpen(true)
  }

  function handleSave(saved: SafeRateRule) {
    setRules((current) => {
      const index = current.findIndex((rule) => rule.id === saved.id)
      if (index === -1) return [...current, saved]
      const next = [...current]
      next[index] = saved
      return next
    })
    setOpen(false)
  }

  return (
    <DashboardLayout user={user}>
      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Negocio Core · Configuración
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Clock3 className="size-6 text-primary" aria-hidden />
            Tarifas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define el precio por hora y su vigencia para cotizar reservas.
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="size-4" aria-hidden />
          Nueva tarifa
        </Button>
      </section>

      {rules.length === 0 ? (
        <Card className="py-16 text-center">
          <CardHeader>
            <CardTitle>No hay tarifas configuradas</CardTitle>
            <CardDescription>
              Crea una regla antes de registrar reservas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={openCreate}>Crear la primera tarifa</Button>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-3" aria-label="Lista de tarifas">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{rule.name}</p>
                    <Badge variant={rule.isActive ? 'success' : 'secondary'}>
                      {rule.isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {ruleDescription(rule)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <p className="text-lg font-semibold tabular-nums">
                    {formatMoney(rule.pricePerHourCents)} / hora
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => openEdit(rule)}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <RateDialog
        key={`${target?.id ?? 'new'}-${open ? 'open' : 'closed'}`}
        open={open}
        onOpenChange={setOpen}
        rule={target}
        courts={courts}
        onSave={handleSave}
      />
    </DashboardLayout>
  )
}

function RateDialog({
  open,
  onOpenChange,
  rule,
  courts,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: SafeRateRule | null
  courts: Array<{ id: string; name: string }>
  onSave: (rule: SafeRateRule) => void
}) {
  const [form, setForm] = useState<RateForm>(() =>
    rule ? formFromRule(rule) : emptyForm(),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm(rule ? formFromRule(rule) : emptyForm())
  }, [rule])

  function update<TKey extends keyof RateForm>(
    key: TKey,
    value: RateForm[TKey],
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setForm(rule ? formFromRule(rule) : emptyForm())
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    const price = Number(form.pricePerHour)
    const pricePerHourCents = Math.round(price * 100)
    try {
      const data = {
        courtId: form.courtId || null,
        name: form.name,
        dayOfWeek: form.dayOfWeek === '' ? null : Number(form.dayOfWeek),
        startsAt: form.startsAt,
        endsAt: form.endsAt,
        pricePerHourCents,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        isActive: form.isActive,
      }
      const result = rule
        ? await updateRateRule({ data: { id: rule.id, ...data } })
        : await createRateRule({ data })
      onSave(result.rateRule)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo guardar la tarifa',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar tarifa' : 'Nueva tarifa'}</DialogTitle>
          <DialogDescription>
            Las reservas guardan el importe calculado y no cambian al editar
            esta regla.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-2">
            <Label htmlFor="rate-name">Nombre</Label>
            <Input
              id="rate-name"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="rate-court">Cancha</Label>
              <select
                id="rate-court"
                value={form.courtId}
                onChange={(event) => update('courtId', event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todas las canchas</option>
                {courts.map((court) => (
                  <option key={court.id} value={court.id}>
                    {court.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate-day">Día</Label>
              <select
                id="rate-day"
                value={form.dayOfWeek}
                onChange={(event) => update('dayOfWeek', event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Todos los días</option>
                {dayLabels.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="rate-start">Inicio</Label>
              <Input
                id="rate-start"
                type="time"
                step="1800"
                value={form.startsAt}
                onChange={(event) => update('startsAt', event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate-end">Fin</Label>
              <Input
                id="rate-end"
                type="time"
                step="1800"
                value={form.endsAt}
                onChange={(event) => update('endsAt', event.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate-price">PEN / hora</Label>
              <Input
                id="rate-price"
                type="number"
                min="0.01"
                step="0.01"
                value={form.pricePerHour}
                onChange={(event) => update('pricePerHour', event.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="rate-from">Vigente desde</Label>
              <Input
                id="rate-from"
                type="date"
                value={form.effectiveFrom}
                onChange={(event) =>
                  update('effectiveFrom', event.target.value)
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate-to">Vigente hasta</Label>
              <Input
                id="rate-to"
                type="date"
                value={form.effectiveTo}
                onChange={(event) => update('effectiveTo', event.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => update('isActive', event.target.checked)}
            />
            Regla activa
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar tarifa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
