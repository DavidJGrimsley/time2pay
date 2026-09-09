import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuthUserId: vi.fn(),
  status: vi.fn(),
  start: vi.fn(),
  disconnect: vi.fn(),
  callback: vi.fn(),
}));

vi.mock('@/server/db/_shared/auth', () => ({
  requireAuthUserId: mocks.requireAuthUserId,
}));

vi.mock('@/server/mercury/oauth', () => ({
  MercuryOAuthError: class MercuryOAuthError extends Error {
    constructor(
      message: string,
      readonly code: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
  getMercuryOAuthConnectionStatusForUser: mocks.status,
  startMercuryOAuthForUser: mocks.start,
  disconnectMercuryOAuthForUser: mocks.disconnect,
  handleMercuryOAuthCallback: mocks.callback,
}));

function actionRequest(action: string, values: Record<string, unknown> = {}): Request {
  return new Request('https://time2pay.test/api/mercury-oauth', {
    method: 'POST',
    headers: { Authorization: 'Bearer session', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...values }),
  });
}

describe('Mercury OAuth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthUserId.mockResolvedValue('user-1');
  });

  it('requires a signed-in user before returning status', async () => {
    mocks.requireAuthUserId.mockRejectedValue(new Error('Missing Bearer token.'));
    const { POST } = await import('@/app/api/mercury-oauth+api');
    const response = await POST(actionRequest('status'));
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it('returns only the sanitized connection status', async () => {
    mocks.status.mockResolvedValue({
      available: true,
      connectionState: 'connected',
      environment: 'sandbox',
      scopes: ['read', 'offline_access'],
      connectedAt: '2026-09-08T00:00:00.000Z',
      lastRefreshedAt: null,
      accessTokenExpiresAt: '2026-09-08T01:00:00.000Z',
    });
    const { POST } = await import('@/app/api/mercury-oauth+api');
    const response = await POST(actionRequest('status'));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).not.toHaveProperty('accessToken');
    expect(payload).not.toHaveProperty('refreshToken');
    expect(mocks.status).toHaveBeenCalledWith('user-1');
  });

  it('starts and disconnects the current user connection', async () => {
    mocks.start.mockResolvedValue({ authorizationUrl: 'https://oauth2-sandbox.mercury.com/oauth2/auth' });
    mocks.disconnect.mockResolvedValue({ available: true, connectionState: 'disconnected' });
    const { POST } = await import('@/app/api/mercury-oauth+api');

    const started = await POST(
      actionRequest('start', { returnPath: '/onboarding/mercury' }),
    );
    expect(started.status).toBe(200);
    expect(mocks.start).toHaveBeenCalledWith('user-1', '/onboarding/mercury');

    const disconnected = await POST(actionRequest('disconnect'));
    expect(disconnected.status).toBe(200);
    expect(mocks.disconnect).toHaveBeenCalledWith('user-1');
  });

  it('rejects OAuth return paths outside the server allowlist', async () => {
    const { POST } = await import('@/app/api/mercury-oauth+api');
    const response = await POST(
      actionRequest('start', { returnPath: 'https://attacker.test/callback' }),
    );

    expect(response.status).toBe(400);
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('delegates the public provider callback without requiring a browser session', async () => {
    mocks.callback.mockResolvedValue(
      new Response(null, { status: 303, headers: { Location: 'https://time2pay.test/settings/integrations' } }),
    );
    const { GET } = await import('@/app/api/mercury-oauth/callback+api');
    const request = new Request('https://time2pay.test/api/mercury-oauth/callback?code=c&state=s');
    const response = await GET(request);
    expect(response.status).toBe(303);
    expect(mocks.callback).toHaveBeenCalledWith(request);
    expect(mocks.requireAuthUserId).not.toHaveBeenCalled();
  });
});
