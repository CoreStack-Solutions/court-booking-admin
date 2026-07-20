import { z } from 'zod'

import { paymentMethods } from '@/features/payments/payments.constants'

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(100),
})

export const createProductSchema = z.object({
  categoryId: z.string().uuid('Categoría inválida'),
  sku: z.string().trim().max(50).optional(),
  name: z.string().trim().min(1, 'El nombre es requerido').max(150),
  salePriceCents: z.number().int().nonnegative('El precio no puede ser negativo'),
  lowStockThreshold: z.number().int().nonnegative('El umbral de stock bajo no puede ser negativo').default(0),
  initialStock: z.number().int().nonnegative('El stock inicial no puede ser negativo').default(0),
})

export const updateProductSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid('Categoría inválida'),
  sku: z.string().trim().max(50).optional(),
  name: z.string().trim().min(1, 'El nombre es requerido').max(150),
  salePriceCents: z.number().int().nonnegative('El precio no puede ser negativo'),
  lowStockThreshold: z.number().int().nonnegative('El umbral de stock bajo no puede ser negativo').default(0),
})

export const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
      }),
    )
    .min(1, 'Debe incluir al menos un producto'),
  paymentMethod: z.enum(paymentMethods),
  paymentReference: z.string().trim().max(100).optional(),
  idempotencyKey: z.string().uuid(),
})

export const recordStockAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  type: z.enum(['initial', 'adjustment']),
  quantityDelta: z.number().int().refine((v) => v !== 0, 'El ajuste de stock no puede ser 0'),
  reason: z.string().trim().max(250).optional(),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type CreateSaleInput = z.infer<typeof createSaleSchema>
export type RecordStockAdjustmentInput = z.infer<typeof recordStockAdjustmentSchema>
