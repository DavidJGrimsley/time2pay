import { sql } from 'drizzle-orm';
import { z, type ZodType } from 'zod';
import {
  isHostedAccessEnforcementEnabled,
  requireHostedAccess,
} from '@/server/billing/entitlements';
import { requireAuthUserId } from '@/server/db/_shared/auth';
import { withWriteDb, type WriteDb } from '@/server/db/_shared/db';
import {
  dbRouteErrorResponse,
  internal,
  toDbRouteError,
  unauthorized,
  validation,
} from '@/server/db/_shared/errors';

function parseJsonError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? 'Invalid payload.';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Invalid payload.';
}

async function ensureServerHostedProfileRow(db: WriteDb, authUserId: string): Promise<void> {
  await db.execute(sql`
    insert into user_profiles (auth_user_id)
    values (${authUserId}::uuid)
    on conflict (auth_user_id) do nothing
  `);
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

export type DbWriteRouteOptions = {
  requiresHostedAccess?: boolean;
};

export async function handleDbWrite<T>(
  request: Request,
  schema: ZodType<T>,
  operation: (db: WriteDb, authUserId: string, payload: T) => Promise<void>,
  options: DbWriteRouteOptions = {},
): Promise<Response> {
  let authUserId: string;
  try {
    authUserId = await requireAuthUserId(request);
  } catch (error) {
    return dbRouteErrorResponse(
      unauthorized(error instanceof Error ? error.message : 'Invalid auth token.'),
    );
  }

  if (options.requiresHostedAccess !== false && isHostedAccessEnforcementEnabled()) {
    try {
      await requireHostedAccess(authUserId);
    } catch (error) {
      return dbRouteErrorResponse(toDbRouteError(error));
    }
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
    await withWriteDb(async (db) => {
      await ensureServerHostedProfileRow(db, authUserId);
      await operation(db, authUserId, payload);
    });
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
