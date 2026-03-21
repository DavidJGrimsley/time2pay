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

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
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
    await expect(
      createClient({
        id: 'client_1',
        name: 'Acme',
      }),
    ).rejects.toThrow('Hosted writes on non-web runtime require EXPO_PUBLIC_HOSTED_API_BASE_URL.');
  });
});
