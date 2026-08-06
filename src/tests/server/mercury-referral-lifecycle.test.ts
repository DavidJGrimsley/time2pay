import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  expireAccessGrant,
  upsertAccessGrant,
} from '@/database/hosted/billing/queries';
import { withWriteDb } from '@/server/db/_shared/db';

const testState = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock('@/server/db/_shared/db', () => ({
  withWriteDb: vi.fn(),
}));

vi.mock('@/database/hosted/billing/queries', () => ({
  expireAccessGrant: vi.fn(),
  upsertAccessGrant: vi.fn(),
}));

const withWriteDbMock = vi.mocked(withWriteDb);
const upsertAccessGrantMock = vi.mocked(upsertAccessGrant);
const expireAccessGrantMock = vi.mocked(expireAccessGrant);
const fakeDb = { execute: testState.execute };

describe('Mercury referral lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    withWriteDbMock.mockImplementation(async (work) => work(fakeDb as never));
    testState.execute.mockResolvedValue({ rows: [{ status: 'pending_qualification' }] });
  });

  it('creates an individual temporary grant only after verified application start', async () => {
    const { verifyMercuryReferralApplication } = await import('@/server/mercury/referrals');

    await verifyMercuryReferralApplication({
      authUserId: '7f5c2be8-6963-432f-b84d-b81635cf0477',
      qualificationDeadlineAt: '2030-10-12T12:00:00.000Z',
      verificationSource: 'mercury_partner_export',
      externalReference: 'application-123',
    });

    expect(upsertAccessGrantMock).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({
        authUserId: '7f5c2be8-6963-432f-b84d-b81635cf0477',
        source: 'mercury_pending_grace',
        grantType: 'temporary',
        sourceReferenceId: 'application-123',
      }),
    );
  });

  it('does not recreate temporary access when an application is already terminal', async () => {
    testState.execute.mockResolvedValue({ rows: [{ status: 'qualified' }] });
    const { verifyMercuryReferralApplication } = await import('@/server/mercury/referrals');

    await verifyMercuryReferralApplication({
      authUserId: '7f5c2be8-6963-432f-b84d-b81635cf0477',
      qualificationDeadlineAt: '2030-10-12T12:00:00.000Z',
      verificationSource: 'mercury_partner_export',
    });

    expect(upsertAccessGrantMock).not.toHaveBeenCalled();
  });

  it('upgrades a qualified referral to lifetime access and expires its temporary grant', async () => {
    const { qualifyMercuryReferral } = await import('@/server/mercury/referrals');

    await qualifyMercuryReferral({
      authUserId: '7f5c2be8-6963-432f-b84d-b81635cf0477',
      verificationSource: 'mercury_partner_export',
      externalReference: 'application-123',
    });

    expect(upsertAccessGrantMock).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({
        source: 'mercury_qualified',
        grantType: 'lifetime',
        expiresAt: null,
      }),
    );
    expect(expireAccessGrantMock).toHaveBeenCalledWith(
      fakeDb,
      '7f5c2be8-6963-432f-b84d-b81635cf0477',
      'mercury_pending_grace',
    );
  });

  it('rejects a non-future verified qualification deadline before writing', async () => {
    const { verifyMercuryReferralApplication } = await import('@/server/mercury/referrals');

    await expect(
      verifyMercuryReferralApplication({
        authUserId: '7f5c2be8-6963-432f-b84d-b81635cf0477',
        qualificationDeadlineAt: '2020-01-01T00:00:00.000Z',
        verificationSource: 'mercury_partner_export',
      }),
    ).rejects.toThrow('qualificationDeadlineAt must be in the future.');

    expect(withWriteDbMock).not.toHaveBeenCalled();
  });
});