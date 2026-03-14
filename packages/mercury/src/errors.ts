export type MercuryErrorContext = {
  method: string;
  path: string;
  status?: number;
  details?: unknown;
};

export class MercuryApiError extends Error {
  readonly method: string;
  readonly path: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(message: string, context: MercuryErrorContext) {
    super(message);
    this.name = 'MercuryApiError';
    this.method = context.method;
    this.path = context.path;
    this.status = context.status;
    this.details = context.details;
  }
}

export class MercuryAuthError extends MercuryApiError {
  constructor(message: string, context: MercuryErrorContext) {
    super(message, context);
    this.name = 'MercuryAuthError';
  }
}

export class MercuryRateLimitError extends MercuryApiError {
  constructor(message: string, context: MercuryErrorContext) {
    super(message, context);
    this.name = 'MercuryRateLimitError';
  }
}

export class MercuryValidationError extends MercuryApiError {
  constructor(message: string, context: MercuryErrorContext) {
    super(message, context);
    this.name = 'MercuryValidationError';
  }
}

export function createMercuryApiError(input: {
  message: string;
  method: string;
  path: string;
  status?: number;
  details?: unknown;
}): MercuryApiError {
  const context = {
    method: input.method,
    path: input.path,
    status: input.status,
    details: input.details,
  };

  if (input.status === 401 || input.status === 403) {
    return new MercuryAuthError(input.message, context);
  }

  if (input.status === 429) {
    return new MercuryRateLimitError(input.message, context);
  }

  if (input.status === 400 || input.status === 404 || input.status === 409 || input.status === 422) {
    return new MercuryValidationError(input.message, context);
  }

  return new MercuryApiError(input.message, context);
}
