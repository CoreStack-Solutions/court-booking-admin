import { useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputPassword } from '@/components/ui/input-password'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { getAuthErrorCode, login } from '@/features/auth/auth'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: LoginPage,
})

function safeRedirect(value: string | undefined) {
  if (!value) return '/'
  try {
    const destination = new URL(value, window.location.origin)
    if (destination.origin !== window.location.origin) return '/'
    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return '/'
  }
}

function LoginPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const destination = safeRedirect(search.redirect)

    try {
      await login({
        data: {
          email: formData.email,
          password: formData.password,
        },
      })
      await navigate({ href: destination })
    } catch (caughtError) {
      setError(
        getAuthErrorCode(caughtError) === 'RATE_LIMITED'
          ? 'Demasiados intentos. Prueba más tarde.'
          : 'El correo o la contraseña no son válidos',
      )
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
            <img src="/images/logo-white.png" alt="CanchasApp Logo" className="h-16 w-auto object-contain" />
          </div>
          <div className="space-y-4 text-primary-foreground">
            <div className="text-2xl font-bold">
              Bienvenido a CanchasApp
            </div>
            <p className="text-primary-foreground/80 max-w-md">
              Inicia sesión para acceder a tu cuenta y comenzar a
              gestionar tus canchas y reservas.
            </p>
          </div>
        </div>
      </div>

      {/* Panel del formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-card rounded-2xl shadow-sm border border-border p-8 sm:p-10">
          <div className="text-center mb-8 space-y-4">
            <div className="flex justify-center">
              <img src="/images/canchasapp_logo.png" alt="CanchasApp Logo" className="h-16 w-auto object-contain" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">
                Bienvenido de nuevo
              </h1>
              <p className="text-sm text-muted-foreground">
                Ingresa tus credenciales para acceder a la operación de CanchasApp
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
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
                    setFormData((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground">
                    Contraseña
                  </Label>
                </div>
                <InputPassword
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="remember-me"
                  checked={formData.rememberMe}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      rememberMe: checked,
                    }))
                  }
                />
                <Label
                  htmlFor="remember-me"
                  className="text-sm text-muted-foreground"
                >
                  Recordar mi sesión
                </Label>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={pending}
            >
              {pending ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              ¿No tienes una cuenta?{' '}
              <Link
                to="/register"
                className="font-medium text-primary hover:text-primary/80"
              >
                Regístrate aquí
              </Link>
            </p>
          </div>

          <div className="mt-8 border-t border-border pt-6">
            <p className="text-xs text-center text-muted-foreground">
              © {new Date().getFullYear()} CanchasApp. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
