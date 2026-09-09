import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

type Query = ReturnType<typeof sql>;
type ConnectionRow = {
  status: 'connected' | 'reauthorization_required' | 'disconnected';
  access_token_vault_secret_id: string | null;
  refresh_token_vault_secret_id: string | null;
  scopes: string[];
  access_token_expires_at: string | null;
  connected_at: string | null;
  last_refreshed_at: string | null;
};
type AttemptRow = {
  state_hash: string;
  auth_user_id: string;
  environment: 'sandbox' | 'production';
  flow: 'connect' | 'reconnect';
  pkce_verifier_vault_secret_id: string;
  redirect_uri: string;
  expires_at: string;
};
type FakeDb = {
  transaction<T>(work: (db: FakeDb) => Promise<T>): Promise<T>;
  execute(query: Query): Promise<{ rows: unknown[] }>;
};

const state = vi.hoisted(() => ({
  connection: null as ConnectionRow | null,
  attempt: null as AttemptRow | null,
  vault: new Map<string, string>(),
  nextVaultId: 1,
  advisoryLocks: 0,
}));

function queryParts(query: Query): { sql: string; params: unknown[] } {
  const chunks = (query as unknown as { queryChunks?: unknown[] }).queryChunks ?? [];
  const params: unknown[] = [];
  const sqlText = chunks
    .map((chunk) => {
      if (chunk && typeof chunk === 'object' && 'value' in (chunk as { value?: unknown })) {
        const value = (chunk as { value?: unknown }).value;
        return Array.isArray(value) ? value.join('') : String(value ?? '');
      }
      params.push(chunk);
      return '?';
    })
    .join('');
  return { sql: sqlText.replace(/\s+/g, ' ').trim(), params };
}

const fakeDb: FakeDb = {
  async transaction<T>(work: (db: FakeDb) => Promise<T>): Promise<T> {
    return work(fakeDb);
  },
  async execute(query: Query): Promise<{ rows: unknown[] }> {
    const { sql: text, params } = queryParts(query);

    if (text.includes('pg_advisory_xact_lock')) {
      state.advisoryLocks += 1;
      return { rows: [] };
    }
    if (text.includes('vault.create_secret')) {
      const id = `00000000-0000-0000-0000-${String(state.nextVaultId++).padStart(12, '0')}`;
      state.vault.set(id, params[0] as string);
      return { rows: [{ id }] };
    }
    if (text.includes('from vault.decrypted_secrets')) {
      const secret = state.vault.get(params[0] as string);
      return { rows: secret ? [{ decrypted_secret: secret }] : [] };
    }
    if (text.startsWith('delete from vault.secrets where id in')) {
      if (state.attempt) state.vault.delete(state.attempt.pkce_verifier_vault_secret_id);
      return { rows: [] };
    }
    if (text.startsWith('delete from vault.secrets where id =')) {
      state.vault.delete(params[0] as string);
      return { rows: [] };
    }
    if (text.includes('from mercury_oauth_attempts') && text.includes('for update')) {
      return { rows: state.attempt ? [state.attempt] : [] };
    }
    if (text.startsWith('delete from mercury_oauth_attempts')) {
      state.attempt = null;
      return { rows: [] };
    }
    if (text.startsWith('insert into mercury_oauth_attempts')) {
      state.attempt = {
        state_hash: params[0] as string,
        auth_user_id: params[1] as string,
        environment: params[2] as 'sandbox' | 'production',
        flow: params[3] as 'connect' | 'reconnect',
        pkce_verifier_vault_secret_id: params[4] as string,
        redirect_uri: params[5] as string,
        expires_at: params[6] as string,
      };
      return { rows: [] };
    }
    if (text.includes('from mercury_oauth_connections')) {
      return { rows: state.connection ? [state.connection] : [] };
    }
    if (text.startsWith('update mercury_oauth_connections')) {
      if (state.connection) {
        state.connection = {
          ...state.connection,
          status: 'reauthorization_required',
          access_token_vault_secret_id: null,
          refresh_token_vault_secret_id: null,
          access_token_expires_at: null,
        };
      }
      return { rows: [] };
    }
    if (text.startsWith('insert into mercury_oauth_connections')) {
      if (text.includes("'disconnected'")) {
        state.connection = {
          status: 'disconnected',
          access_token_vault_secret_id: null,
          refresh_token_vault_secret_id: null,
          scopes: [],
          access_token_expires_at: null,
          connected_at: state.connection?.connected_at ?? null,
          last_refreshed_at: state.connection?.last_refreshed_at ?? null,
        };
      } else {
        state.connection = {
          status: 'connected',
          access_token_vault_secret_id: params[2] as string,
          refresh_token_vault_secret_id: params[3] as string,
          scopes: Array.isArray(params[4]) ? (params[4] as string[]) : ['read', 'offline_access'],
          access_token_expires_at: params[5] as string,
          connected_at: params[6] as string,
          last_refreshed_at: (params[7] as string | null) ?? null,
        };
      }
      return { rows: [] };
    }
    return { rows: [] };
  },
};

