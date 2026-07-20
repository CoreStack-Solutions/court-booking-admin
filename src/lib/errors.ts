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
  'RATE_NOT_FOUND',
  'RATE_RULE_NOT_FOUND',
  'RATE_RULE_CONFLICT',
  'QUOTE_CHANGED',
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
    requestId: string = globalThis.crypto.randomUUID(),
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

export function toAppError(
  error: unknown,
  requestId = globalThis.crypto.randomUUID(),
) {
  if (error instanceof AppError) return error

  return new AppError(
    'INTERNAL_ERROR',
    'No se pudo completar la solicitud',
    {},
    requestId,
  )
}

export function getErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return undefined
  const value = error as {
    code?: unknown
    data?: { code?: unknown }
  }
  if (typeof value.code === 'string') return value.code
  return typeof value.data?.code === 'string' ? value.data.code : undefined
}
