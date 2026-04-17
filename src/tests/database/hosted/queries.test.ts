import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createClient, listClients } from '@/database/hosted/clients-projects/index';
import { getSupabaseClient, requireSupabaseUserId } from '@/services/supabase-client';

vi.mock('@/services/supabase-client', () => ({
  getSupabaseClient: vi.fn(),
  getSupabaseUser: vi.fn(),
  requireSupabaseUserId: vi.fn(),
}));

const getSupabaseClientMock = vi.mocked(getSupabaseClient);
const requireSupabaseUserIdMock = vi.mocked(requireSupabaseUserId);
const ORIGINAL_ENV = {
  EXPO_PUBLIC_SITE_ORIGIN: process.env.EXPO_PUBLIC_SITE_ORIGIN,
};

afterEach(() => {
  process.env.EXPO_PUBLIC_SITE_ORIGIN = ORIGINAL_ENV.EXPO_PUBLIC_SITE_ORIGIN;
  Reflect.deleteProperty(globalThis, 'window');
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('hosted clients/projects queries', () => {
  beforeEach(() => {
    requireSupabaseUserIdMock.mockResolvedValue('user-1');
  });

  it('does not fall back to local reads when Supabase read fails', async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
    } as unknown as {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      is: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
    };

    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.is.mockReturnValue(query);
    query.order.mockResolvedValue({
      data: null,
      error: { message: 'forced hosted read failure' },
    });

    getSupabaseClientMock.mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    await expect(listClients()).rejects.toThrow('forced hosted read failure');
  });

  it('does not fall back to local writes when API write route cannot run', async () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = '';
    await expect(
      createClient({
        id: 'client_1',
        name: 'Acme',
      }),
    ).rejects.toThrow('Hosted mode requires EXPO_PUBLIC_SITE_ORIGIN.');
  });

  it('uses the current loopback browser origin for hosted write routes during local web testing', async () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = 'https://time2pay.app';
    (globalThis as Record<string, unknown>).window = {
      location: { origin: 'http://localhost:8081' },
    };

    const getSession = vi.fn().mockResolvedValue({
      data: { session: { access_token: 'token-123' } },
      error: null,
    });
    getSupabaseClientMock.mockReturnValue({
      auth: { getSession },
    } as unknown as ReturnType<typeof getSupabaseClient>);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await createClient({
      id: 'client_1',
      name: 'Acme',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8081/api/db/clients/create',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    );
  });
});
