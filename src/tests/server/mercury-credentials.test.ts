import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

type Query = ReturnType<typeof sql>;

type CredentialRow = {
  encrypted_api_key: string | null;
  iv: string | null;
  auth_tag: string | null;
  key_last_four: string | null;
  updated_at: string | null;
  deleted_at: string | null;
};

const testState = vi.hoisted(() => ({
  row: null as CredentialRow | null,
  accountsListMock: vi.fn(),
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

const fakeDb = {
  async execute(query: Query): Promise<{ rows: unknown[] }> {
    const { sql: text, params } = queryParts(query);

    if (text.includes('from mercury_credentials')) {
      return {
        rows:
          testState.row &&
          testState.row.deleted_at === null &&
          testState.row.encrypted_api_key &&
          testState.row.iv &&
          testState.row.auth_tag
            ? [testState.row]
            : [],
      };
    }

    if (text.includes('insert into user_profiles')) {
      return { rows: [] };
    }

    if (text.includes('insert into mercury_credentials')) {
      const [, encryptedApiKey, iv, authTag, keyLastFour, , updatedAt] = params as string[];
      testState.row = {
        encrypted_api_key: encryptedApiKey,
        iv,
        auth_tag: authTag,
        key_last_four: keyLastFour,
        updated_at: updatedAt,
        deleted_at: null,
      };
      return { rows: [] };
    }

    if (text.includes('update mercury_credentials')) {
      const deletedAt = params[0] as string;
      if (testState.row) {
        testState.row = {
          encrypted_api_key: null,
          iv: null,
          auth_tag: null,
          key_last_four: null,
          updated_at: deletedAt,
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
  createMercuryClient: vi.fn(() => ({
    accounts: { list: testState.accountsListMock },
  })),
}));

describe('Mercury credential storage', () => {
  beforeEach(() => {
    vi.resetModules();
    testState.row = null;
    testState.accountsListMock.mockReset();
    testState.accountsListMock.mockResolvedValue({ items: [] });
    process.env.MERCURY_API_KEY_ENCRYPTION_SECRET = 'unit-test-encryption-secret';
  });

  it('saves, tests, reports masked status, and deletes a credential', async () => {
    const rawKey = 'secret-token:mercury_production_wma_1234567890_yrucrem';
    const {
      deleteMercuryCredentialForUser,
      getMercuryCredentialStatusForUser,
      saveMercuryCredentialForUser,
      testMercuryCredentialForUser,
    } = await import('@/server/mercury/credentials');

    await expect(getMercuryCredentialStatusForUser('user-1')).resolves.toEqual({
      configured: false,
      keyLastFour: null,
      updatedAt: null,
    });

    const savedStatus = await saveMercuryCredentialForUser('user-1', rawKey);
    expect(savedStatus).toEqual({
      configured: true,
      keyLastFour: 'crem',
      updatedAt: expect.any(String),
    });
    expect(JSON.stringify(savedStatus)).not.toContain(rawKey);
    expect(testState.row?.encrypted_api_key).not.toBe(rawKey);

    await testMercuryCredentialForUser('user-1');
    expect(testState.accountsListMock).toHaveBeenCalledWith({ limit: 1 });

    await deleteMercuryCredentialForUser('user-1');
    await expect(getMercuryCredentialStatusForUser('user-1')).resolves.toEqual({
      configured: false,
      keyLastFour: null,
      updatedAt: null,
    });
  });

  it('fails safely when the encryption secret is missing', async () => {
    process.env.MERCURY_API_KEY_ENCRYPTION_SECRET = '';
    const { saveMercuryCredentialForUser } = await import('@/server/mercury/credentials');

    await expect(
      saveMercuryCredentialForUser(
        'user-1',
        'secret-token:mercury_production_wma_1234567890_yrucrem',
      ),
    ).rejects.toThrow('Missing MERCURY_API_KEY_ENCRYPTION_SECRET');
    expect(testState.row).toBeNull();
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
});
