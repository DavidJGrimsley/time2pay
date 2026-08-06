import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClaims: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

describe('requireAuthUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://supabase.test';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon_test_key';
    mocks.createClient.mockReturnValue({
      auth: {
        getClaims: mocks.getClaims,
        getUser: mocks.getUser,
      },
    });
  });

  it('returns the verified JWT subject from getClaims without calling getUser directly', async () => {
    mocks.getClaims.mockResolvedValue({
      data: {
        claims: { sub: ' user-1 ' },
      },
      error: null,
    });
    const { requireAuthUserId } = await import('@/server/db/_shared/auth');

    await expect(
      requireAuthUserId(
        new Request('http://localhost/api/test', {
          headers: { Authorization: 'Bearer supabase-token' },
        }),
      ),
    ).resolves.toBe('user-1');

    expect(mocks.getClaims).toHaveBeenCalledWith('supabase-token');
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it('rejects missing bearer tokens before creating a Supabase client', async () => {
    const { requireAuthUserId } = await import('@/server/db/_shared/auth');

    await expect(requireAuthUserId(new Request('http://localhost/api/test'))).rejects.toThrow(
      'Missing Bearer token.',
    );

    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('rejects tokens that do not produce a verified subject claim', async () => {
    mocks.getClaims.mockResolvedValue({
      data: null,
      error: new Error('invalid jwt'),
    });
    const { requireAuthUserId } = await import('@/server/db/_shared/auth');

    await expect(
      requireAuthUserId(
        new Request('http://localhost/api/test', {
          headers: { Authorization: 'Bearer bad-token' },
        }),
      ),
    ).rejects.toThrow('Invalid Supabase session token.');
  });
});
