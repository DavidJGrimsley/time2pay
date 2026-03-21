import { z, type ZodType } from 'zod';
import { requireAuthUserId } from '@/app/api/db/_shared/auth';
import { withWriteDb, type WriteDb } from '@/app/api/db/_shared/db';
import {
  dbRouteErrorResponse,
  internal,
  toDbRouteError,
  unauthorized,
  validation,
} from '@/app/api/db/_shared/errors';

function parseJsonError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Invalid payload.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Invalid payload.';
}

async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw validation('Invalid JSON request body.');
  }
  try {
    return schema.parse(body);
  } catch (error) {
    throw toDbRouteError(error);
  }
}

export async function handleDbWrite<T>(
  request: Request,
  schema: ZodType<T>,
  operation: (db: WriteDb, authUserId: string, payload: T) => Promise<void>,
): Promise<Response> {
  let authUserId: string;
  try {
    authUserId = await requireAuthUserId(request);
  } catch (error) {
    return dbRouteErrorResponse(
      unauthorized(error instanceof Error ? error.message : 'Invalid auth token.'),
    );
  }

  let payload: T;
  try {
    payload = await parseBody(request, schema);
  } catch (error) {
    const routeError =
      error instanceof z.ZodError
        ? validation(parseJsonError(error), error.issues)
        : toDbRouteError(error);
    return dbRouteErrorResponse(routeError);
  }

  try {
    await withWriteDb((db) => operation(db, authUserId, payload));
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Hosted DB write route failed:', error);
    const routeError = toDbRouteError(error);
    if (routeError.code === 'internal') {
      return dbRouteErrorResponse(internal());
    }
    return dbRouteErrorResponse(routeError);
  }
}
