export type ErrorCode =
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_ROUTE'
  | 'NO_QUOTE'
  | 'RATE_LIMITED'
  | 'UPSTREAM_FAILURE'
  | 'UPSTREAM_TIMEOUT'
  | 'AUTH_REQUIRED'
  | 'INVALID_RESPONSE';
export class QuoteError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status = 400,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'QuoteError';
  }
}
export function errorResponse(error: unknown): Response {
  const e =
    error instanceof QuoteError
      ? error
      : new QuoteError('UPSTREAM_FAILURE', 'Unexpected server error. Please try again.', 500);
  return Response.json(
    { error: { code: e.code, message: e.message, retryAfter: e.retryAfter } },
    {
      status: e.status,
      headers: {
        'Cache-Control': 'no-store',
        ...(e.retryAfter !== undefined ? { 'Retry-After': String(e.retryAfter) } : {}),
      },
    },
  );
}
