export const paymentMethods = ['cash', 'yape', 'plin', 'bank_transfer'] as const
export type PaymentMethod = (typeof paymentMethods)[number]

export const paymentStatuses = [
  'pending',
  'paid',
  'voided',
  'refunded',
] as const
export type PaymentStatus = (typeof paymentStatuses)[number]
