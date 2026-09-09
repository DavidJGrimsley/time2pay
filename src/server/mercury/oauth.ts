/**
 * Mercury OAuth connection handling — server-only.
 *
 * OAuth access/refresh tokens and transient PKCE verifiers live in Supabase
 * Vault. Browser clients receive only sanitized connection status and the
 * provider authorization URL.
 */
import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { requireConfiguredSiteOrigin } from '@/services/site-origin';
import { withWriteDb, type WriteDb } from '@/server/db/_shared/db';
import { recordMercuryCredentialEvent } from '@/server/mercury/audit';

export type MercuryOAuthEnvironment = 'production' | 'sandbox';
export type MercuryOAuthConnectionState =
  | 'unavailable'
  | 'disconnected'
  | 'connected'
  | 'reauthorization_required';

export type MercuryOAuthConnectionStatus = {
  available: boolean;
  connectionState: MercuryOAuthConnectionState;
  environment: MercuryOAuthEnvironment | null;
  scopes: string[];
  connectedAt: string | null;
  lastRefreshedAt: string | null;
  accessTokenExpiresAt: string | null;
};

export type MercuryOAuthStartResult = {
  authorizationUrl: string;
};

export type MercuryOAuthAccess = {
  accessToken: string;
  environment: MercuryOAuthEnvironment;
};

type MercuryOAuthConfig = {
  clientId: string;
  clientSecret: string;
  environment: MercuryOAuthEnvironment;
  oauthBaseUrl: string;
  apiBaseUrl: string;
  siteOrigin: string;
  redirectUri: string;
};

type OAuthDb = Pick<WriteDb, 'execute'>;

type ConnectionRow = {
  status?: MercuryOAuthConnectionState;
  access_token_vault_secret_id?: string | null;
  refresh_token_vault_secret_id?: string | null;
  scopes?: string[] | string | null;
  access_token_expires_at?: string | Date | null;
  connected_at?: string | Date | null;
  last_refreshed_at?: string | Date | null;
};

type AttemptRow = {
  auth_user_id?: string;
  environment?: MercuryOAuthEnvironment;
  flow?: 'connect' | 'reconnect';
  pkce_verifier_vault_secret_id?: string | null;
  redirect_uri?: string;
};

type ConsumedAttempt = AttemptRow & {
  codeVerifier: string;
};

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  scopes: string[];
  expiresInSeconds: number;
};

const MERCURY_OAUTH_SCOPES = ['read', 'offline_access'] as const;
const MERCURY_OAUTH_CALLBACK_PATH = '/api/mercury-oauth/callback';
const MERCURY_OAUTH_RETURN_PATH = '/settings/integrations';
const OAUTH_ATTEMPT_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_REFRESH_LEEWAY_MS = 60 * 1000;
const DEFAULT_ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60;

const OAUTH_ENDPOINTS: Record<
  MercuryOAuthEnvironment,
  { oauthBaseUrl: string; apiBaseUrl: string }
> = {
  production: {
    oauthBaseUrl: 'https://oauth2.mercury.com',
    apiBaseUrl: 'https://api.mercury.com/api/v1',
  },
  sandbox: {
    oauthBaseUrl: 'https://oauth2-sandbox.mercury.com',
    apiBaseUrl: 'https://api-sandbox.mercury.com/api/v1',
  },
};

export class MercuryOAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly permanent = false,
  ) {
    super(message);
    this.name = 'MercuryOAuthError';
  }
}

function rowsFromResult(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (result && typeof result === 'object') {
    const rows = (result as { rows?: unknown[] }).rows;
    if (Array.isArray(rows)) {
      return rows as Record<string, unknown>[];
    }
  }
  return [];
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === 'string' && value.trim() ? value : null;
}

function parseScopes(value: unknown): string[] {
  const scopes = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\s+/)
      : [];
  return [...new Set(scopes.filter((scope): scope is string => typeof scope === 'string' && Boolean(scope.trim())).map((scope) => scope.trim()))];
}

function base64Url(value: Buffer): string {
  return value.toString('base64url');
}

function hashState(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}

function readEnvironment(): MercuryOAuthEnvironment {
  const configured = process.env.MERCURY_OAUTH_ENVIRONMENT?.trim().toLowerCase() || 'production';
  if (configured !== 'production' && configured !== 'sandbox') {
    throw new MercuryOAuthError(
      'Mercury OAuth environment is invalid.',
      'oauth_configuration_invalid',
      501,
    );
  }
  return configured;
}

