import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import {
  Circle,
  MapPin,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'

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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { getCurrentUser } from '@/features/auth/auth'
import {
  createCourt,
  listCourts,
  updateCourt,
} from '@/features/courts/courts'
import type { SafeCourt } from '@/features/courts/courts.schema'

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/courts')({
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
    return { courts: result.courts }
  },
  component: CourtsPage,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  active: {
    label: 'Activa',
    variant: 'success' as const,
    icon: ShieldCheck,
    description: 'Disponible para reservas',
  },
  maintenance: {
    label: 'Mantenimiento',
    variant: 'secondary' as const,
    icon: ShieldAlert,
    description: 'No acepta nuevas reservas',
  },
  inactive: {
    label: 'Inactiva',
    variant: 'secondary' as const,
    icon: ShieldOff,
    description: 'Oculta de la operación',
  },
}

const COURT_COLORS = [
  { label: 'Verde', value: '#22c55e' },
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Ámbar', value: '#f59e0b' },
  { label: 'Rosa', value: '#ec4899' },
  { label: 'Violeta', value: '#8b5cf6' },
  { label: 'Rojo', value: '#ef4444' },
  { label: 'Naranja', value: '#f97316' },
  { label: 'Cyan', value: '#06b6d4' },
]

// ─── Court Form Dialog ────────────────────────────────────────────────────────

type CourtFormState = {
  name: string
  color: string
  status: SafeCourt['status']
  sortOrder: string
}

function CourtDialog({
  open,
  onOpenChange,
  court,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  court?: SafeCourt
  onSave: (court: SafeCourt) => void
}) {
  const isEdit = !!court
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<CourtFormState>({
    name: court?.name ?? '',
    color: court?.color ?? '#22c55e',
    status: court?.status ?? 'active',
    sortOrder: String(court?.sortOrder ?? 0),
  })

  function set<K extends keyof CourtFormState>(key: K, value: CourtFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const sortOrder = parseInt(form.sortOrder, 10)
      if (isNaN(sortOrder)) throw new Error('Orden inválido')

      let result: SafeCourt
      if (isEdit && court) {
        const res = await updateCourt({
          data: {
            id: court.id,
            name: form.name,
            color: form.color,
            status: form.status,
            sortOrder,
          },
        })
        result = res.court
      } else {
        const res = await createCourt({
          data: {
            name: form.name,
            color: form.color,
            status: form.status,
            sortOrder,
          },
        })
        result = res.court
      }
      onSave(result)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar cancha' : 'Nueva cancha'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza los datos de la cancha.'
              : 'Completa los datos para agregar una cancha.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 pt-2">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <label className="grid gap-2 text-sm font-medium">
            Nombre
            <Input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Cancha 1"
              maxLength={80}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Color
              <Select
                value={form.color}
                onValueChange={(v) => set('color', v)}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: form.color }}
                    />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {COURT_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: c.value }}
                        />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Orden
              <Input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) => set('sortOrder', e.target.value)}
              />
            </label>
          </div>

          {isEdit && (
            <label className="grid gap-2 text-sm font-medium">
              Estado
              <Select
                value={form.status}
                onValueChange={(v) =>
                  set('status', v as SafeCourt['status'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex flex-col">
                        <span>{cfg.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {cfg.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando…' : isEdit ? 'Actualizar' : 'Crear cancha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Court Card ───────────────────────────────────────────────────────────────

function CourtCard({
  court,
  isAdmin,
  onEdit,
}: {
  court: SafeCourt
  isAdmin: boolean
  onEdit: (court: SafeCourt) => void
}) {
  const status = STATUS_CONFIG[court.status]
  const StatusIcon = status.icon

  return (
    <article className="group relative flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className="grid size-12 shrink-0 place-items-center rounded-xl shadow-sm"
          style={{ backgroundColor: court.color + '22' }}
        >
          <Circle
            className="size-5"
            fill={court.color}
            stroke={court.color}
          />
        </div>
        <Badge variant={status.variant} className="shrink-0">
          <StatusIcon className="mr-1 size-3" aria-hidden />
          {status.label}
        </Badge>
      </div>

      <div className="flex-1">
        <h3 className="text-base font-bold tracking-tight">{court.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {status.description}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Orden de visualización: #{court.sortOrder}
        </p>
      </div>

      {isAdmin && (
        <div className="mt-4 border-t pt-4">
          <Button
            size="sm"
            variant="ghost"
            className="w-full gap-2"
            onClick={() => onEdit(court)}
          >
            <Pencil className="size-3.5" aria-hidden />
            Editar cancha
          </Button>
        </div>
      )}
    </article>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CourtsPage() {
  const { courts: initialCourts } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const isAdmin = user.role === 'admin'

  const [courtList, setCourtList] = useState<SafeCourt[]>(initialCourts)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SafeCourt | null>(null)

  function handleSave(saved: SafeCourt) {
    setCourtList((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next.sort((a, b) => a.sortOrder - b.sortOrder)
      }
      return [...prev, saved].sort((a, b) => a.sortOrder - b.sortOrder)
    })
  }

  const activeCount = courtList.filter((c) => c.status === 'active').length
  const maintenanceCount = courtList.filter(
    (c) => c.status === 'maintenance',
  ).length

  return (
    <DashboardLayout user={user}>
      {/* Header */}
      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Negocio Core · Configuración
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <MapPin className="size-6 text-primary" aria-hidden />
            Canchas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {courtList.length} cancha{courtList.length !== 1 ? 's' : ''} en
            total · {activeCount} activa{activeCount !== 1 ? 's' : ''} ·{' '}
            {maintenanceCount > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                {maintenanceCount} en mantenimiento ·{' '}
              </span>
            )}
            {courtList.filter((c) => c.status === 'inactive').length} inactiva
            {courtList.filter((c) => c.status === 'inactive').length !== 1
              ? 's'
              : ''}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)} className="shrink-0 gap-2">
            <Plus className="size-4" aria-hidden />
            Nueva cancha
          </Button>
        )}
      </section>

      {/* Stats */}
      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          {
            label: 'Activas',
            value: activeCount,
            color: 'bg-green-500/10 text-green-700 dark:text-green-400',
          },
          {
            label: 'En mantenimiento',
            value: maintenanceCount,
            color: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
          },
          {
            label: 'Inactivas',
            value: courtList.filter((c) => c.status === 'inactive').length,
            color: 'bg-muted text-muted-foreground',
          },
        ].map((s) => (
          <Card key={s.label} className="border-none shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <span
                className={cn(
                  'grid size-10 place-items-center rounded-full text-lg font-bold',
                  s.color,
                )}
              >
                {s.value}
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                {s.label}
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Court grid */}
      {courtList.length === 0 ? (
        <Card className="py-16 text-center">
          <CardHeader>
            <CardTitle className="text-muted-foreground">
              Sin canchas registradas
            </CardTitle>
            <CardDescription>
              {isAdmin
                ? 'Crea la primera cancha para empezar a operar.'
                : 'Aún no hay canchas configuradas.'}
            </CardDescription>
          </CardHeader>
          {isAdmin && (
            <CardContent>
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="size-4" />
                Nueva cancha
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <section
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          aria-label="Lista de canchas"
        >
          {courtList.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              isAdmin={isAdmin}
              onEdit={setEditTarget}
            />
          ))}
        </section>
      )}

      {/* Create dialog */}
      <CourtDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSave={handleSave}
      />

      {/* Edit dialog */}
      {editTarget && (
        <CourtDialog
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          court={editTarget}
          onSave={handleSave}
        />
      )}
    </DashboardLayout>
  )
}
