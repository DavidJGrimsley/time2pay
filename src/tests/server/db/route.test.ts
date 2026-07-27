import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { handleDbWrite } from '@/server/db/_shared/route';
import {
  isHostedAccessEnforcementEnabled,
  requireHostedAccess,
} from '@/server/billing/entitlements';
import { conflict, forbidden, notFound } from '@/server/db/_shared/errors';
import { requireAuthUserId } from '@/server/db/_shared/auth';
import { withWriteDb } from '@/server/db/_shared/db';

const express = require('express') as any;

vi.mock('@/server/db/_shared/auth', () => ({
  requireAuthUserId: vi.fn(),
}));

vi.mock('@/server/db/_shared/db', () => ({
  withWriteDb: vi.fn(),
}));

vi.mock('@/server/billing/entitlements', () => ({
  isHostedAccessEnforcementEnabled: vi.fn(),
  requireHostedAccess: vi.fn(),
}));

const requireAuthUserIdMock = vi.mocked(requireAuthUserId);
const withWriteDbMock = vi.mocked(withWriteDb);
const isHostedAccessEnforcementEnabledMock = vi.mocked(isHostedAccessEnforcementEnabled);
const requireHostedAccessMock = vi.mocked(requireHostedAccess);

const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  consoleErrorSpy.mockClear();
});

beforeEach(() => {
  isHostedAccessEnforcementEnabledMock.mockReturnValue(false);
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

  it('blocks protected writes when hosted access enforcement denies the user', async () => {
    requireAuthUserIdMock.mockResolvedValue('user-1');
    isHostedAccessEnforcementEnabledMock.mockReturnValue(true);
    requireHostedAccessMock.mockRejectedValue(forbidden('Hosted access is required for this action.'));

    const response = await handleDbWrite(
      new Request('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({ id: 'x' }),
      }),
      z.object({ id: z.string() }).strict(),
      async () => {},
    );
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(403);
    expect(body.code).toBe('forbidden');
    expect(requireHostedAccessMock).toHaveBeenCalledWith('user-1');
    expect(withWriteDbMock).not.toHaveBeenCalled();
  });

  it('allows an explicit access-free write route for future export and account-deletion flows', async () => {
    requireAuthUserIdMock.mockResolvedValue('user-1');
    isHostedAccessEnforcementEnabledMock.mockReturnValue(true);
    withWriteDbMock.mockImplementation(async (work) =>
      work({
        execute: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as Parameters<typeof work>[0]),
    );

    const response = await handleDbWrite(
      new Request('http://localhost/api/test', {
        method: 'POST',
        body: JSON.stringify({ id: 'x' }),
      }),
      z.object({ id: z.string() }).strict(),
      async () => {},
      { requiresHostedAccess: false },
    );

    expect(response.status).toBe(200);
    expect(requireHostedAccessMock).not.toHaveBeenCalled();
  });

  it('maps domain errors to status codes', async () => {
    requireAuthUserIdMock.mockResolvedValue('user-1');
    withWriteDbMock.mockImplementation(async (work) =>
      work({
        execute: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as Parameters<typeof work>[0]),
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

  it('matches nested /api/db routes with the Express wildcard syntax used by server.js', async () => {
    const app = express();
    let matchedUrl: string | null = null;

    app.use('/api/db', express.json({ limit: '1mb' }));
    app.all('/api/db/{*route}', (req: any, res: any) => {
      matchedUrl = req.originalUrl;
      res.status(204).end();
    });
    app.use((_req: any, res: any) => {
      res.status(404).end();
    });

    const server = app.listen(0);

    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/api/db/invoices/delete`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ id: 'invoice-1' }),
      });

      expect(response.status).toBe(204);
      expect(matchedUrl).toBe('/api/db/invoices/delete');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error | null) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });

  it('preserves Stripe webhook bytes with the raw Express body parser used by server.js', async () => {
    const app = express();
    let receivedBody: Buffer | null = null;

    app.post('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '1mb' }), (req: any, res: any) => {
      receivedBody = req.body;
      res.status(204).end();
    });

    const server = app.listen(0);
    const payload = '{"id":"evt_123","type":"checkout.session.completed"}';

    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${port}/api/webhooks/stripe`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': 't=1,v1=signature',
        },
        body: payload,
      });

      expect(response.status).toBe(204);
      expect(Buffer.isBuffer(receivedBody)).toBe(true);
      const bodyText = Buffer.isBuffer(receivedBody)
        ? Buffer.from(receivedBody as unknown as Uint8Array).toString()
        : null;
      expect(bodyText).toBe(payload);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error?: Error | null) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});
