import { randomUUID, createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import type { ZodType } from 'zod'
import { z } from 'zod'

import {
  categories,
  products,
  sales,
  saleItems,
  payments,
  stockMovements,
  idempotencyKeys,
  auditLogs,
} from '@/db/schema'
import { db } from '@/lib/db.server'
import {
  assertSameOrigin,
  requireRole,
  requireSession,
} from '@/lib/auth.server'
import { AppError, validationError } from '@/lib/errors'
import {
  createCategorySchema,
  createProductSchema,
  updateProductSchema,
  createSaleSchema,
  recordStockAdjustmentSchema,
} from './kiosk.schema'

const kioskErrorMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      if (error instanceof AppError) throw error
      const requestId = randomUUID()
      console.error('kiosk server function failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        requestId,
      })
      throw new AppError(
        'INTERNAL_ERROR',
        'Operación de quiosco fallida',
        {},
        requestId,
      )
    }
  },
)

function parseInput<T>(schema: ZodType<T>, data: unknown) {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    throw validationError({ form: ['Revisa los datos ingresados'] })
  }
  return parsed.data
}

export const listCategories = createServerFn({ method: 'GET' })
  .middleware([kioskErrorMiddleware])
  .handler(async () => {
    await requireSession()
    const result = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(categories.name)
    return { categories: result }
  })

export const createCategory = createServerFn({ method: 'POST' })
  .middleware([kioskErrorMiddleware])
  .validator((data) => parseInput(createCategorySchema, data))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin', 'operator'])

    const newCategory = {
      id: randomUUID(),
      name: data.name.trim(),
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const requestId = randomUUID()
    await db.transaction(async (tx) => {
      tx.insert(categories).values(newCategory).run()
      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'category.create',
          entityType: 'category',
          entityId: newCategory.id,
          afterJson: JSON.stringify(newCategory),
          createdAt: Date.now(),
          requestId,
        })
        .run()
    })

    return { category: newCategory }
  })

export const listProducts = createServerFn({ method: 'GET' })
  .middleware([kioskErrorMiddleware])
  .handler(async () => {
    await requireSession()
    const result = await db
      .select({
        product: products,
        categoryName: categories.name,
      })
      .from(products)
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.isActive, true))
      .orderBy(products.name)
    return {
      products: result.map((r) => ({
        ...r.product,
        categoryName: r.categoryName,
      })),
    }
  })

export const createProduct = createServerFn({ method: 'POST' })
  .middleware([kioskErrorMiddleware])
  .validator((data) => parseInput(createProductSchema, data))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin', 'operator'])

    const now = Date.now()
    const newProduct = {
      id: randomUUID(),
      categoryId: data.categoryId,
      sku: data.sku?.trim() || null,
      name: data.name.trim(),
      salePriceCents: data.salePriceCents,
      lowStockThreshold: data.lowStockThreshold,
      currentStock: data.initialStock,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }

    const requestId = randomUUID()
    await db.transaction(async (tx) => {
      tx.insert(products).values(newProduct).run()

      if (data.initialStock > 0) {
        const movement = {
          id: randomUUID(),
          productId: newProduct.id,
          type: 'initial' as const,
          quantityDelta: data.initialStock,
          quantityAfter: data.initialStock,
          createdBy: session.user.id,
          createdAt: now,
          reason: 'Inventario inicial',
        }
        tx.insert(stockMovements).values(movement).run()
      }

      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'product.create',
          entityType: 'product',
          entityId: newProduct.id,
          afterJson: JSON.stringify(newProduct),
          createdAt: now,
          requestId,
        })
        .run()
    })

    return { product: newProduct }
  })

export const updateProduct = createServerFn({ method: 'POST' })
  .middleware([kioskErrorMiddleware])
  .validator((data) => parseInput(updateProductSchema, data))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin', 'operator'])

    const now = Date.now()
    const existing = await db
      .select()
      .from(products)
      .where(and(eq(products.id, data.id), eq(products.isActive, true)))
      .get()

    if (!existing) {
      throw new AppError('PRODUCT_NOT_FOUND', 'El producto no existe')
    }

    const updated = {
      ...existing,
      categoryId: data.categoryId,
      sku: data.sku?.trim() || null,
      name: data.name.trim(),
      salePriceCents: data.salePriceCents,
      lowStockThreshold: data.lowStockThreshold,
      updatedAt: now,
    }

    const requestId = randomUUID()
    await db.transaction(async (tx) => {
      tx.update(products)
        .set({
          categoryId: updated.categoryId,
          sku: updated.sku,
          name: updated.name,
          salePriceCents: updated.salePriceCents,
          lowStockThreshold: updated.lowStockThreshold,
          updatedAt: now,
        })
        .where(eq(products.id, data.id))
        .run()

      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'product.update',
          entityType: 'product',
          entityId: data.id,
          beforeJson: JSON.stringify(existing),
          afterJson: JSON.stringify(updated),
          createdAt: now,
          requestId,
        })
        .run()
    })

    return { product: updated }
  })

