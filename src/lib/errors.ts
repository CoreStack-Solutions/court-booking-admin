import { randomUUID } from 'node:crypto'

export const errorCodes = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'USER_ALREADY_EXISTS',
  'USER_NOT_FOUND',
  'USER_INACTIVE',
  'LAST_ADMIN_REQUIRED',
  'SESSION_EXPIRED',
  'RATE_LIMITED',
  'COURT_NOT_FOUND',
  'COURT_HOURS_CONFLICT',
  'CUSTOMER_NOT_FOUND',
  'RESERVATION_NOT_FOUND',
  'RESERVATION_CONFLICT',
  'RESERVATION_STATE_INVALID',
  'IDEMPOTENCY_KEY_REUSED',
  'INTERNAL_ERROR',
] as const

export type ErrorCode = (typeof errorCodes)[number]

export class AppError extends Error {
  readonly code: ErrorCode
  readonly details: Record<string, unknown>
  readonly requestId: string

  constructor(
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {},
    requestId: string = randomUUID(),
  ) {
    super(message)
    this.name = 'AppError'
    this.stack = undefined
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

export function validationError(
  details: Record<string, unknown>,
  requestId?: string,
) {
  return new AppError(
    'VALIDATION_ERROR',
    'Revisa los datos ingresados',
    details,
    requestId,
  )
}

export function toAppError(error: unknown, requestId = randomUUID()) {
  if (error instanceof AppError) return error

  return new AppError(
    'INTERNAL_ERROR',
    'No se pudo completar la solicitud',
    {},
    requestId,
  )
}
