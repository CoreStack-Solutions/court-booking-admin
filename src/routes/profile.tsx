import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { User, Lock, Save, ShieldAlert, BadgeCheck } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getCurrentUser, updateProfile, changePassword } from '@/features/auth/auth'

export const Route = createFileRoute('/profile')({
  beforeLoad: async ({ location }) => {
    const current = await getCurrentUser()
    if (!current) {
      throw redirect({
        href: `/login?redirect=${encodeURIComponent(location.href)}`,
      })
    }
    return { user: current.user }
  },
  component: ProfilePage,
})

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Espectador',
}

function ProfilePage() {
  const { user } = Route.useRouteContext()
  const router = useRouter()

  // Profile Form States
  const [name, setName] = useState(user.name)
  const [profilePending, setProfilePending] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordPending, setPasswordPending] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfilePending(true)
    setProfileSuccess(null)
    setProfileError(null)
    try {
      await updateProfile({ data: { name: name.trim() } })
      setProfileSuccess('Tu perfil ha sido actualizado con éxito.')
      router.invalidate()
    } catch (caughtError) {
      setProfileError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo actualizar el perfil',
      )
    } finally {
      setProfilePending(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden.')
      return
    }
    if (newPassword.length < 12) {
      setPasswordError('La nueva contraseña debe tener al menos 12 caracteres.')
      return
    }
    setPasswordPending(true)
    setPasswordSuccess(null)
    setPasswordError(null)
    try {
      await changePassword({
        data: {
          currentPassword,
          newPassword,
        },
      })
      setPasswordSuccess('Contraseña cambiada con éxito. Por favor vuelve a iniciar sesión si se requiere re-autenticar.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (caughtError) {
      setPasswordError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo cambiar la contraseña',
      )
    } finally {
      setPasswordPending(false)
    }
  }

  return (
    <DashboardLayout user={user}>
      <section className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Negocio Core · Configuración
        </p>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
          <User className="size-6 text-primary" aria-hidden />
          Mi Perfil
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra tus datos personales y actualiza tus credenciales de acceso.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Details Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Datos de Usuario</CardTitle>
            <CardDescription>Información registrada en tu cuenta</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdateProfile}>
            <CardContent className="grid gap-4">
              {profileSuccess && (
                <Alert className="bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400">
                  <BadgeCheck className="size-4 text-green-600 shrink-0" />
                  <AlertDescription>{profileSuccess}</AlertDescription>
                </Alert>
              )}
              {profileError && (
                <Alert variant="destructive">
                  <ShieldAlert className="size-4 shrink-0" />
                  <AlertDescription>{profileError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label>Nombre Completo</Label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="grid gap-2 opacity-70">
                <Label>Correo Electrónico</Label>
                <Input
                  disabled
                  type="email"
                  value={user.email}
                  className="bg-muted cursor-not-allowed"
                />
              </div>

              <div className="grid gap-2 text-sm font-medium">
                <span>Rol Asignado</span>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground font-semibold">
                  {roleLabels[user.role]}
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button type="submit" disabled={profilePending} className="gap-2 ml-auto">
                <Save className="size-4" />
                {profilePending ? 'Guardando…' : 'Guardar Cambios'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Change Password Card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Seguridad de la Cuenta</CardTitle>
            <CardDescription>Actualiza tu contraseña de acceso periódicamente</CardDescription>
          </CardHeader>
          <form onSubmit={handleChangePassword}>
            <CardContent className="grid gap-4">
              {passwordSuccess && (
                <Alert className="bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400">
                  <BadgeCheck className="size-4 text-green-600 shrink-0" />
                  <AlertDescription>{passwordSuccess}</AlertDescription>
                </Alert>
              )}
              {passwordError && (
                <Alert variant="destructive">
                  <ShieldAlert className="size-4 shrink-0" />
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-2">
                <Label>Contraseña Actual</Label>
                <Input
                  required
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label>Nueva Contraseña</Label>
                <Input
                  required
                  type="password"
                  placeholder="Mínimo 12 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label>Confirmar Nueva Contraseña</Label>
                <Input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button type="submit" disabled={passwordPending} className="gap-2 ml-auto">
                <Lock className="size-4" />
                {passwordPending ? 'Actualizando…' : 'Cambiar Contraseña'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  )
}