function getMercuryOAuthConfig(): MercuryOAuthConfig {
  const clientId = process.env.MERCURY_OAUTH_CLIENT_ID?.trim() ?? '';
  const clientSecret = process.env.MERCURY_OAUTH_CLIENT_SECRET?.trim() ?? '';
  if (!clientId || !clientSecret) {
    throw new MercuryOAuthError(
      'Mercury OAuth is not configured on this server.',
      'oauth_not_configured',
      501,
    );
  }

  const environment = readEnvironment();
  const endpoints = OAUTH_ENDPOINTS[environment];
  let siteOrigin: string;
  try {
    siteOrigin = requireConfiguredSiteOrigin();
  } catch {
    throw new MercuryOAuthError(
      'Mercury OAuth requires a configured site origin.',
      'oauth_site_origin_missing',
      501,
    );
  }

  return {
    clientId,
    clientSecret,
    environment,
    ...endpoints,
    siteOrigin,
    redirectUri: new URL(MERCURY_OAUTH_CALLBACK_PATH, siteOrigin).toString(),
  };
}

async function withOAuthTransaction<T>(work: (db: OAuthDb) => Promise<T>): Promise<T> {
  return withWriteDb((db) =>
    db.transaction(async (transaction) => work(transaction as unknown as OAuthDb)),
  );
}

async function ensureProfileRow(db: OAuthDb, authUserId: string): Promise<void> {
  await db.execute(sql`
    insert into user_profiles (auth_user_id)
    values (${authUserId}::uuid)
    on conflict (auth_user_id) do nothing
  `);
}

async function createVaultSecret(
  db: OAuthDb,
  secret: string,
  description: string,
): Promise<string> {
  const result = await db.execute(sql`
    select vault.create_secret(${secret}, null, ${description}) as id
  `);
  const row = rowsFromResult(result)[0] as { id?: string } | undefined;
  if (!row?.id) {
    throw new MercuryOAuthError(
      'Mercury OAuth secret storage failed.',
      'oauth_secret_storage_failed',
      500,
    );
  }
  return row.id;
}

async function readVaultSecret(db: OAuthDb, secretId: string): Promise<string | null> {
  const result = await db.execute(sql`
    select decrypted_secret
    from vault.decrypted_secrets
    where id = ${secretId}::uuid
    limit 1
  `);
  const row = rowsFromResult(result)[0] as { decrypted_secret?: string | null } | undefined;
  return row?.decrypted_secret?.trim() || null;
}

async function deleteVaultSecret(db: OAuthDb, secretId: string | null | undefined): Promise<void> {
  if (!secretId) {
    return;
  }
  await db.execute(sql`delete from vault.secrets where id = ${secretId}::uuid`);
}

async function readConnection(
  db: OAuthDb,
  authUserId: string,
  environment: MercuryOAuthEnvironment,
  lock = false,
): Promise<ConnectionRow | null> {
  const result = lock
    ? await db.execute(sql`
        select
          status,
          access_token_vault_secret_id,
          refresh_token_vault_secret_id,
          scopes,
          access_token_expires_at,
          connected_at,
          last_refreshed_at
        from mercury_oauth_connections
        where auth_user_id = ${authUserId}::uuid
          and environment = ${environment}
        limit 1
        for update
      `)
    : await db.execute(sql`
        select
          status,
          access_token_vault_secret_id,
          refresh_token_vault_secret_id,
          scopes,
          access_token_expires_at,
          connected_at,
          last_refreshed_at
        from mercury_oauth_connections
        where auth_user_id = ${authUserId}::uuid
          and environment = ${environment}
        limit 1
      `);
  return (rowsFromResult(result)[0] as ConnectionRow | undefined) ?? null;
}

function unavailableStatus(): MercuryOAuthConnectionStatus {
  return {
    available: false,
    connectionState: 'unavailable',
    environment: null,
    scopes: [],
    connectedAt: null,
    lastRefreshedAt: null,
    accessTokenExpiresAt: null,
  };
}

