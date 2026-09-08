import { sql } from 'drizzle-orm';
import type {
  MercuryReferralStatus,
  MercuryReferralStatusValue,
} from '@/database/hosted/mercury/types';
import {
  expireAccessGrant,
  upsertAccessGrant,
} from '@/database/hosted/billing/queries';
import { withWriteDb, type WriteDb } from '@/server/db/_shared/db';

export const MERCURY_REFERRAL_URL = 'https://mercury.com/partner/time2pay';

export type { MercuryReferralStatus, MercuryReferralStatusValue };

type ReferralRow = {
  referral_url?: string | null;
  status?: string | null;
  click_count?: number | string | null;
  first_clicked_at?: string | Date | null;
  last_clicked_at?: string | Date | null;
  application_started_at?: string | Date | null;
  qualification_deadline_at?: string | Date | null;
  qualified_at?: string | Date | null;
  failed_at?: string | Date | null;
  expired_at?: string | Date | null;
  verification_source?: string | null;
  premium_access_granted_at?: string | Date | null;
};

const TERMINAL_MERCURY_REFERRAL_STATUSES = new Set<MercuryReferralStatusValue>([
  'qualified',
  'failed',
  'expired',
  'existing_customer',
]);

export type MercuryReferralApplicationInput = {
  authUserId: string;
  applicationStartedAt?: string;
};

export type VerifiedMercuryReferralApplicationInput = {
  authUserId: string;
  qualificationDeadlineAt: string;
  verificationSource: string;
  externalReference?: string | null;
  verifiedBy?: string | null;
};

