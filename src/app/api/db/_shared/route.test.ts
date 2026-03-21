import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { handleDbWrite } from '@/app/api/db/_shared/route';
import { conflict, forbidden, notFound } from '@/app/api/db/_shared/errors';
import { requireAuthUserId } from '@/app/api/db/_shared/auth';
import { withWriteDb } from '@/app/api/db/_shared/db';

vi.mock('@/app/api/db/_shared/auth', () => ({
  requireAuthUserId: vi.fn(),
}));

vi.mock('@/app/api/db/_shared/db', () => ({
  withWriteDb: vi.fn(),
}));

const requireAuthUserIdMock = vi.mocked(requireAuthUserId);
const withWriteDbMock = vi.mocked(withWriteDb);

const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  consoleErrorSpy.mockClear();
});

describe('handleDbWrite', () => {
  it('returns 401 when auth is missing', async () => {
    requireAuthUserIdMock.mockRejectedValue(new Error('Missing Bearer token.'));

    const response = await handleDbWrite(
      new Request('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({ id: 'x' }),
      }),
      z.object({ id: z.string() }).strict(),
      async () => {},
    );
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('unauthorized');
  });

  it('returns 422 for strict payload validation failures', async () => {
    requireAuthUserIdMock.mockResolvedValue('user-1');

    const response = await handleDbWrite(
      new Request('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({ id: 'x', extra: true }),
      }),
      z.object({ id: z.string() }).strict(),
      async () => {},
    );
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(422);
    expect(body.code).toBe('validation');
  });

  it('maps domain errors to status codes', async () => {
    requireAuthUserIdMock.mockResolvedValue('user-1');
    withWriteDbMock.mockImplementation(async (work) =>
      work({} as Parameters<typeof work>[0]),
    );

    const conflictResponse = await handleDbWrite(
      new Request('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({ id: 'x' }),
      }),
      z.object({ id: z.string() }).strict(),
      async () => {
        throw conflict('Session is locked.');
      },
    );
    expect(conflictResponse.status).toBe(409);

    const forbiddenResponse = await handleDbWrite(
      new Request('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({ id: 'x' }),
      }),
      z.object({ id: z.string() }).strict(),
      async () => {
        throw forbidden('Wrong tenant.');
      },
    );
    expect(forbiddenResponse.status).toBe(403);

    const notFoundResponse = await handleDbWrite(
      new Request('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({ id: 'x' }),
      }),
      z.object({ id: z.string() }).strict(),
      async () => {
        throw notFound('Missing row.');
      },
    );
    expect(notFoundResponse.status).toBe(404);
  });
});
