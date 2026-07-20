import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import {
  Store,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Printer,
  ChevronRight,
  Sparkles,
} from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
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
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getCurrentUser } from '@/features/auth/auth'
import {
  listCategories,
  listProducts,
  createSale,
} from '@/features/kiosk/kiosk'

export const Route = createFileRoute('/kiosk')({
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
    const [catRes, prodRes] = await Promise.all([
      listCategories(),
      listProducts(),
    ])
    return {
      categories: catRes.categories,
      products: prodRes.products,
    }
  },
  component: KioskPage,
})

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

interface CartItem {
  id: string
  name: string
  priceCents: number
  quantity: number
  maxStock: number
}

function KioskPage() {
  const { categories, products } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()

  const [activeCategoryId, setActiveCategoryId] = useState<string>('all')
  const [cart, setCart] = useState<CartItem[]>([])
  
  // Checkout Modal states
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [method, setMethod] = useState<'cash' | 'yape' | 'plin' | 'bank_transfer'>('cash')
  const [reference, setReference] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Success Receipt states
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [lastSaleId, setLastSaleId] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => window.crypto.randomUUID())

  const canOperate = user.role !== 'viewer'

  function addToCart(product: typeof products[number]) {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        if (existing.quantity >= product.currentStock) return prev
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          priceCents: product.salePriceCents,
          quantity: 1,
          maxStock: product.currentStock,
        },
      ]
    })
  }

  function updateQuantity(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const nextQty = item.quantity + delta
            if (nextQty <= 0) return null
            if (nextQty > item.maxStock) return item
            return { ...item, quantity: nextQty }
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null),
    )
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((item) => item.id !== id))
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.priceCents * item.quantity, 0)

  const filteredProducts = activeCategoryId === 'all'
    ? products
    : products.filter((p) => p.categoryId === activeCategoryId)

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault()
    if (cart.length === 0) return
    setPending(true)
    setError(null)
    try {
      const res = await createSale({
        data: {
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          paymentMethod: method,
          paymentReference: reference.trim() || undefined,
          idempotencyKey,
        },
      })
      setLastSaleId(res.saleId)
      setCheckoutOpen(false)
      setReceiptOpen(true)
      setCart([])
      setReference('')
      setIdempotencyKey(window.crypto.randomUUID()) // Rotate key
      router.invalidate()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo registrar la venta',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <DashboardLayout user={user}>
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Negocio Core · Operación
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Store className="size-6 text-primary" aria-hidden />
            Quiosco
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Punto de venta táctil rápido para bebidas, snacks y accesorios.
          </p>
        </div>
      </section>

      {/* Category Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        <Button
          variant={activeCategoryId === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveCategoryId('all')}
        >
          Todos los productos
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={activeCategoryId === cat.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategoryId(cat.id)}
          >
            {cat.name}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left Side: Product Grid */}
        <div>
          {filteredProducts.length === 0 ? (
            <Card className="py-20 text-center">
              <CardContent className="text-muted-foreground">
                No hay productos en esta categoría o el catálogo está vacío.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.currentStock <= 0
                const inCart = cart.find((item) => item.id === p.id)
                const isMaxed = inCart && inCart.quantity >= p.currentStock
                const isNearLimit = p.currentStock <= p.lowStockThreshold

                return (
                  <Card
                    key={p.id}
                    className={`flex flex-col justify-between overflow-hidden shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isOutOfStock ? 'opacity-60 bg-muted/30' : ''}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="outline" className="text-[0.65rem] px-2 py-0 border-primary/20 bg-primary/5">
                          {p.categoryName}
                        </Badge>
                        {isOutOfStock ? (
                          <Badge variant="secondary" className="text-[0.65rem] px-2 py-0 bg-red-500/10 text-red-600 border-red-500/20">
                            Agotado
                          </Badge>
                        ) : isNearLimit ? (
                          <Badge variant="outline" className="text-[0.65rem] px-2 py-0 bg-amber-500/5 text-amber-600 border-amber-500/20">
                            Poco stock: {p.currentStock}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[0.65rem] px-2 py-0 bg-green-500/5 text-green-600 border-green-500/20">
                            Stock: {p.currentStock}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-bold mt-2 leading-tight">
                        {p.name}
                      </CardTitle>
                    </CardHeader>
                    <CardFooter className="pt-2 flex items-center justify-between border-t bg-muted/5">
                      <span className="font-extrabold text-base text-foreground tabular-nums">
                        {formatMoney(p.salePriceCents)}
                      </span>
                      {canOperate ? (
                        <Button
                          size="sm"
                          disabled={isOutOfStock || isMaxed}
                          onClick={() => addToCart(p)}
                          className="gap-1.5"
                        >
                          <Plus className="size-3.5" />
                          Agregar
                        </Button>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Solo lectura
                        </Badge>
                      )}
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Side: Shopping Cart */}
        <Card className="h-fit sticky top-6 shadow-sm border-2">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between bg-muted/10">
            <div className="flex items-center gap-2">
              <ShoppingCart className="size-5 text-primary" />
              <CardTitle className="text-base font-bold">Carrito de Compras</CardTitle>
            </div>
            <Badge variant="default" className="tabular-nums">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} ítems
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {cart.length === 0 ? (
              <div className="py-24 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                <ShoppingCart className="size-8 text-muted-foreground/30" />
                <span>Tu carrito está vacío.</span>
                <span className="text-xs text-muted-foreground/60 max-w-[200px]">
                  Haz clic en "Agregar" en los productos para iniciar.
                </span>
              </div>
            ) : (
              <div className="divide-y max-h-[350px] overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 tabular-nums">
                        {formatMoney(item.priceCents)} c/u
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-7"
                        onClick={() => updateQuantity(item.id, -1)}
                      >
                        <Minus className="size-3" />
                      </Button>
                      <span className="w-8 text-center font-bold text-sm tabular-nums">
                        {item.quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-7"
                        onClick={() => updateQuantity(item.id, 1)}
                        disabled={item.quantity >= item.maxStock}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold tabular-nums">
                        {formatMoney(item.priceCents * item.quantity)}
                      </p>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-xs text-muted-foreground hover:text-red-500 transition-colors mt-0.5"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          {cart.length > 0 && (
            <CardFooter className="flex-col border-t p-4 bg-muted/15">
              <div className="flex justify-between items-center w-full mb-4">
                <span className="text-sm text-muted-foreground font-medium">TOTAL A PAGAR</span>
                <span className="text-xl font-black text-foreground tabular-nums">
                  {formatMoney(cartTotal)}
                </span>
              </div>
              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  onClick={() => setCart([])}
                  className="flex-1 gap-1.5"
                >
                  <Trash2 className="size-4" />
                  Vaciar
                </Button>
                <Button
                  onClick={() => setCheckoutOpen(true)}
                  disabled={!canOperate}
                  className="flex-1 gap-1.5"
                >
                  Cobrar
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>

      {/* Checkout Payment Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Venta</DialogTitle>
            <DialogDescription>
              Confirma los detalles del pago para finalizar la transacción del quiosco.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCheckout} className="grid gap-4 mt-2">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="rounded-lg bg-muted p-4 text-sm flex justify-between items-center border font-mono">
              <span>Monto total:</span>
              <span className="font-black text-lg text-primary">{formatMoney(cartTotal)}</span>
            </div>

            <label className="grid gap-2 text-sm font-medium">
              Método de Pago
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
              >
                <option value="cash">Efectivo</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="bank_transfer">Transferencia bancaria</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm font-medium">
              Referencia / Código de Operación (opcional)
              <Input
                placeholder="Ej. Nro de Yape o Transf."
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setCheckoutOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Registrando…' : 'Completar Venta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Success Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-green-500" />
              ¡Venta Exitosa!
            </DialogTitle>
            <DialogDescription>
              La venta ha sido registrada con éxito en el sistema.
            </DialogDescription>
          </DialogHeader>

          {lastSaleId && (
            <div className="border-t border-b border-dashed py-4 my-2 text-sm grid gap-2 font-mono">
              <div className="flex justify-between">
                <span>ESTABLECIMIENTO:</span>
                <span className="font-bold">CanchasApp Admin</span>
              </div>
              <div className="flex justify-between">
                <span>VENTA ID:</span>
                <span>#{lastSaleId.slice(0, 8)}</span>
              </div>
              <div className="flex justify-between">
                <span>METODO PAGO:</span>
                <span>{methodLabels[method]}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-dashed pt-2 mt-2">
                <span>TOTAL RECAUDADO:</span>
                <span className="text-green-600 dark:text-green-400">
                  {formatMoney(cartTotal)}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.print()}
              className="gap-2"
            >
              <Printer className="size-4" />
              Imprimir ticket
            </Button>
            <Button type="button" onClick={() => setReceiptOpen(false)}>
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