export const recordStockAdjustment = createServerFn({ method: 'POST' })
  .middleware([kioskErrorMiddleware])
  .validator((data) => parseInput(recordStockAdjustmentSchema, data))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin', 'operator'])

    const now = Date.now()
    const requestId = randomUUID()

    const result = await db.transaction(async (tx) => {
      const prod = tx
        .select()
        .from(products)
        .where(and(eq(products.id, data.productId), eq(products.isActive, true)))
        .get()

      if (!prod) {
        throw new AppError('PRODUCT_NOT_FOUND', 'Producto no encontrado')
      }

      const nextStock = prod.currentStock + data.quantityDelta
      if (nextStock < 0) {
        throw new AppError(
          'INSUFFICIENT_STOCK',
          'El ajuste resultaría en stock negativo',
        )
      }

      tx.update(products)
        .set({ currentStock: nextStock, updatedAt: now })
        .where(eq(products.id, data.productId))
        .run()

      const movement = {
        id: randomUUID(),
        productId: data.productId,
        type: data.type,
        quantityDelta: data.quantityDelta,
        quantityAfter: nextStock,
        reason: data.reason || 'Ajuste manual de inventario',
        createdBy: session.user.id,
        createdAt: now,
      }
      tx.insert(stockMovements).values(movement).run()

      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'stock.adjustment',
          entityType: 'product',
          entityId: data.productId,
          afterJson: JSON.stringify(movement),
          createdAt: now,
          requestId,
        })
        .run()

      return { nextStock }
    })

    return result
  })

export const createSale = createServerFn({ method: 'POST' })
  .middleware([kioskErrorMiddleware])
  .validator((data) => parseInput(createSaleSchema, data))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin', 'operator'])

    const now = Date.now()
    const { items, paymentMethod, paymentReference, idempotencyKey } = data
    const requestId = randomUUID()

    const requestHash = createHash('sha256')
      .update(JSON.stringify({ ...data, idempotencyKey: undefined }))
      .digest('hex')

    const result = await db.transaction(async (tx) => {
      // 1. Check idempotency
      const existingKey = tx
        .select()
        .from(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.scope, 'kiosk.sale.create'),
            eq(idempotencyKeys.actorUserId, session.user.id),
            eq(idempotencyKeys.key, idempotencyKey),
          ),
        )
        .get()

      if (existingKey) {
        if (existingKey.status === 'completed' && existingKey.resultEntityId) {
          return { saleId: existingKey.resultEntityId }
        }
        throw new AppError(
          'IDEMPOTENCY_CONFLICT',
          'Esta venta ya está en proceso de creación',
        )
      }

      // Lock idempotency key
      const keyId = randomUUID()
      tx.insert(idempotencyKeys)
        .values({
          id: keyId,
          scope: 'kiosk.sale.create',
          actorUserId: session.user.id,
          key: idempotencyKey,
          requestHash,
          status: 'processing',
          createdAt: now,
        })
        .run()

      // 2. Fetch products and check stock availability
      let totalAmountCents = 0
      const validatedItems = []

      for (const item of items) {
        const prod = tx
          .select()
          .from(products)
          .where(and(eq(products.id, item.productId), eq(products.isActive, true)))
          .get()

        if (!prod) {
          throw new AppError(
            'PRODUCT_NOT_FOUND',
            `Producto con ID ${item.productId} no encontrado`,
          )
        }

        if (prod.currentStock < item.quantity) {
          throw new AppError(
            'INSUFFICIENT_STOCK',
            `Stock insuficiente para ${prod.name}. Stock actual: ${prod.currentStock}, pedido: ${item.quantity}`,
          )
        }

        const lineTotal = prod.salePriceCents * item.quantity
        totalAmountCents += lineTotal

        validatedItems.push({
          product: prod,
          quantity: item.quantity,
          lineTotal,
        })
      }

      // 3. Create Sale
      const saleId = randomUUID()
      const newSale = {
        id: saleId,
        totalAmountCents,
        status: 'completed' as const,
        soldAt: now,
        createdBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      }
      tx.insert(sales).values(newSale).run()

      // 4. Create Sale Items, update stock and create stock movements
      for (const validated of validatedItems) {
        const itemId = randomUUID()
        const saleItem = {
          id: itemId,
          saleId,
          productId: validated.product.id,
          productNameSnapshot: validated.product.name,
          unitPriceCents: validated.product.salePriceCents,
          quantity: validated.quantity,
          lineTotalCents: validated.lineTotal,
        }
        tx.insert(saleItems).values(saleItem).run()

        const nextStock = validated.product.currentStock - validated.quantity
        tx.update(products)
          .set({ currentStock: nextStock, updatedAt: now })
          .where(eq(products.id, validated.product.id))
          .run()

        const movement = {
          id: randomUUID(),
          productId: validated.product.id,
          type: 'sale' as const,
          quantityDelta: -validated.quantity,
          quantityAfter: nextStock,
          saleId,
          reason: `Venta quiosco #${saleId.slice(0, 8)}`,
          createdBy: session.user.id,
          createdAt: now,
        }
        tx.insert(stockMovements).values(movement).run()
      }

      // 5. Create Payment
      const paymentId = randomUUID()
      const payment = {
        id: paymentId,
        saleId,
        amountCents: totalAmountCents,
        method: paymentMethod,
        status: 'paid' as const,
        reference: paymentReference || null,
        paidAt: now,
        receivedBy: session.user.id,
        createdAt: now,
        updatedAt: now,
      }
      tx.insert(payments).values(payment).run()

      // 6. Record Audit Log
      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'kiosk.sale.create',
          entityType: 'sale',
          entityId: saleId,
          afterJson: JSON.stringify({ sale: newSale, payment }),
          createdAt: now,
          requestId,
        })
        .run()

      // 7. Update Idempotency Key
      tx.update(idempotencyKeys)
        .set({
          status: 'completed',
          resultEntityId: saleId,
          completedAt: now,
        })
        .where(eq(idempotencyKeys.id, keyId))
        .run()

      return { saleId }
    })

    return result
  })