function statusFromRow(
  row: ConnectionRow | null,
  environment: MercuryOAuthEnvironment,
): MercuryOAuthConnectionStatus {
  const state = row?.status;
  return {
    available: true,
    connectionState:
      state === 'connected' || state === 'reauthorization_required'
        ? state
        : 'disconnected',
    environment,
    scopes: parseScopes(row?.scopes),
    connectedAt: toIsoString(row?.connected_at),
    lastRefreshedAt: toIsoString(row?.last_refreshed_at),
    accessTokenExpiresAt: toIsoString(row?.access_token_expires_at),
  };
}

export async function getMercuryOAuthConnectionStatusForUser(
  authUserId: string,
): Promise<MercuryOAuthConnectionStatus> {
  let config: MercuryOAuthConfig;
  try {
    config = getMercuryOAuthConfig();
  } catch {
    return unavailableStatus();
  }

  return withWriteDb(async (db) =>
    statusFromRow(await readConnection(db, authUserId, config.environment), config.environment),
  );
}

export async function startMercuryOAuthForUser(
  authUserId: string,
): Promise<MercuryOAuthStartResult> {
  const config = getMercuryOAuthConfig();
  const state = base64Url(randomBytes(32));
  const stateHash = hashState(state);
  const codeVerifier = base64Url(randomBytes(64));
  const codeChallenge = base64Url(createHash('sha256').update(codeVerifier).digest());
  const expiresAt = new Date(Date.now() + OAUTH_ATTEMPT_TTL_MS).toISOString();

  await withOAuthTransaction(async (db) => {
    await ensureProfileRow(db, authUserId);
    await db.execute(sql`
      delete from vault.secrets
      where id in (
        select pkce_verifier_vault_secret_id
        from mercury_oauth_attempts
        where auth_user_id = ${authUserId}::uuid
          and environment = ${config.environment}
          and pkce_verifier_vault_secret_id is not null
      )
    `);
    await db.execute(sql`
      delete from mercury_oauth_attempts
      where auth_user_id = ${authUserId}::uuid
        and environment = ${config.environment}
    `);

    const current = await readConnection(db, authUserId, config.environment, true);
    const nextFlow = current?.status === 'connected' ? 'reconnect' : 'connect';
    const verifierSecretId = await createVaultSecret(
      db,
      codeVerifier,
      `Mercury OAuth PKCE verifier (${config.environment})`,
    );

    await db.execute(sql`
      insert into mercury_oauth_attempts (
        state_hash,
        auth_user_id,
        environment,
        flow,
        pkce_verifier_vault_secret_id,
        redirect_uri,
        expires_at
      ) values (
        ${stateHash},
        ${authUserId}::uuid,
        ${config.environment},
        ${nextFlow},
        ${verifierSecretId}::uuid,
        ${config.redirectUri},
        ${expiresAt}::timestamptz
      )
    `);
  });

  const authorizeUrl = new URL('/oauth2/auth', config.oauthBaseUrl);
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizeUrl.searchParams.set('scope', MERCURY_OAUTH_SCOPES.join(' '));
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  return { authorizationUrl: authorizeUrl.toString() };
}

async function consumeOAuthAttempt(state: string): Promise<ConsumedAttempt> {
  const stateHash = hashState(state);
  return withOAuthTransaction(async (db) => {
    const result = await db.execute(sql`
      select
        auth_user_id,
        environment,
        flow,
        pkce_verifier_vault_secret_id,
        redirect_uri
      from mercury_oauth_attempts
      where state_hash = ${stateHash}
        and consumed_at is null
        and expires_at > now()
      limit 1
      for update
    `);
    const attempt = rowsFromResult(result)[0] as AttemptRow | undefined;
    if (!attempt?.auth_user_id || !attempt.pkce_verifier_vault_secret_id) {
      throw new MercuryOAuthError(
        'Mercury OAuth state is invalid or expired.',
        'oauth_state_invalid',
        400,
        true,
      );
    }

    const verifier = await readVaultSecret(db, attempt.pkce_verifier_vault_secret_id);
    if (!verifier) {
      throw new MercuryOAuthError(
        'Mercury OAuth verifier is unavailable.',
        'oauth_verifier_unavailable',
        400,
        true,
      );
    }

    await db.execute(sql`delete from mercury_oauth_attempts where state_hash = ${stateHash}`);
    await deleteVaultSecret(db, attempt.pkce_verifier_vault_secret_id);
    return { ...attempt, codeVerifier: verifier };
  });
}

