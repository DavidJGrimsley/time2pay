import { ZodError } from 'zod';

export type DbErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'internal';

export class DbRouteError extends Error {
  readonly code: DbErrorCode;
  readonly details?: unknown;

  constructor(code: DbErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DbRouteError';
    this.code = code;
    this.details = details;
  }
}

export function unauthorized(message = 'Authentication is required.'): DbRouteError {
  return new DbRouteError('unauthorized', message);
}

export function forbidden(message = 'You do not have permission to perform this action.'): DbRouteError {
  return new DbRouteError('forbidden', message);
}

export function notFound(message = 'Requested resource was not found.'): DbRouteError {
  return new DbRouteError('not_found', message);
}

export function conflict(message: string): DbRouteError {
  return new DbRouteError('conflict', message);
}

export function validation(message: string, details?: unknown): DbRouteError {
  return new DbRouteError('validation', message, details);
}

export function internal(message = 'Internal server error.'): DbRouteError {
  return new DbRouteError('internal', message);
}

export function toDbRouteError(error: unknown): DbRouteError {
  if (error instanceof DbRouteError) {
    return error;
  }

  if (error instanceof ZodError) {
    return validation(error.issues[0]?.message ?? 'Invalid request payload.', error.issues);
  }

  if (error instanceof Error) {
    return internal(error.message);
  }

  return internal();
}

export function dbRouteErrorStatus(error: DbRouteError): number {
  switch (error.code) {
    case 'unauthorized':
      return 401;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'conflict':
      return 409;
    case 'validation':
      return 422;
    case 'internal':
    default:
      return 500;
  }
}

export function dbRouteErrorResponse(error: DbRouteError): Response {
  return Response.json(
    {
      error: error.message,
      code: error.code,
    },
    { status: dbRouteErrorStatus(error) },
  );
}