export const voidSale = createServerFn({ method: 'POST' })
  .middleware([kioskErrorMiddleware])
  .validator((data) => parseInput(z.object({ id: z.string().uuid() }), data))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const session = await requireSession()
    requireRole(session.user, ['admin']) // Admin only to void sales

    const now = Date.now()
    const requestId = randomUUID()

    await db.transaction(async (tx) => {
      const sale = tx
        .select()
        .from(sales)
        .where(eq(sales.id, data.id))
        .get()

      if (!sale) {
        throw new AppError('SALE_NOT_FOUND', 'Venta no encontrada')
      }

      if (sale.status === 'voided') {
        return
      }

      // Mark sale as voided
      tx.update(sales)
        .set({ status: 'voided', updatedAt: now })
        .where(eq(sales.id, data.id))
        .run()

      // Void related payment
      tx.update(payments)
        .set({
          status: 'voided',
          voidReason: 'Anulación de venta quiosco',
          updatedAt: now,
        })
        .where(eq(payments.saleId, data.id))
        .run()

      // Revert product stocks and record revert movements
      const items = tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, data.id))
        .all()

      for (const item of items) {
        const prod = tx
          .select()
          .from(products)
          .where(eq(products.id, item.productId))
          .get()

        if (prod) {
          const nextStock = prod.currentStock + item.quantity
          tx.update(products)
            .set({ currentStock: nextStock, updatedAt: now })
            .where(eq(products.id, item.productId))
            .run()

          tx.insert(stockMovements)
            .values({
              id: randomUUID(),
              productId: item.productId,
              type: 'void' as const,
              quantityDelta: item.quantity,
              quantityAfter: nextStock,
              saleId: data.id,
              reason: `Anulación de venta #${data.id.slice(0, 8)}`,
              createdBy: session.user.id,
              createdAt: now,
            })
            .run()
        }
      }

      // Audit Log
      tx.insert(auditLogs)
        .values({
          id: randomUUID(),
          actorUserId: session.user.id,
          action: 'kiosk.sale.void',
          entityType: 'sale',
          entityId: data.id,
          createdAt: now,
          requestId,
        })
        .run()
    })
  })