function normalizeOAuthErrorCode(value: unknown): string {
  if (typeof value !== 'string') {
    return 'oauth_exchange_failed';
  }
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 64);
  return normalized || 'oauth_exchange_failed';
}

async function requestTokens(
  config: MercuryOAuthConfig,
  body: URLSearchParams,
): Promise<TokenResponse> {
  let response: Response;
  try {
    response = await fetch(new URL('/oauth2/token', config.oauthBaseUrl), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  } catch {
    throw new MercuryOAuthError(
      'Could not reach Mercury OAuth. Try again.',
      'oauth_network_failure',
      502,
    );
  }

  const rawText = await response.text();
  let raw: Record<string, unknown> = {};
  try {
    raw = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    raw = {};
  }

  if (!response.ok) {
    const code = normalizeOAuthErrorCode(raw.error);
    throw new MercuryOAuthError(
      code === 'invalid_grant'
        ? 'Mercury authorization expired. Reconnect your account.'
        : 'Mercury OAuth rejected the token request.',
      code,
      response.status >= 500 ? 502 : 400,
      code === 'invalid_grant',
    );
  }

  const accessToken = typeof raw.access_token === 'string' ? raw.access_token.trim() : '';
  const refreshToken = typeof raw.refresh_token === 'string' ? raw.refresh_token.trim() : '';
  const tokenType = typeof raw.token_type === 'string' ? raw.token_type.trim() : '';
  const scopes = parseScopes(raw.scope ?? MERCURY_OAUTH_SCOPES.join(' '));
  const expiresIn = typeof raw.expires_in === 'number' ? raw.expires_in : Number(raw.expires_in);
  const expiresInSeconds =
    Number.isFinite(expiresIn) && expiresIn > 0
      ? Math.min(Math.floor(expiresIn), 24 * 60 * 60)
      : DEFAULT_ACCESS_TOKEN_LIFETIME_SECONDS;

  if (
    !accessToken ||
    !refreshToken ||
    tokenType.toLowerCase() !== 'bearer' ||
    !MERCURY_OAUTH_SCOPES.every((scope) => scopes.includes(scope))
  ) {
    throw new MercuryOAuthError(
      'Mercury returned an incomplete OAuth grant.',
      'oauth_grant_invalid',
      502,
      true,
    );
  }

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    scopes,
    expiresInSeconds,
  };
}

async function exchangeAuthorizationCode(
  config: MercuryOAuthConfig,
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  return requestTokens(
    config,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  );
}

async function exchangeRefreshToken(
  config: MercuryOAuthConfig,
  refreshToken: string,
  scopes: string[],
): Promise<TokenResponse> {
  return requestTokens(
    config,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: scopes.join(' '),
    }),
  );
}

async function replaceConnectionTokens(
  db: OAuthDb,
  input: {
    authUserId: string;
    config: MercuryOAuthConfig;
    tokens: TokenResponse;
    event: 'oauth_connected' | 'oauth_reconnected' | 'oauth_refreshed';
    existing?: ConnectionRow | null;
  },
): Promise<void> {
  const accessSecretId = await createVaultSecret(
    db,
    input.tokens.accessToken,
    `Mercury OAuth access token (${input.config.environment})`,
  );
  const refreshSecretId = await createVaultSecret(
    db,
    input.tokens.refreshToken,
    `Mercury OAuth refresh token (${input.config.environment})`,
  );
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.tokens.expiresInSeconds * 1000).toISOString();
  const connectedAt = input.existing?.connected_at ?? now.toISOString();
  const lastRefreshedAt = input.event === 'oauth_refreshed' ? now.toISOString() : null;

  await db.execute(sql`
    insert into mercury_oauth_connections (
      auth_user_id,
      environment,
      status,
      access_token_vault_secret_id,
      refresh_token_vault_secret_id,
      scopes,
      access_token_expires_at,
      connected_at,
      last_refreshed_at,
      disconnected_at,
      rotation_version,
      deleted_at
    ) values (
      ${input.authUserId}::uuid,
      ${input.config.environment},
      'connected',
      ${accessSecretId}::uuid,
      ${refreshSecretId}::uuid,
      ${input.tokens.scopes}::text[],
      ${expiresAt}::timestamptz,
      ${toIsoString(connectedAt)}::timestamptz,
      ${lastRefreshedAt}::timestamptz,
      null,
      0,
      null
    )
    on conflict (auth_user_id, environment) do update set
      status = 'connected',
      access_token_vault_secret_id = excluded.access_token_vault_secret_id,
      refresh_token_vault_secret_id = excluded.refresh_token_vault_secret_id,
      scopes = excluded.scopes,
      access_token_expires_at = excluded.access_token_expires_at,
      connected_at = coalesce(mercury_oauth_connections.connected_at, excluded.connected_at),
      last_refreshed_at = case
        when ${input.event} = 'oauth_refreshed' then excluded.last_refreshed_at
        else null
      end,
      disconnected_at = null,
      rotation_version = mercury_oauth_connections.rotation_version + 1,
      deleted_at = null
  `);

  await deleteVaultSecret(db, input.existing?.access_token_vault_secret_id);
  await deleteVaultSecret(db, input.existing?.refresh_token_vault_secret_id);
  await recordMercuryCredentialEvent(db as WriteDb, {
    authUserId: input.authUserId,
    action: input.event,
    success: true,
  });
}

