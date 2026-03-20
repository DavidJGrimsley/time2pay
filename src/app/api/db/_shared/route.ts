import { z, type ZodType } from 'zod';
import { requireAuthUserId } from '@/app/api/db/_shared/auth';
import { withWriteDb, type WriteDb } from '@/app/api/db/_shared/db';

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
    throw new Error('Invalid JSON request body.');
  }
  return schema.parse(body);
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
    return Response.json(
      { error: error instanceof Error ? error.message : 'Invalid request.' },
      { status: 401 },
    );
  }

  let payload: T;
  try {
    payload = await parseBody(request, schema);
  } catch (error) {
    return Response.json({ error: parseJsonError(error) }, { status: 400 });
  }

  try {
    await withWriteDb((db) => operation(db, authUserId, payload));
    return Response.json({ ok: true });
  } catch (error) {
    console.error('Hosted DB write route failed:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Hosted write failed.' },
      { status: 400 },
    );
  }
}
