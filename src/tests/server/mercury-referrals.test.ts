import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

type Query = ReturnType<typeof sql>;

type ReferralRow = {
  referral_url: string;
  status: string;
  click_count: number;
  first_clicked_at: string | null;
  last_clicked_at: string | null;
  application_started_at: string | null;
  qualification_deadline_at: string | null;
  qualified_at: string | null;
  failed_at: string | null;
  expired_at: string | null;
  verification_source: string | null;
  premium_access_granted_at: string | null;
  deleted_at: string | null;
};

const testState = vi.hoisted(() => ({
  row: null as ReferralRow | null,
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

    if (text.includes('from mercury_referrals')) {
      return {
        rows: testState.row && testState.row.deleted_at === null ? [testState.row] : [],
      };
    }

    if (text.includes('insert into user_profiles')) {
      return { rows: [] };
    }

    if (text.includes('insert into mercury_referrals')) {
      const [, referralUrl, , firstClickedAt, lastClickedAt] = params as string[];
      if (testState.row) {
        testState.row = {
          ...testState.row,
          referral_url: referralUrl,
          click_count: testState.row.click_count + 1,
          first_clicked_at: testState.row.first_clicked_at ?? firstClickedAt,
          last_clicked_at: lastClickedAt,
          status:
            [
              'application_started',
              'pending_qualification',
              'qualified',
              'failed',
              'expired',
              'existing_customer',
            ].includes(testState.row.status)
              ? testState.row.status
              : 'clicked',
          deleted_at: null,
        };
      } else {
        testState.row = {
          referral_url: referralUrl,
            status: 'clicked',
          click_count: 1,
          first_clicked_at: firstClickedAt,
          last_clicked_at: lastClickedAt,
            application_started_at: null,
            qualification_deadline_at: null,
            qualified_at: null,
            failed_at: null,
            expired_at: null,
            verification_source: null,
          premium_access_granted_at: null,
          deleted_at: null,
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

describe('Mercury referral tracking', () => {
  beforeEach(() => {
    vi.resetModules();
    testState.row = null;
  });

  it('returns no premium access before a referral click is recorded', async () => {
    const { getMercuryReferralStatusForUser } = await import('@/server/mercury/referrals');

    await expect(getMercuryReferralStatusForUser('user-1')).resolves.toEqual({
      referralUrl: 'https://mercury.com/partner/time2pay',
      status: 'not_started',
      clickCount: 0,
      firstClickedAt: null,
      lastClickedAt: null,
      applicationStartedAt: null,
      qualificationDeadlineAt: null,
      qualifiedAt: null,
      failedAt: null,
      expiredAt: null,
      verificationSource: null,
      premiumAccess: false,
      premiumAccessGrantedAt: null,
    });
  });

  it('records authenticated referral clicks without treating them as qualification proof', async () => {
    const { recordMercuryReferralClickForUser } = await import('@/server/mercury/referrals');

    await expect(recordMercuryReferralClickForUser('user-1')).resolves.toMatchObject({
      status: 'clicked',
      clickCount: 1,
      premiumAccess: false,
    });

    await expect(recordMercuryReferralClickForUser('user-1')).resolves.toMatchObject({
      status: 'clicked',
      clickCount: 2,
      premiumAccess: false,
    });
  });

  it('preserves manually granted premium access when a user clicks again', async () => {
    testState.row = {
      referral_url: 'https://mercury.com/partner/time2pay',
      status: 'qualified',
      click_count: 1,
      first_clicked_at: '2026-04-20T12:00:00.000Z',
      last_clicked_at: '2026-04-20T12:00:00.000Z',
      application_started_at: null,
      qualification_deadline_at: null,
      qualified_at: '2026-04-20T13:00:00.000Z',
      failed_at: null,
      expired_at: null,
      verification_source: 'manual',
      premium_access_granted_at: '2026-04-20T13:00:00.000Z',
      deleted_at: null,
    };
    const { recordMercuryReferralClickForUser } = await import('@/server/mercury/referrals');

    await expect(recordMercuryReferralClickForUser('user-1')).resolves.toMatchObject({
      status: 'qualified',
      clickCount: 2,
      premiumAccess: true,
      premiumAccessGrantedAt: '2026-04-20T13:00:00.000Z',
    });
  });
});