async function saveAuthorizationGrant(
  authUserId: string,
  config: MercuryOAuthConfig,
  tokens: TokenResponse,
  flow: 'connect' | 'reconnect',
): Promise<void> {
  await withOAuthTransaction(async (db) => {
    await ensureProfileRow(db, authUserId);
    const existing = await readConnection(db, authUserId, config.environment, true);
    await replaceConnectionTokens(db, {
      authUserId,
      config,
      tokens,
      event: flow === 'reconnect' || existing?.status === 'connected' ? 'oauth_reconnected' : 'oauth_connected',
      existing,
    });
  });
}

function callbackRedirect(
  config: MercuryOAuthConfig,
  outcome: 'connected' | 'reconnected' | 'cancelled' | 'error',
): Response {
  const location = new URL(MERCURY_OAUTH_RETURN_PATH, config.siteOrigin);
  location.searchParams.set('mercury_oauth', outcome);
  return new Response(null, {
    status: 303,
    headers: {
      'Cache-Control': 'no-store',
      Location: location.toString(),
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function handleMercuryOAuthCallback(request: Request): Promise<Response> {
  const config = getMercuryOAuthConfig();
  const url = new URL(request.url);
  const state = url.searchParams.get('state')?.trim() ?? '';
  if (!state) {
    return callbackRedirect(config, 'error');
  }

  let attempt: ConsumedAttempt;
  try {
    attempt = await consumeOAuthAttempt(state);
  } catch {
    return callbackRedirect(config, 'error');
  }

  if (attempt.environment !== config.environment || attempt.redirect_uri !== config.redirectUri) {
    return callbackRedirect(config, 'error');
  }

  const providerError = url.searchParams.get('error')?.trim() ?? '';
  if (providerError) {
    return callbackRedirect(config, providerError === 'access_denied' ? 'cancelled' : 'error');
  }

  const code = url.searchParams.get('code')?.trim() ?? '';
  const verifier = attempt.codeVerifier.trim();
  if (!code || !verifier || !attempt.auth_user_id || !attempt.redirect_uri || !attempt.flow) {
    return callbackRedirect(config, 'error');
  }

  try {
    const tokens = await exchangeAuthorizationCode(
      config,
      code,
      attempt.redirect_uri,
      verifier,
    );
    await saveAuthorizationGrant(attempt.auth_user_id, config, tokens, attempt.flow);
    return callbackRedirect(config, attempt.flow === 'reconnect' ? 'reconnected' : 'connected');
  } catch (error) {
    console.error('mercury_oauth_callback_failed', {
      code: error instanceof MercuryOAuthError ? error.code : 'oauth_callback_failed',
    });
    return callbackRedirect(config, 'error');
  }
}

async function markReauthorizationRequired(
  db: OAuthDb,
  authUserId: string,
  environment: MercuryOAuthEnvironment,
  row: ConnectionRow,
  errorCode = 'invalid_grant',
): Promise<void> {
  await deleteVaultSecret(db, row.access_token_vault_secret_id);
  await deleteVaultSecret(db, row.refresh_token_vault_secret_id);
  await db.execute(sql`
    update mercury_oauth_connections
    set
      status = 'reauthorization_required',
      access_token_vault_secret_id = null,
      refresh_token_vault_secret_id = null,
      access_token_expires_at = null,
      rotation_version = rotation_version + 1
    where auth_user_id = ${authUserId}::uuid
      and environment = ${environment}
  `);
  await recordMercuryCredentialEvent(db as WriteDb, {
    authUserId,
    action: 'oauth_refresh_failed',
    success: false,
    errorCode,
  });
}

export async function getValidMercuryOAuthAccessForUser(
  authUserId: string,
): Promise<MercuryOAuthAccess | null> {
  const config = getMercuryOAuthConfig();
  return withOAuthTransaction(async (db) => {
    await db.execute(sql`
      select pg_advisory_xact_lock(hashtextextended(${authUserId}, 0))
    `);
    const row = await readConnection(db, authUserId, config.environment, true);
    if (
      row?.status !== 'connected' ||
      !row.access_token_vault_secret_id ||
      !row.refresh_token_vault_secret_id
    ) {
      return null;
    }

    const expiresAt = toIsoString(row.access_token_expires_at);
    const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    if (Number.isFinite(expiresAtMs) && expiresAtMs > Date.now() + ACCESS_TOKEN_REFRESH_LEEWAY_MS) {
      const accessToken = await readVaultSecret(db, row.access_token_vault_secret_id);
      if (accessToken) {
        return { accessToken, environment: config.environment };
      }
      await markReauthorizationRequired(
        db,
        authUserId,
        config.environment,
        row,
        'access_token_missing',
      );
      return null;
    }

    const refreshToken = await readVaultSecret(db, row.refresh_token_vault_secret_id);
    if (!refreshToken) {
      await markReauthorizationRequired(
        db,
        authUserId,
        config.environment,
        row,
        'refresh_token_missing',
      );
      return null;
    }

    let tokens: TokenResponse;
    try {
      tokens = await exchangeRefreshToken(config, refreshToken, parseScopes(row.scopes));
    } catch (error) {
      if (error instanceof MercuryOAuthError && error.permanent) {
        await markReauthorizationRequired(db, authUserId, config.environment, row);
        return null;
      }
      throw error;
    }

    await replaceConnectionTokens(db, {
      authUserId,
      config,
      tokens,
      event: 'oauth_refreshed',
      existing: row,
    });
    return { accessToken: tokens.accessToken, environment: config.environment };
  });
}

export async function disconnectMercuryOAuthForUser(
  authUserId: string,
): Promise<MercuryOAuthConnectionStatus> {
  const config = getMercuryOAuthConfig();
  await withOAuthTransaction(async (db) => {
    await db.execute(sql`
      select pg_advisory_xact_lock(hashtextextended(${authUserId}, 0))
    `);
    const row = await readConnection(db, authUserId, config.environment, true);
    await deleteVaultSecret(db, row?.access_token_vault_secret_id);
    await deleteVaultSecret(db, row?.refresh_token_vault_secret_id);
    await db.execute(sql`
      delete from vault.secrets
      where id in (
        select pkce_verifier_vault_secret_id
        from mercury_oauth_attempts
        where auth_user_id = ${authUserId}::uuid
          and environment = ${config.environment}
          and pkce_verifier_vault_secret_id is not null
      )
    `);
    await db.execute(sql`
      delete from mercury_oauth_attempts
      where auth_user_id = ${authUserId}::uuid
        and environment = ${config.environment}
    `);
    await db.execute(sql`
      insert into mercury_oauth_connections (
        auth_user_id,
        environment,
        status,
        scopes,
        disconnected_at
      ) values (
        ${authUserId}::uuid,
        ${config.environment},
        'disconnected',
        array[]::text[],
        now()
      )
      on conflict (auth_user_id, environment) do update set
        status = 'disconnected',
        access_token_vault_secret_id = null,
        refresh_token_vault_secret_id = null,
        scopes = array[]::text[],
        access_token_expires_at = null,
        disconnected_at = now(),
        rotation_version = mercury_oauth_connections.rotation_version + 1
    `);
    await recordMercuryCredentialEvent(db as WriteDb, {
      authUserId,
      action: 'oauth_disconnected',
      success: true,
    });
  });

  return getMercuryOAuthConnectionStatusForUser(authUserId);
}

export function getMercuryApiBaseUrl(environment: MercuryOAuthEnvironment): string {
  return OAUTH_ENDPOINTS[environment].apiBaseUrl;
}
