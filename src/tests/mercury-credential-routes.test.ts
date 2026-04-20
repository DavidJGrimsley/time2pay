import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuthUserId: vi.fn(),
  getMercuryCredentialStatusForUser: vi.fn(),
  saveMercuryCredentialForUser: vi.fn(),
  deleteMercuryCredentialForUser: vi.fn(),
  testMercuryCredentialForUser: vi.fn(),
  getMercuryReferralStatusForUser: vi.fn(),
  recordMercuryReferralClickForUser: vi.fn(),
}));

vi.mock('@/server/db/_shared/auth', () => ({
  requireAuthUserId: mocks.requireAuthUserId,
}));

vi.mock('@/server/mercury/credentials', () => ({
  getMercuryCredentialStatusForUser: mocks.getMercuryCredentialStatusForUser,
  saveMercuryCredentialForUser: mocks.saveMercuryCredentialForUser,
  deleteMercuryCredentialForUser: mocks.deleteMercuryCredentialForUser,
  testMercuryCredentialForUser: mocks.testMercuryCredentialForUser,
}));

vi.mock('@/server/mercury/referrals', () => ({
  getMercuryReferralStatusForUser: mocks.getMercuryReferralStatusForUser,
  recordMercuryReferralClickForUser: mocks.recordMercuryReferralClickForUser,
}));

function credentialRequest(body: unknown): Request {
  return new Request('http://localhost/api/mercury-credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer supabase-token',
    },
    body: JSON.stringify(body),
  });
}

function referralRequest(body: unknown): Request {
  return new Request('http://localhost/api/mercury-referrals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer supabase-token',
    },
    body: JSON.stringify(body),
  });
}

describe('Mercury credential/referral API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthUserId.mockResolvedValue('user-1');
  });

  it('returns 400 for malformed credential action payloads after auth succeeds', async () => {
    const { POST } = await import('@/app/api/mercury-credentials+api');

    const response = await POST(credentialRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing required "action" field.',
    });
  });

  it('returns 401 for credential auth failures', async () => {
    mocks.requireAuthUserId.mockRejectedValue(new Error('Missing Bearer token.'));
    const { POST } = await import('@/app/api/mercury-credentials+api');

    const response = await POST(credentialRequest({ action: 'status' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing Bearer token.',
    });
  });

  it('returns 400 for malformed referral action payloads after auth succeeds', async () => {
    const { POST } = await import('@/app/api/mercury-referrals+api');

    const response = await POST(referralRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing required "action" field.',
    });
  });

  it('returns 401 for referral auth failures', async () => {
    mocks.requireAuthUserId.mockRejectedValue(new Error('Missing Bearer token.'));
    const { POST } = await import('@/app/api/mercury-referrals+api');

    const response = await POST(referralRequest({ action: 'status' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Missing Bearer token.',
    });
  });
});