vi.mock('@/server/db/_shared/db', () => ({
  withWriteDb: (work: (db: FakeDb) => unknown) => work(fakeDb),
}));
vi.mock('@/services/site-origin', () => ({
  requireConfiguredSiteOrigin: () => 'https://time2pay.test',
}));
vi.mock('@/server/mercury/audit', () => ({
  recordMercuryCredentialEvent: vi.fn().mockResolvedValue(undefined),
}));

function tokenResponse(accessToken: string, refreshToken: string): Response {
  return Response.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    scope: 'read offline_access',
    expires_in: 3600,
  });
}

describe('Mercury OAuth server lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.connection = null;
    state.attempt = null;
    state.vault.clear();
    state.nextVaultId = 1;
    state.advisoryLocks = 0;
    process.env.MERCURY_OAUTH_CLIENT_ID = 'mercury-client';
    process.env.MERCURY_OAUTH_CLIENT_SECRET = 'mercury-secret';
    process.env.MERCURY_OAUTH_ENVIRONMENT = 'sandbox';
  });

  it('starts authorization with opaque state and PKCE S256 without exposing the verifier', async () => {
    const { startMercuryOAuthForUser } = await import('@/server/mercury/oauth');
    const result = await startMercuryOAuthForUser('user-1');
    const url = new URL(result.authorizationUrl);
    const verifier = state.attempt
      ? state.vault.get(state.attempt.pkce_verifier_vault_secret_id)
      : null;

    expect(url.origin).toBe('https://oauth2-sandbox.mercury.com');
    expect(url.pathname).toBe('/oauth2/auth');
    expect(url.searchParams.get('client_id')).toBe('mercury-client');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://time2pay.test/api/mercury-oauth/callback',
    );
    expect(url.searchParams.get('scope')).toBe('read offline_access');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.has('prompt')).toBe(false);
    expect(verifier).toBeTruthy();
    expect(state.attempt?.state_hash).toBe(
      createHash('sha256').update(url.searchParams.get('state') ?? '').digest('hex'),
    );
    expect(url.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(verifier ?? '').digest('base64url'),
    );
    expect(result.authorizationUrl).not.toContain(verifier ?? 'missing-verifier');
  });

  it('connects, reconnects without dropping the old grant early, and removes tokens on disconnect', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(tokenResponse('access-1', 'refresh-1'))
      .mockResolvedValueOnce(tokenResponse('access-2', 'refresh-2'));
    vi.stubGlobal('fetch', fetchMock);
    const {
      disconnectMercuryOAuthForUser,
      handleMercuryOAuthCallback,
      startMercuryOAuthForUser,
    } = await import('@/server/mercury/oauth');

    const firstStart = await startMercuryOAuthForUser('user-1');
    const firstState = new URL(firstStart.authorizationUrl).searchParams.get('state');
    const firstCallback = await handleMercuryOAuthCallback(
      new Request(`https://time2pay.test/api/mercury-oauth/callback?code=code-1&state=${firstState}`),
    );
    expect(firstCallback.status).toBe(303);
    expect(firstCallback.headers.get('location')).toContain('mercury_oauth=connected');
    const firstAccessId = state.connection?.access_token_vault_secret_id ?? '';
    const firstRefreshId = state.connection?.refresh_token_vault_secret_id ?? '';
    expect(state.vault.get(firstAccessId)).toBe('access-1');
    expect(state.vault.get(firstRefreshId)).toBe('refresh-1');

    const reconnectStart = await startMercuryOAuthForUser('user-1');
    expect(state.vault.get(firstAccessId)).toBe('access-1');
    expect(state.vault.get(firstRefreshId)).toBe('refresh-1');
    const reconnectState = new URL(reconnectStart.authorizationUrl).searchParams.get('state');
    const reconnectCallback = await handleMercuryOAuthCallback(
      new Request(`https://time2pay.test/api/mercury-oauth/callback?code=code-2&state=${reconnectState}`),
    );
    expect(reconnectCallback.headers.get('location')).toContain('mercury_oauth=reconnected');
    expect(state.vault.has(firstAccessId)).toBe(false);
    expect(state.vault.has(firstRefreshId)).toBe(false);
    expect([...state.vault.values()]).toEqual(expect.arrayContaining(['access-2', 'refresh-2']));

    await disconnectMercuryOAuthForUser('user-1');
    expect(state.connection?.status).toBe('disconnected');
    expect(state.vault.size).toBe(0);
  });

  it('serializes refresh and atomically replaces Mercury single-use refresh tokens', async () => {
    state.vault.set('00000000-0000-0000-0000-000000000101', 'old-access');
    state.vault.set('00000000-0000-0000-0000-000000000102', 'old-refresh');
    state.connection = {
      status: 'connected',
      access_token_vault_secret_id: '00000000-0000-0000-0000-000000000101',
      refresh_token_vault_secret_id: '00000000-0000-0000-0000-000000000102',
      scopes: ['read', 'offline_access'],
      access_token_expires_at: '2020-01-01T00:00:00.000Z',
      connected_at: '2026-09-01T00:00:00.000Z',
      last_refreshed_at: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse('new-access', 'new-refresh'));
    vi.stubGlobal('fetch', fetchMock);
    const { getValidMercuryOAuthAccessForUser } = await import('@/server/mercury/oauth');

    await expect(getValidMercuryOAuthAccessForUser('user-1')).resolves.toEqual({
      accessToken: 'new-access',
      environment: 'sandbox',
    });
    expect(state.advisoryLocks).toBe(1);
    expect(state.vault.has('00000000-0000-0000-0000-000000000101')).toBe(false);
    expect(state.vault.has('00000000-0000-0000-0000-000000000102')).toBe(false);
    expect([...state.vault.values()]).toEqual(expect.arrayContaining(['new-access', 'new-refresh']));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('deletes unusable tokens and requires reauthorization after invalid_grant', async () => {
    state.vault.set('00000000-0000-0000-0000-000000000201', 'old-access');
    state.vault.set('00000000-0000-0000-0000-000000000202', 'old-refresh');
    state.connection = {
      status: 'connected',
      access_token_vault_secret_id: '00000000-0000-0000-0000-000000000201',
      refresh_token_vault_secret_id: '00000000-0000-0000-0000-000000000202',
      scopes: ['read', 'offline_access'],
      access_token_expires_at: '2020-01-01T00:00:00.000Z',
      connected_at: '2026-09-01T00:00:00.000Z',
      last_refreshed_at: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({ error: 'invalid_grant' }, { status: 400 }),
      ),
    );
    const { getValidMercuryOAuthAccessForUser } = await import('@/server/mercury/oauth');

    await expect(getValidMercuryOAuthAccessForUser('user-1')).resolves.toBeNull();
    expect(state.connection?.status).toBe('reauthorization_required');
    expect(state.vault.size).toBe(0);
  });
});
