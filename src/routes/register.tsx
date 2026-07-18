import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputPassword } from '@/components/ui/input-password'
import { Label } from '@/components/ui/label'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden')
      setPending(false)
      return
    }
    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      setPending(false)
      return
    }

    try {
      // TODO: Implement backend registration logic
      // await signUp({ ... })
      
      // Simulating a wait for UI purposes
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      alert('Registro no implementado en backend para usuarios públicos por ahora.')
      
      await navigate({ to: '/login' })
    } catch (caughtError) {
      setError('Ocurrió un error al intentar registrarse')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Panel lateral con imagen */}
      <div className="hidden lg:flex w-1/2 relative">
        <div
          className="absolute inset-0 bg-[url('/images/bg-auth.png')] bg-cover bg-center"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 p-12 flex flex-col justify-between h-full text-card">
          <div className="text-primary-foreground">
            <img src="/logo.png" alt="Central Padel Logo" className="h-12 w-auto object-contain" />
          </div>
          <div className="space-y-4 text-primary-foreground">
            <div className="text-2xl font-bold">
              Únete a Central Padel
            </div>
            <p className="text-primary-foreground/80 max-w-md">
              Crea tu cuenta y comienza a reservar canchas de
              manera fácil y rápida.
            </p>
          </div>
        </div>
      </div>

      {/* Panel del formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-border p-8 sm:p-10">
          <div className="text-center mb-8 space-y-4">
            <div className="flex justify-center">
              <img src="/logo.png" alt="Central Padel Logo" className="h-16 w-auto object-contain" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">
                Crear cuenta
              </h1>
              <p className="text-sm text-muted-foreground">
                Completa tus datos para registrarte
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">
                  Nombre
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="given-name"
                  required
                  placeholder="Juan"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-foreground">
                  Apellido (opcional)
                </Label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Pérez"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Correo electrónico
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="tucorreo@ejemplo.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">
                  Contraseña
                </Label>
                <InputPassword
                  id="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, password: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-foreground">
                  Confirmar contraseña
                </Label>
                <InputPassword
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Registrando...' : 'Crear cuenta'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              ¿Ya tienes una cuenta?{' '}
              <Link
                to="/login"
                className="font-medium text-primary hover:text-primary/80"
              >
                Inicia sesión
              </Link>
            </p>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-xs text-center text-muted-foreground">
              © {new Date().getFullYear()} Central Padel. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
