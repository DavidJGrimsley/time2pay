import { type ZodType } from 'zod';
import { BillingError } from '@/server/billing/errors';
import { requireAuthUserId } from '@/server/db/_shared/auth';

export async function requireBillingAuthUserId(request: Request): Promise<string> {
  try {
    return await requireAuthUserId(request);
  } catch {
    throw new BillingError(401, 'unauthorized', 'Authentication is required.');
  }
}

export async function parseBillingJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new BillingError(422, 'validation', 'Request body must be valid JSON.');
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new BillingError(422, 'validation', parsed.error.issues[0]?.message ?? 'Invalid request.');
  }

  return parsed.data;
}