import { useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import {
  Package,
  Plus,
  Edit,
  ArrowUpDown,
  AlertTriangle,
  FolderPlus,
  Search,
} from 'lucide-react'

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
import { Input } from '@/components/ui/input'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { getCurrentUser } from '@/features/auth/auth'
import {
  listCategories,
  listProducts,
  createCategory,
  createProduct,
  updateProduct,
  recordStockAdjustment,
} from '@/features/kiosk/kiosk'

export const Route = createFileRoute('/inventory')({
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
  component: InventoryPage,
})

function formatMoney(amountCents: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(amountCents / 100)
}

function InventoryPage() {
  const { categories, products } = Route.useLoaderData()
  const { user } = Route.useRouteContext()
  const router = useRouter()

  const [q, setQ] = useState('')
  const canOperate = user.role !== 'viewer'

  // Modals visibility states
  const [catOpen, setCatOpen] = useState(false)
  const [prodOpen, setProdOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)

  // Selected entities for edit/adjustment
  const [selectedProduct, setSelectedProduct] = useState<typeof products[number] | null>(null)

  // Loading/Error states
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Category creation states
  const [catName, setCatName] = useState('')

  // Product creation/edit states
  const [prodCategoryId, setProdCategoryId] = useState(categories[0]?.id || '')
  const [prodSku, setProdSku] = useState('')
  const [prodName, setProdName] = useState('')
  const [prodPrice, setProdPrice] = useState('')
  const [prodThreshold, setProdThreshold] = useState('0')
  const [prodInitialStock, setProdInitialStock] = useState('0')

  // Stock adjustment states
  const [adjDelta, setAdjDelta] = useState('1')
  const [adjReason, setAdjReason] = useState('')

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await createCategory({ data: { name: catName.trim() } })
      setCatName('')
      setCatOpen(false)
      router.invalidate()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo crear la categoría',
      )
    } finally {
      setPending(false)
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const priceCents = Math.round(parseFloat(prodPrice) * 100)
      if (Number.isNaN(priceCents) || priceCents < 0) {
        throw new Error('Precio inválido')
      }

      await createProduct({
        data: {
          categoryId: prodCategoryId,
          sku: prodSku.trim() || undefined,
          name: prodName.trim(),
          salePriceCents: priceCents,
          lowStockThreshold: parseInt(prodThreshold) || 0,
          initialStock: parseInt(prodInitialStock) || 0,
        },
      })

      // Reset
      setProdSku('')
      setProdName('')
      setProdPrice('')
      setProdThreshold('0')
      setProdInitialStock('0')
      setProdOpen(false)
      router.invalidate()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo crear el producto',
      )
    } finally {
      setPending(false)
    }
  }

  async function handleUpdateProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProduct) return
    setPending(true)
    setError(null)
    try {
      const priceCents = Math.round(parseFloat(prodPrice) * 100)
      if (Number.isNaN(priceCents) || priceCents < 0) {
        throw new Error('Precio inválido')
      }

      await updateProduct({
        data: {
          id: selectedProduct.id,
          categoryId: prodCategoryId,
          sku: prodSku.trim() || undefined,
          name: prodName.trim(),
          salePriceCents: priceCents,
          lowStockThreshold: parseInt(prodThreshold) || 0,
        },
      })

      setEditOpen(false)
      setSelectedProduct(null)
      router.invalidate()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo actualizar el producto',
      )
    } finally {
      setPending(false)
    }
  }

  async function handleAdjustStock(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedProduct) return
    setPending(true)
    setError(null)
    try {
      const delta = parseInt(adjDelta)
      if (Number.isNaN(delta) || delta === 0) {
        throw new Error('Monto de ajuste inválido')
      }

      await recordStockAdjustment({
        data: {
          productId: selectedProduct.id,
          type: 'adjustment',
          quantityDelta: delta,
          reason: adjReason.trim() || undefined,
        },
      })

      setAdjDelta('1')
      setAdjReason('')
      setAdjustOpen(false)
      setSelectedProduct(null)
      router.invalidate()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'No se pudo ajustar el inventario',
      )
    } finally {
      setPending(false)
    }
  }

  function startEdit(p: typeof products[number]) {
    setSelectedProduct(p)
    setProdCategoryId(p.categoryId)
    setProdSku(p.sku || '')
    setProdName(p.name)
    setProdPrice((p.salePriceCents / 100).toString())
    setProdThreshold(p.lowStockThreshold.toString())
    setEditOpen(true)
  }

  function startAdjust(p: typeof products[number]) {
    setSelectedProduct(p)
    setAdjustOpen(true)
  }

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      p.categoryName.toLowerCase().includes(q.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(q.toLowerCase())),
  )

  const outOfStockCount = products.filter((p) => p.currentStock === 0).length
  const lowStockCount = products.filter(
    (p) => p.currentStock > 0 && p.currentStock <= p.lowStockThreshold,
  ).length

  return (
    <DashboardLayout user={user}>
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Negocio Core · Administración
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Package className="size-6 text-primary" aria-hidden />
            Inventario
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona el catálogo del quiosco, precios de venta, umbrales de alerta y niveles de stock.
          </p>
        </div>

        {canOperate && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setCatOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <FolderPlus className="size-4" />
              Nueva Categoría
            </Button>
            <Button
              onClick={() => {
                if (categories.length > 0) {
                  setProdCategoryId(categories[0].id)
                }
                setProdOpen(true)
              }}
              className="gap-2"
            >
              <Plus className="size-4" />
              Nuevo Producto
            </Button>
          </div>
        )}
      </section>

      {/* Overview Cards */}
      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase text-muted-foreground">
              Total Artículos
            </CardDescription>
            <CardTitle className="text-2xl font-black">{products.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="shadow-sm bg-amber-500/5 border-amber-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase text-amber-600/80">
              Poco Stock
            </CardDescription>
            <CardTitle className="text-2xl font-black text-amber-600">
              {lowStockCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="shadow-sm bg-red-500/5 border-red-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase text-red-600/80">
              Agotados
            </CardDescription>
            <CardTitle className="text-2xl font-black text-red-600">
              {outOfStockCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      {/* Main product management */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, SKU o categoría..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground border-t">
              No hay productos registrados en el inventario.
            </div>
          ) : (
            <div className="overflow-x-auto border-t">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="p-4">SKU</th>
                    <th className="p-4">Producto</th>
                    <th className="p-4">Categoría</th>
                    <th className="p-4">Precio</th>
                    <th className="p-4">Stock</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredProducts.map((p) => {
                    const isOutOfStock = p.currentStock === 0
                    const isLowStock = p.currentStock > 0 && p.currentStock <= p.lowStockThreshold

                    return (
                      <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4 font-mono text-xs text-muted-foreground">
                          {p.sku || '—'}
                        </td>
                        <td className="p-4 font-semibold">{p.name}</td>
                        <td className="p-4">
                          <Badge variant="secondary" className="font-normal">
                            {p.categoryName}
                          </Badge>
                        </td>
                        <td className="p-4 font-bold tabular-nums">
                          {formatMoney(p.salePriceCents)}
                        </td>
                        <td className="p-4 tabular-nums">
                          <div className="flex items-center gap-1.5">
                            {isOutOfStock ? (
                              <Badge variant="destructive" className="gap-1 px-2 py-0 text-[0.7rem]">
                                <AlertTriangle className="size-3" />
                                0 (Agotado)
                              </Badge>
                            ) : isLowStock ? (
                              <Badge variant="outline" className="gap-1 px-2 py-0 text-[0.7rem] bg-amber-500/5 text-amber-600 border-amber-500/20">
                                <AlertTriangle className="size-3" />
                                {p.currentStock} (Bajo)
                              </Badge>
                            ) : (
                              <Badge variant="success" className="px-2 py-0 text-[0.7rem]">
                                {p.currentStock}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right flex justify-end gap-1.5">
                          {canOperate ? (
                            <>
                              <Button
                                size="xs"
                                variant="outline"
                                className="gap-1"
                                onClick={() => startAdjust(p)}
                              >
                                <ArrowUpDown className="size-3" />
                                Stock
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                className="gap-1"
                                onClick={() => startEdit(p)}
                              >
                                <Edit className="size-3" />
                                Editar
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Lectura</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nueva Categoría Dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Categoría</DialogTitle>
            <DialogDescription>
              Agrega una categoría de productos para organizar tu menú del quiosco.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCategory} className="grid gap-4 mt-2">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <label className="grid gap-2 text-sm font-medium">
              Nombre de la Categoría
              <Input
                required
                placeholder="Ej. Bebidas Heladas, Snacks, Pelotas"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
            </label>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setCatOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Registrando…' : 'Crear Categoría'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Nuevo Producto Dialog */}
      <Dialog open={prodOpen} onOpenChange={setProdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Producto</DialogTitle>
            <DialogDescription>
              Registra un producto en el catálogo y define su stock inicial.
            </DialogDescription>
          </DialogHeader>
          {categories.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Debes registrar al menos una categoría primero.
            </div>
          ) : (
            <form onSubmit={handleCreateProduct} className="grid gap-4 mt-2">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">
                  Categoría
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={prodCategoryId}
                    onChange={(e) => setProdCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  SKU / Cód. Barras (opcional)
                  <Input
                    placeholder="Código identificador"
                    value={prodSku}
                    onChange={(e) => setProdSku(e.target.value)}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium">
                Nombre del Producto
                <Input
                  required
                  placeholder="Ej. Gaseosa Coca Cola 500ml"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2 text-sm font-medium">
                  Precio Venta (S/.)
                  <Input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Stock Inicial
                  <Input
                    required
                    type="number"
                    min="0"
                    placeholder="0"
                    value={prodInitialStock}
                    onChange={(e) => setProdInitialStock(e.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium">
                  Alerta Stock Mínimo
                  <Input
                    required
                    type="number"
                    min="0"
                    placeholder="0"
                    value={prodThreshold}
                    onChange={(e) => setProdThreshold(e.target.value)}
                  />
                </label>
              </div>

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setProdOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Registrando…' : 'Crear Producto'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Editar Producto Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Producto</DialogTitle>
            <DialogDescription>
              Modifica la información básica del producto catalogado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateProduct} className="grid gap-4 mt-2">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Categoría
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={prodCategoryId}
                  onChange={(e) => setProdCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                SKU / Cód. Barras (opcional)
                <Input
                  placeholder="Código identificador"
                  value={prodSku}
                  onChange={(e) => setProdSku(e.target.value)}
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium">
              Nombre del Producto
              <Input
                required
                placeholder="Ej. Gaseosa Coca Cola"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                Precio Venta (S/.)
                <Input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Alerta Stock Mínimo
                <Input
                  required
                  type="number"
                  min="0"
                  placeholder="0"
                  value={prodThreshold}
                  onChange={(e) => setProdThreshold(e.target.value)}
                />
              </label>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setEditOpen(false)
                  setSelectedProduct(null)
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Guardando…' : 'Guardar Cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ajustar Stock Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar Inventario</DialogTitle>
            <DialogDescription>
              Incrementa o reduce el stock físico actual del producto seleccionado.
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <form onSubmit={handleAdjustStock} className="grid gap-4 mt-2">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground flex flex-col gap-1 border">
                <span className="font-bold text-foreground text-sm">{selectedProduct.name}</span>
                <span>Stock Actual: <strong className="text-foreground text-sm font-black">{selectedProduct.currentStock} unidades</strong></span>
              </div>

              <label className="grid gap-2 text-sm font-medium">
                Cantidad a ajustar (usa negativo para salidas/mermas)
                <Input
                  required
                  type="number"
                  placeholder="Ej. 10 para ingresos, -2 para pérdidas"
                  value={adjDelta}
                  onChange={(e) => setAdjDelta(e.target.value)}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium">
                Motivo del Ajuste
                <Input
                  required
                  placeholder="Ej. Compra de mercadería, botella rota, etc."
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                />
              </label>

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setAdjustOpen(false)
                    setSelectedProduct(null)
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Ajustando…' : 'Aplicar Ajuste'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
