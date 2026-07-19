import { useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  Plus,
  Store,
  Users,
  BarChart3,
  CheckCircle2,
  X,
} from 'lucide-react'

import { ModeToggle } from '@/components/mode-toggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { logout } from '@/features/auth/auth'
import type { SafeUser } from '@/features/auth/auth.schema'

const navSections = [
  {
    title: 'Negocio Core',
    items: [
      { label: 'Resumen', icon: LayoutDashboard, href: '/' as const },
      {
        label: 'Calendario',
        icon: CalendarDays,
        badge: '12',
        href: '/calendar' as const,
      },
      { label: 'Canchas', icon: MapPin, href: '/courts' as const },
      { label: 'Clientes', icon: Users, href: undefined },
      { label: 'Caja y reportes', icon: BarChart3, href: undefined },
    ],
  },
  {
    title: 'Quiosco e Inventario',
    items: [
      { label: 'Quiosco', icon: Store, href: undefined },
      { label: 'Inventario', icon: Package, badge: '3', href: undefined },
    ],
  },
]

function SidebarContent({
  activeNav,
  onNavigate,
  onLogout,
  user,
}: {
  activeNav: string
  onNavigate: (label: string) => void
  onLogout: () => void
  user: SafeUser
}) {
  const roleLabel = {
    admin: 'Administrador',
    operator: 'Operador',
    viewer: 'Lector',
  }[user.role]
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      <div className="flex h-20 items-center gap-3 border-b px-5">
        <div className="size-10 overflow-hidden rounded-lg shadow-sm">
          <img
            src="/logo.png"
            alt="CanchasApp Logo"
            className="size-full object-cover"
          />
        </div>
        <div>
          <p className="text-base font-bold leading-none">CanchasApp</p>
          <p className="mt-1 text-xs text-sidebar-foreground/60">
            Centro deportivo
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 p-3" aria-label="Navegación principal">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <p className="px-3 pb-2 pt-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/45">
              {section.title}
            </p>
            {section.items.map((item) =>
              item.href ? (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={() => onNavigate(item.label)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    activeNav === item.href &&
                      'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground',
                  )}
                >
                  <item.icon className="size-[1.1rem]" aria-hidden="true" />
                  {item.label}
                  {item.badge && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        'ml-auto border-0 bg-sidebar-accent text-sidebar-accent-foreground',
                        activeNav === item.href &&
                          'bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground',
                      )}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              ) : (
                <Button
                  key={item.label}
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    activeNav === item.label &&
                      'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground',
                  )}
                  onClick={() => onNavigate(item.label)}
                >
                  <item.icon className="size-[1.1rem]" aria-hidden="true" />
                  {item.label}
                  {item.badge && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        'ml-auto border-0 bg-sidebar-accent text-sidebar-accent-foreground',
                        activeNav === item.label &&
                          'bg-sidebar-primary-foreground/15 text-sidebar-primary-foreground',
                      )}
                    >
                      {item.badge}
                    </Badge>
                  )}
                </Button>
              ),
            )}
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <Button
          variant="ghost"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="h-auto w-full justify-start gap-3 text-left text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={onLogout}
        >
          <span className="grid size-9 place-items-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">
              {user.name}
            </span>
            <span className="block text-xs text-sidebar-foreground/55">
              {roleLabel}
            </span>
          </span>
          <LogOut
            className="size-4 text-sidebar-foreground/55"
            aria-hidden="true"
          />
        </Button>
      </div>
    </>
  )
}

export function DashboardLayout({
  user,
  children,
}: {
  user: SafeUser
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [reservationOpen, setReservationOpen] = useState(false)
  const [notice, setNotice] = useState(false)

  async function handleLogout() {
    await logout()
    await navigate({ to: '/login' })
  }

  function saveReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReservationOpen(false)
    setNotice(true)
  }

  return (
    <div className="min-h-screen bg-muted/30 lg:grid lg:grid-cols-[248px_1fr]">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="flex w-[248px] flex-col bg-sidebar p-0 text-sidebar-foreground sm:max-w-[248px] lg:hidden"
        >
          <SheetTitle className="sr-only">Navegación principal</SheetTitle>
          <SheetDescription className="sr-only">
            Accesos a las áreas de operación.
          </SheetDescription>
          <SidebarContent
            activeNav={currentPath}
            user={user}
            onLogout={handleLogout}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarContent
          activeNav={currentPath}
          onNavigate={() => {}}
          onLogout={handleLogout}
          user={user}
        />
      </aside>

      <main className="min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-6 xl:px-8">
          <Button
            size="icon"
            variant="outline"
            className="lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu aria-hidden="true" />
          </Button>
          <div className="hidden max-w-md flex-1 md:block">
            <Input
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
              size="icon"
              className="sm:hidden"
              onClick={() => setReservationOpen(true)}
              aria-label="Nueva reserva"
            >
              <Plus />
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

        <div className="mx-auto max-w-[1600px] w-full p-4 md:p-6 xl:p-8 flex-1">
          {notice && (
            <div className="relative mb-5">
              <Alert>
                <CheckCircle2 className="size-5 text-primary" />
                <AlertDescription>
                  Reserva creada correctamente.
                </AlertDescription>
              </Alert>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setNotice(false)}
                aria-label="Cerrar aviso"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}

          {children}

          <Dialog open={reservationOpen} onOpenChange={setReservationOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva reserva</DialogTitle>
                <DialogDescription>
                  Los horarios se validarán antes de guardar.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={saveReservation}
                className="grid gap-4 sm:grid-cols-2"
              >
                <label className="grid gap-2 text-sm font-medium sm:col-span-2">
                  Cliente
                  <Input
                    required
                    name="customer"
                    autoComplete="name"
                    defaultValue="Andrea Rojas"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Cancha
                  <Select name="court" defaultValue="court-1">
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una cancha" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="court-1">Cancha 1</SelectItem>
                      <SelectItem value="court-2">Cancha 2</SelectItem>
                      <SelectItem value="court-3">Cancha 3</SelectItem>
                      <SelectItem value="court-4">Cancha 4</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Fecha
                  <Input type="date" name="date" defaultValue="2026-07-17" />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Inicio
                  <Input
                    type="time"
                    name="startTime"
                    step="1800"
                    defaultValue="16:00"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Fin
                  <Input
                    type="time"
                    name="endTime"
                    step="1800"
                    defaultValue="17:30"
                  />
                </label>
                <div className="flex items-center justify-between rounded-lg bg-muted p-3 sm:col-span-2">
                  <span className="text-sm text-muted-foreground">
                    Cotización estimada
                  </span>
                  <span className="font-bold">S/ 90.00</span>
                </div>
                <div className="sm:col-span-2">
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setReservationOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit">Crear reserva</Button>
                  </DialogFooter>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  )
}