export type MercuryReferralOutcomeInput = {
  authUserId: string;
  verificationSource: string;
  externalReference?: string | null;
  verifiedBy?: string | null;
};

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
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return null;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseIsoTimestamp(value: string, fieldName: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO timestamp.`);
  }
  return parsed.toISOString();
}

function parseFutureDeadline(value: string): string {
  const deadline = parseIsoTimestamp(value, 'qualificationDeadlineAt');
  if (new Date(deadline).getTime() <= Date.now()) {
    throw new Error('qualificationDeadlineAt must be in the future.');
  }
  return deadline;
}

function requiredText(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

function optionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeStatus(value: unknown): MercuryReferralStatusValue {
  if (
    value === 'not_started' ||
    value === 'clicked' ||
    value === 'application_started' ||
    value === 'pending_qualification' ||
    value === 'qualified' ||
    value === 'failed' ||
    value === 'expired' ||
    value === 'existing_customer'
  ) {
    return value;
  }

  if (value === 'pending_review') {
    return 'pending_qualification';
  }

  if (value === 'rejected') {
    return 'failed';
  }

  return 'not_started';
}

function rowToStatus(row: ReferralRow | null): MercuryReferralStatus {
  if (!row) {
    return {
      referralUrl: MERCURY_REFERRAL_URL,
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
    };
  }

  const premiumAccessGrantedAt = toIsoString(row.premium_access_granted_at);
  return {
    referralUrl: row.referral_url ?? MERCURY_REFERRAL_URL,
    status: normalizeStatus(row.status),
    clickCount: toNumber(row.click_count),
    firstClickedAt: toIsoString(row.first_clicked_at),
    lastClickedAt: toIsoString(row.last_clicked_at),
    applicationStartedAt: toIsoString(row.application_started_at),
    qualificationDeadlineAt: toIsoString(row.qualification_deadline_at),
    qualifiedAt: toIsoString(row.qualified_at),
    failedAt: toIsoString(row.failed_at),
    expiredAt: toIsoString(row.expired_at),
    verificationSource: row.verification_source ?? null,
    premiumAccess: normalizeStatus(row.status) === 'qualified' || Boolean(premiumAccessGrantedAt),
    premiumAccessGrantedAt,
  };
}

async function ensureProfileRow(db: WriteDb, authUserId: string): Promise<void> {
  await db.execute(sql`
    insert into user_profiles (auth_user_id)
    values (${authUserId}::uuid)
    on conflict (auth_user_id) do nothing
  `);
}

async function readTransitionStatus(
  db: WriteDb,
  query: ReturnType<typeof sql>,
): Promise<MercuryReferralStatusValue> {
  const result = await db.execute(query);
  const row = rowsFromResult(result)[0] as ReferralRow | undefined;
  return normalizeStatus(row?.status);
}

export async function recordMercuryReferralApplicationStarted(
  input: MercuryReferralApplicationInput,
): Promise<MercuryReferralStatus> {
  const timestamp = input.applicationStartedAt
    ? parseIsoTimestamp(input.applicationStartedAt, 'applicationStartedAt')
    : new Date().toISOString();

  await withWriteDb(async (db) => {
    await ensureProfileRow(db, input.authUserId);
    await readTransitionStatus(
      db,
      sql`
        insert into mercury_referrals (
          auth_user_id,
          referral_url,
          status,
          application_started_at,
          created_at,
          updated_at,
          deleted_at
        ) values (
          ${input.authUserId}::uuid,
          ${MERCURY_REFERRAL_URL},
          'application_started',
          ${timestamp},
          ${timestamp},
          ${timestamp},
          null
        )
        on conflict (auth_user_id) do update set
          application_started_at = coalesce(mercury_referrals.application_started_at, excluded.application_started_at),
          status = case
            when mercury_referrals.status in ('pending_qualification', 'qualified', 'failed', 'expired', 'existing_customer') then mercury_referrals.status
            else 'application_started'
          end,
          updated_at = excluded.updated_at,
          deleted_at = null
        returning status
      `,
    );
  });

  return getMercuryReferralStatusForUser(input.authUserId);
}

export async function verifyMercuryReferralApplication(
  input: VerifiedMercuryReferralApplicationInput,
): Promise<MercuryReferralStatus> {
  const timestamp = new Date().toISOString();
  const qualificationDeadlineAt = parseFutureDeadline(input.qualificationDeadlineAt);
  const verificationSource = requiredText(input.verificationSource, 'verificationSource');
  const externalReference = optionalText(input.externalReference);
  const verifiedBy = optionalText(input.verifiedBy);

  await withWriteDb(async (db) => {
    await ensureProfileRow(db, input.authUserId);
    const status = await readTransitionStatus(
      db,
      sql`
        insert into mercury_referrals (
          auth_user_id,
          referral_url,
          status,
          application_started_at,
          qualification_deadline_at,
          verification_source,
          external_reference,
          verified_by,
          created_at,
          updated_at,
          deleted_at
        ) values (
          ${input.authUserId}::uuid,
          ${MERCURY_REFERRAL_URL},
          'pending_qualification',
          ${timestamp},
          ${qualificationDeadlineAt},
          ${verificationSource},
          ${externalReference},
          ${verifiedBy},
          ${timestamp},
          ${timestamp},
          null
        )
        on conflict (auth_user_id) do update set
          application_started_at = coalesce(mercury_referrals.application_started_at, excluded.application_started_at),
          qualification_deadline_at = case
            when mercury_referrals.status in ('qualified', 'failed', 'expired', 'existing_customer') then mercury_referrals.qualification_deadline_at
            else excluded.qualification_deadline_at
          end,
          verification_source = case
            when mercury_referrals.status in ('qualified', 'failed', 'expired', 'existing_customer') then mercury_referrals.verification_source
            else excluded.verification_source
          end,
          external_reference = case
            when mercury_referrals.status in ('qualified', 'failed', 'expired', 'existing_customer') then mercury_referrals.external_reference
            else excluded.external_reference
          end,
          verified_by = case
            when mercury_referrals.status in ('qualified', 'failed', 'expired', 'existing_customer') then mercury_referrals.verified_by
            else excluded.verified_by
          end,
          status = case
            when mercury_referrals.status in ('qualified', 'failed', 'expired', 'existing_customer') then mercury_referrals.status
            else 'pending_qualification'
          end,
          updated_at = excluded.updated_at,
          deleted_at = null
        returning status
      `,
    );

    if (!TERMINAL_MERCURY_REFERRAL_STATUSES.has(status)) {
      await upsertAccessGrant(db, {
        authUserId: input.authUserId,
        source: 'mercury_pending_grace',
        grantType: 'temporary',
        expiresAt: new Date(qualificationDeadlineAt),
        sourceReferenceId: externalReference,
        metadata: {
          referralStatus: 'pending_qualification',
          verificationSource,
        },
      });
    }
  });

  return getMercuryReferralStatusForUser(input.authUserId);
}

async function recordMercuryReferralOutcome(
  input: MercuryReferralOutcomeInput,
  status: Extract<
    MercuryReferralStatusValue,
    'qualified' | 'failed' | 'expired' | 'existing_customer'
  >,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const verificationSource = requiredText(input.verificationSource, 'verificationSource');
  const externalReference = optionalText(input.externalReference);
  const verifiedBy = optionalText(input.verifiedBy);

  await withWriteDb(async (db) => {
    await ensureProfileRow(db, input.authUserId);
    await db.execute(sql`
      insert into mercury_referrals (
        auth_user_id,
        referral_url,
        status,
        verification_source,
        external_reference,
        verified_by,
        qualified_at,
        failed_at,
        expired_at,
        premium_access_granted_at,
        created_at,
        updated_at,
        deleted_at
      ) values (
        ${input.authUserId}::uuid,
        ${MERCURY_REFERRAL_URL},
        ${status},
        ${verificationSource},
        ${externalReference},
        ${verifiedBy},
        ${status === 'qualified' ? timestamp : null},
        ${status === 'failed' ? timestamp : null},
        ${status === 'expired' ? timestamp : null},
        ${status === 'qualified' ? timestamp : null},
        ${timestamp},
        ${timestamp},
        null
      )
      on conflict (auth_user_id) do update set
        status = excluded.status,
        verification_source = excluded.verification_source,
        external_reference = excluded.external_reference,
        verified_by = excluded.verified_by,
        qualified_at = case when ${status} = 'qualified' then ${timestamp} else mercury_referrals.qualified_at end,
        failed_at = case when ${status} = 'failed' then ${timestamp} else mercury_referrals.failed_at end,
        expired_at = case when ${status} = 'expired' then ${timestamp} else mercury_referrals.expired_at end,
        premium_access_granted_at = case when ${status} = 'qualified' then ${timestamp} else mercury_referrals.premium_access_granted_at end,
        updated_at = excluded.updated_at,
        deleted_at = null
    `);

    if (status === 'qualified') {
      await upsertAccessGrant(db, {
        authUserId: input.authUserId,
        source: 'mercury_qualified',
        grantType: 'lifetime',
        expiresAt: null,
        sourceReferenceId: externalReference,
        metadata: {
          referralStatus: 'qualified',
          verificationSource,
        },
      });
    }

    await expireAccessGrant(db, input.authUserId, 'mercury_pending_grace');
  });
}

export async function qualifyMercuryReferral(
  input: MercuryReferralOutcomeInput,
): Promise<MercuryReferralStatus> {
  await recordMercuryReferralOutcome(input, 'qualified');
  return getMercuryReferralStatusForUser(input.authUserId);
}

export async function markMercuryReferralFailed(
  input: MercuryReferralOutcomeInput,
): Promise<MercuryReferralStatus> {
  await recordMercuryReferralOutcome(input, 'failed');
  return getMercuryReferralStatusForUser(input.authUserId);
}

export async function markMercuryReferralExpired(
  input: MercuryReferralOutcomeInput,
): Promise<MercuryReferralStatus> {
  await recordMercuryReferralOutcome(input, 'expired');
  return getMercuryReferralStatusForUser(input.authUserId);
}

export async function markMercuryReferralExistingCustomer(
  input: MercuryReferralOutcomeInput,
): Promise<MercuryReferralStatus> {
  await recordMercuryReferralOutcome(input, 'existing_customer');
  return getMercuryReferralStatusForUser(input.authUserId);
}

export async function getMercuryReferralStatusForUser(
  authUserId: string,
): Promise<MercuryReferralStatus> {
  return withWriteDb(async (db) => {
    const result = await db.execute(sql`
      select
        referral_url,
        status,
        click_count,
        first_clicked_at,
        last_clicked_at,
        application_started_at,
        qualification_deadline_at,
        qualified_at,
        failed_at,
        expired_at,
        verification_source,
        premium_access_granted_at
      from mercury_referrals
      where auth_user_id = ${authUserId}::uuid
        and deleted_at is null
      limit 1
    `);

    return rowToStatus((rowsFromResult(result)[0] as ReferralRow | undefined) ?? null);
  });
}

export async function recordMercuryReferralClickForUser(
  authUserId: string,
): Promise<MercuryReferralStatus> {
  const timestamp = new Date().toISOString();

  await withWriteDb(async (db) => {
    await ensureProfileRow(db, authUserId);
    await db.execute(sql`
      insert into mercury_referrals (
        auth_user_id,
        referral_url,
        click_count,
        first_clicked_at,
        last_clicked_at,
        status,
        created_at,
        updated_at,
        deleted_at
      ) values (
        ${authUserId}::uuid,
        ${MERCURY_REFERRAL_URL},
        1,
        ${timestamp},
        ${timestamp},
        'clicked',
        ${timestamp},
        ${timestamp},
        null
      )
      on conflict (auth_user_id) do update set
        referral_url = excluded.referral_url,
        click_count = mercury_referrals.click_count + 1,
        first_clicked_at = coalesce(mercury_referrals.first_clicked_at, excluded.first_clicked_at),
        last_clicked_at = excluded.last_clicked_at,
        status = case
          when mercury_referrals.status in ('application_started', 'pending_qualification', 'qualified', 'failed', 'expired', 'existing_customer') then mercury_referrals.status
          else 'clicked'
        end,
        updated_at = excluded.updated_at,
        deleted_at = null
    `);
  });

  return getMercuryReferralStatusForUser(authUserId);
}
