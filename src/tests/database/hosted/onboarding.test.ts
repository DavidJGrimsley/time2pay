import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acceptHostedLegalDocument,
  recordHostedOnboardingStepCompleted,
  getHostedOnboardingGateSnapshot,
} from '@/database/hosted/onboarding/queries';
import { getSupabaseClient, getSupabaseUser, requireSupabaseUserId } from '@/services/supabase-client';

vi.mock('@/services/supabase-client', () => ({
  getSupabaseClient: vi.fn(),
  getSupabaseUser: vi.fn(),
  requireSupabaseUserId: vi.fn(),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function makeQuery(result: QueryResult) {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    select: vi.fn(() => query),
    upsert: vi.fn(() => Promise.resolve(result)),
  };
  return query;
}

const requiredDocuments = [
  { documentId: 'terms', documentVersion: '2026-03-28' },
  { documentId: 'privacy', documentVersion: '2026-03-28' },
];

const getSupabaseClientMock = vi.mocked(getSupabaseClient);
const getSupabaseUserMock = vi.mocked(getSupabaseUser);
const requireSupabaseUserIdMock = vi.mocked(requireSupabaseUserId);

beforeEach(() => {
  requireSupabaseUserIdMock.mockResolvedValue('user-1');
  getSupabaseUserMock.mockResolvedValue({
    id: 'user-1',
    email: 'user@example.com',
    user_metadata: {},
  } as Awaited<ReturnType<typeof getSupabaseUser>>);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('hosted onboarding queries', () => {
  it('reports needs-onboarding when no state row exists', async () => {
    const queries = {
      user_profiles: makeQuery({
        data: { auth_user_id: 'user-1', full_name: null, email: 'user@example.com' },
        error: null,
      }),
      user_onboarding_state: makeQuery({ data: null, error: null }),
      user_legal_acceptances: makeQuery({ data: [], error: null }),
    };
    getSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: keyof typeof queries) => queries[table]),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    await expect(getHostedOnboardingGateSnapshot(requiredDocuments)).resolves.toMatchObject({
      status: 'needs-onboarding',
      completedStepIds: [],
      missingDocumentIds: ['terms', 'privacy'],
    });
  });

  it('reports needs-legal for backfilled users missing current acceptance records', async () => {
    const queries = {
      user_profiles: makeQuery({
        data: { auth_user_id: 'user-1', full_name: null, email: 'user@example.com' },
        error: null,
      }),
      user_onboarding_state: makeQuery({
        data: {
          completed_step_ids: ['welcome', 'features', 'auth'],
          completed_at: null,
        },
        error: null,
      }),
      user_legal_acceptances: makeQuery({ data: [], error: null }),
    };
    getSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: keyof typeof queries) => queries[table]),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    await expect(getHostedOnboardingGateSnapshot(requiredDocuments)).resolves.toMatchObject({
      status: 'needs-legal',
      completedStepIds: ['welcome', 'features', 'auth'],
      missingDocumentIds: ['terms', 'privacy'],
    });
  });

  it('reports complete when current legal versions and completion are stored', async () => {
    const queries = {
      user_profiles: makeQuery({
        data: { auth_user_id: 'user-1', full_name: null, email: 'user@example.com' },
        error: null,
      }),
      user_onboarding_state: makeQuery({
        data: {
          completed_step_ids: ['welcome', 'features', 'auth', 'legal'],
          completed_at: '2026-08-11T12:00:00.000Z',
        },
        error: null,
      }),
      user_legal_acceptances: makeQuery({
        data: [
          { document_id: 'terms', document_version: '2026-03-28' },
          { document_id: 'privacy', document_version: '2026-03-28' },
        ],
        error: null,
      }),
    };
    getSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: keyof typeof queries) => queries[table]),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    await expect(getHostedOnboardingGateSnapshot(requiredDocuments)).resolves.toMatchObject({
      status: 'complete',
      missingDocumentIds: [],
    });
  });

  it('reports needs-legal when a completed user accepted an older material document version', async () => {
    const nextRequiredDocuments = [
      { documentId: 'terms', documentVersion: '2026-08-12' },
      { documentId: 'privacy', documentVersion: '2026-03-28' },
    ];
    const queries = {
      user_profiles: makeQuery({
        data: { auth_user_id: 'user-1', full_name: null, email: 'user@example.com' },
        error: null,
      }),
      user_onboarding_state: makeQuery({
        data: {
          completed_step_ids: ['welcome', 'features', 'auth', 'legal'],
          completed_at: '2026-08-11T12:00:00.000Z',
        },
        error: null,
      }),
      user_legal_acceptances: makeQuery({
        data: [
          { document_id: 'terms', document_version: '2026-03-28' },
          { document_id: 'privacy', document_version: '2026-03-28' },
        ],
        error: null,
      }),
    };
    getSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: keyof typeof queries) => queries[table]),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    await expect(getHostedOnboardingGateSnapshot(nextRequiredDocuments)).resolves.toMatchObject({
      status: 'needs-legal',
      missingDocumentIds: ['terms'],
    });
  });

  it('writes versioned legal acceptance and blocks when the write fails', async () => {
    const legalAcceptances = makeQuery({ data: null, error: { message: 'write denied' } });
    const events = makeQuery({ data: null, error: null });
    const queries = {
      user_profiles: makeQuery({
        data: { auth_user_id: 'user-1', full_name: null, email: 'user@example.com' },
        error: null,
      }),
      user_legal_acceptances: legalAcceptances,
      user_onboarding_events: events,
    };
    getSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: keyof typeof queries) => queries[table]),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    await expect(
      acceptHostedLegalDocument({ documentId: 'terms', documentVersion: '2026-03-28' }),
    ).rejects.toThrow('write denied');
    expect(legalAcceptances.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        auth_user_id: 'user-1',
        document_id: 'terms',
        document_version: '2026-03-28',
      }),
      expect.objectContaining({
        ignoreDuplicates: true,
        onConflict: 'auth_user_id,document_id,document_version',
      }),
    );
    expect(events.insert).not.toHaveBeenCalled();
  });

  it('records completed steps and append-only onboarding events', async () => {
    const state = makeQuery({
      data: {
        completed_step_ids: ['welcome'],
        completed_at: null,
      },
      error: null,
    });
    const events = makeQuery({ data: null, error: null });
    const queries = {
      user_profiles: makeQuery({
        data: { auth_user_id: 'user-1', full_name: null, email: 'user@example.com' },
        error: null,
      }),
      user_onboarding_state: state,
      user_onboarding_events: events,
    };
    getSupabaseClientMock.mockReturnValue({
      from: vi.fn((table: keyof typeof queries) => queries[table]),
    } as unknown as ReturnType<typeof getSupabaseClient>);

    await recordHostedOnboardingStepCompleted('features', { source: 'test' });

    expect(state.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        auth_user_id: 'user-1',
        completed_step_ids: ['welcome', 'features'],
        completed_at: null,
        metadata: { source: 'test' },
      }),
      { onConflict: 'auth_user_id' },
    );
    expect(events.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        auth_user_id: 'user-1',
        step_id: 'features',
        event_type: 'step_completed',
        metadata: { source: 'test' },
      }),
    );
  });
});
