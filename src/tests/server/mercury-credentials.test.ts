import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

type Query = ReturnType<typeof sql>;

type CredentialRow = {
  vault_secret_id: string | null;
  encrypted_api_key: string | null;
  iv: string | null;
  auth_tag: string | null;
  key_last_four: string | null;
  ar_access_available: boolean | null;
  ar_access_verified_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

type HistoryRow = {
  auth_user_id: string;
  vault_secret_id: string | null;
  key_last_four: string | null;
  retired_reason: string;
};

type EventRow = {
  auth_user_id: string;
  action: string;
  key_last_four: string | null;
  success: boolean | null;
  error_code: string | null;
};

const testState = vi.hoisted(() => ({
  row: null as CredentialRow | null,
  history: [] as HistoryRow[],
  events: [] as EventRow[],
  vaultSecrets: new Map<string, string>(),
  nextVaultId: 1,
  accountsListMock: vi.fn(),
  createMercuryClientMock: vi.fn(),
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
  return { sql: sqlText, params };
}

function isActiveRow(row: CredentialRow | null): boolean {
  if (!row || row.deleted_at !== null) return false;
  return Boolean(
    row.vault_secret_id ||
      (row.encrypted_api_key && row.iv && row.auth_tag),
  );
}

const fakeDb = {
  async execute(query: Query): Promise<{ rows: unknown[] }> {
    const { sql: text, params } = queryParts(query);

    if (text.includes('vault.create_secret')) {
      const id = `00000000-0000-0000-0000-${String(testState.nextVaultId++).padStart(12, '0')}`;
      testState.vaultSecrets.set(id, params[0] as string);
      return { rows: [{ id }] };
    }

    if (text.includes('from vault.decrypted_secrets')) {
      const id = params[0] as string;
      const secret = testState.vaultSecrets.get(id);
      return { rows: secret ? [{ decrypted_secret: secret }] : [] };
    }

    if (text.includes('from mercury_credentials')) {
      return { rows: isActiveRow(testState.row) ? [testState.row] : [] };
    }

    if (text.includes('insert into user_profiles')) {
      return { rows: [] };
    }

    if (text.includes('insert into mercury_credential_history')) {
      const [authUserId, vaultSecretId, keyLastFour] = params as (string | null)[];
      const retiredReason = /'(rotated|deleted)'/.exec(text)?.[1] ?? 'unknown';
      testState.history.push({
        auth_user_id: authUserId as string,
        vault_secret_id: vaultSecretId,
        key_last_four: keyLastFour,
        retired_reason: retiredReason,
      });
      return { rows: [] };
    }

    if (text.includes('insert into mercury_credential_events')) {
      const [authUserId, action, keyLastFour, success, errorCode] = params as (string | boolean | null)[];
      testState.events.push({
        auth_user_id: authUserId as string,
        action: action as string,
        key_last_four: keyLastFour as string | null,
        success: success as boolean | null,
        error_code: errorCode as string | null,
      });
      return { rows: [] };
    }

    if (text.includes('insert into mercury_credentials')) {
      // SQL params (in order): authUserId, vaultSecretId, keyLastFour,
      // preservedArAccessAvailable, preservedArAccessVerifiedAt.
      // The other columns (encrypted_api_key/iv/auth_tag/deleted_at) are
      // SQL `null` literals, not interpolated parameters.
      const [
        ,
        vaultSecretId,
        keyLastFour,
        arAccessAvailable,
        arAccessVerifiedAt,
      ] = params as (string | boolean | null)[];
      testState.row = {
        vault_secret_id: (vaultSecretId as string | null) ?? null,
        encrypted_api_key: null,
        iv: null,
        auth_tag: null,
        key_last_four: (keyLastFour as string | null) ?? null,
        ar_access_available: (arAccessAvailable as boolean | null) ?? null,
        ar_access_verified_at: (arAccessVerifiedAt as string | null) ?? null,
        updated_at: (arAccessVerifiedAt as string | null) ?? null,
        deleted_at: null,
      };
      return { rows: [] };
    }

    if (text.includes('update mercury_credentials')) {
      if (/set\s+ar_access_available/.test(text)) {
        // setMercuryArAccessForUser path: params [enabled, verifiedAt, authUserId]
        const [enabled, verifiedAt] = params as (string | boolean | null)[];
        if (testState.row) {
          testState.row = {
            ...testState.row,
            ar_access_available: enabled as boolean | null,
            ar_access_verified_at: verifiedAt as string | null,
          };
        }
        return { rows: [] };
      }

      // delete path: params [deletedAt, authUserId]
      const deletedAt = params[0] as string;
      if (testState.row) {
        testState.row = {
          ...testState.row,
          vault_secret_id: null,
          encrypted_api_key: null,
          iv: null,
          auth_tag: null,
          key_last_four: null,
          ar_access_available: null,
          ar_access_verified_at: null,
          deleted_at: deletedAt,
        };
      }
      return { rows: [] };
    }

    throw new Error(`Unhandled SQL: ${text}`);
  },
};

vi.mock('@/server/db/_shared/db', () => ({
  withWriteDb: vi.fn((work) => work(fakeDb)),
}));

vi.mock('@mr.dj2u/mercury', () => ({
  createMercuryClient: testState.createMercuryClientMock.mockImplementation(() => ({
    accounts: { list: testState.accountsListMock },
  })),
}));

describe('Mercury credential storage', () => {
  beforeEach(() => {
    vi.resetModules();
    testState.row = null;
    testState.history = [];
    testState.events = [];
    testState.vaultSecrets = new Map();
    testState.nextVaultId = 1;
    testState.accountsListMock.mockReset();
    testState.accountsListMock.mockResolvedValue({ items: [] });
    testState.createMercuryClientMock.mockClear();
  });

  it('saves a key into Vault and exposes status with null AR (manual toggle required)', async () => {
    const rawKey = 'secret-token:mercury_production_wma_1234567890_yrucrem';
    const {
      saveMercuryCredentialForUser,
      getMercuryCredentialStatusForUser,
      getDecryptedMercuryApiKeyForUser,
    } = await import('@/server/mercury/credentials');

    const before = await getMercuryCredentialStatusForUser('user-1');
    expect(before).toEqual({
      configured: false,
      keyLastFour: null,
      updatedAt: null,
      arAccessAvailable: null,
      arAccessVerifiedAt: null,
    });

    const saved = await saveMercuryCredentialForUser('user-1', rawKey);
    expect(saved.configured).toBe(true);
    expect(saved.keyLastFour).toBe('crem');
    // Save no longer probes Mercury for AR access — the user opts in
    // manually via setMercuryArAccessForUser. AR fields stay null.
    expect(saved.arAccessAvailable).toBeNull();

    expect(testState.row?.vault_secret_id).not.toBeNull();
    expect(testState.row?.encrypted_api_key).toBeNull();
    expect(JSON.stringify(testState.row)).not.toContain(rawKey);

    expect(testState.events.map((e) => e.action)).toContain('created');
    expect(testState.events.map((e) => e.action)).not.toContain('ar_probed');
    expect(testState.createMercuryClientMock).toHaveBeenCalledWith({
      apiKey: rawKey,
      environment: 'production',
    });
    expect(testState.accountsListMock).toHaveBeenCalledWith({ limit: 1 });

    const decrypted = await getDecryptedMercuryApiKeyForUser('user-1');
    expect(decrypted).toBe(rawKey);
  });

  it('lets the user manually enable and disable Mercury AR access', async () => {
    const {
      saveMercuryCredentialForUser,
      setMercuryArAccessForUser,
      getMercuryCredentialStatusForUser,
    } = await import('@/server/mercury/credentials');

    await saveMercuryCredentialForUser(
      'user-1',
      'secret-token:mercury_production_wma_x_yrucrem',
    );

    const enabled = await setMercuryArAccessForUser('user-1', true);
    expect(enabled.arAccessAvailable).toBe(true);
    expect(enabled.arAccessVerifiedAt).toEqual(expect.any(String));

    const enabledEvent = testState.events.findLast((e) => e.action === 'ar_probed');
    expect(enabledEvent?.success).toBe(true);
    expect(enabledEvent?.error_code).toBeNull();

    const status = await getMercuryCredentialStatusForUser('user-1');
    expect(status.arAccessAvailable).toBe(true);

    const disabled = await setMercuryArAccessForUser('user-1', false);
    expect(disabled.arAccessAvailable).toBe(false);

    const disabledEvent = testState.events.findLast((e) => e.action === 'ar_probed');
    expect(disabledEvent?.success).toBe(false);
    expect(disabledEvent?.error_code).toBe('user_disabled');
  });

  it('preserves the AR toggle across a key rotation', async () => {
    const {
      saveMercuryCredentialForUser,
      setMercuryArAccessForUser,
      getMercuryCredentialStatusForUser,
    } = await import('@/server/mercury/credentials');

    await saveMercuryCredentialForUser(
      'user-1',
      'secret-token:mercury_production_wma_first_yrucrem',
    );
    await setMercuryArAccessForUser('user-1', true);

    await saveMercuryCredentialForUser(
      'user-1',
      'secret-token:mercury_production_wma_second_yrucrem',
    );

    const status = await getMercuryCredentialStatusForUser('user-1');
    expect(status.arAccessAvailable).toBe(true);
  });

  it('throws when enabling AR before a key is saved', async () => {
    const { setMercuryArAccessForUser } = await import('@/server/mercury/credentials');

    await expect(setMercuryArAccessForUser('user-1', true)).rejects.toThrow(
      /No Mercury API key is saved/i,
    );
  });

  it('writes a rotation history row when an existing key is replaced', async () => {
    const { saveMercuryCredentialForUser } = await import('@/server/mercury/credentials');

    await saveMercuryCredentialForUser(
      'user-1',
      'secret-token:mercury_production_wma_first_yrucrem',
    );
    await saveMercuryCredentialForUser(
      'user-1',
      'secret-token:mercury_production_wma_second_yrucrem',
    );

    expect(testState.history).toHaveLength(1);
    expect(testState.history[0].retired_reason).toBe('rotated');
    expect(testState.events.filter((e) => e.action === 'rotated')).toHaveLength(1);
  });

  it('soft-deletes and writes a history row for delete', async () => {
    const {
      saveMercuryCredentialForUser,
      deleteMercuryCredentialForUser,
      getMercuryCredentialStatusForUser,
    } = await import('@/server/mercury/credentials');

    await saveMercuryCredentialForUser(
      'user-1',
      'secret-token:mercury_production_wma_some_yrucrem',
    );
    await deleteMercuryCredentialForUser('user-1');

    const status = await getMercuryCredentialStatusForUser('user-1');
    expect(status.configured).toBe(false);
    expect(testState.history.some((h) => h.retired_reason === 'deleted')).toBe(true);
    expect(testState.events.some((e) => e.action === 'deleted')).toBe(true);
  });

  it('records a successful test event', async () => {
    const {
      saveMercuryCredentialForUser,
      testMercuryCredentialForUser,
    } = await import('@/server/mercury/credentials');

    await saveMercuryCredentialForUser(
      'user-1',
      'secret-token:mercury_production_wma_x_yrucrem',
    );
    await testMercuryCredentialForUser('user-1');

    expect(testState.accountsListMock).toHaveBeenCalledWith({ limit: 1 });
    const tested = testState.events.filter((e) => e.action === 'tested');
    expect(tested).toHaveLength(2);
    expect(tested.every((event) => event.success === true)).toBe(true);
  });

  it('rejects sandbox keys for hosted user storage', async () => {
    const { saveMercuryCredentialForUser } = await import('@/server/mercury/credentials');

    await expect(
      saveMercuryCredentialForUser(
        'user-1',
        'secret-token:mercury_sandbox_wma_1234567890_yrucrem',
      ),
    ).rejects.toThrow('Sandbox keys are only used in tour mode.');
  });

  it('rejects a production key missing Mercury\'s complete token prefix', async () => {
    const { saveMercuryCredentialForUser } = await import('@/server/mercury/credentials');

    await expect(
      saveMercuryCredentialForUser('user-1', 'mercury_production_wma_missing_secret_token'),
    ).rejects.toThrow('secret-token:mercury_production_');
    expect(testState.accountsListMock).not.toHaveBeenCalled();
    expect(testState.row).toBeNull();
  });

  it('does not replace an existing key when the submitted production key is rejected by Mercury', async () => {
    const { getDecryptedMercuryApiKeyForUser, saveMercuryCredentialForUser } =
      await import('@/server/mercury/credentials');
    const existingKey = 'secret-token:mercury_production_wma_existing_yrucrem';
    const rejectedKey = 'secret-token:mercury_production_wma_rejected_yrucrem';

    await saveMercuryCredentialForUser('user-1', existingKey);
    testState.accountsListMock.mockRejectedValueOnce(
      Object.assign(new Error('Mercury request failed with status 401.'), { status: 401 }),
    );

    await expect(saveMercuryCredentialForUser('user-1', rejectedKey)).rejects.toThrow('401');
    await expect(getDecryptedMercuryApiKeyForUser('user-1')).resolves.toBe(existingKey);
    expect(testState.history).toHaveLength(0);

    const failedProbe = testState.events.findLast(
      (event) => event.action === 'tested' && event.success === false,
    );
    expect(failedProbe).toMatchObject({
      key_last_four: 'crem',
      error_code: 'mercury_unauthorized',
    });
  });
});
