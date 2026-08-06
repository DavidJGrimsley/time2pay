export class BillingError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

export function billingErrorResponse(error: unknown): Response {
  if (error instanceof BillingError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error('Billing route failed:', error);
  return Response.json(
    { error: 'Billing request failed.', code: 'billing_internal_error' },
    { status: 500 },
  );
}