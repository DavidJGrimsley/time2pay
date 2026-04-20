import { sql } from 'drizzle-orm';
import { withWriteDb, type WriteDb } from '@/server/db/_shared/db';

export const MERCURY_REFERRAL_URL = 'https://mercury.com/partner/time2pay';

export type MercuryReferralStatusValue =
  | 'none'
  | 'clicked'
  | 'pending_review'
  | 'qualified'
  | 'rejected';

export type MercuryReferralStatus = {
  referralUrl: string;
  status: MercuryReferralStatusValue;
  clickCount: number;
  firstClickedAt: string | null;
  lastClickedAt: string | null;
  premiumAccess: boolean;
  premiumAccessGrantedAt: string | null;
};

type ReferralRow = {
  referral_url?: string | null;
  status?: string | null;
  click_count?: number | string | null;
  first_clicked_at?: string | Date | null;
  last_clicked_at?: string | Date | null;
  premium_access_granted_at?: string | Date | null;
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

function normalizeStatus(value: unknown): MercuryReferralStatusValue {
  if (
    value === 'clicked' ||
    value === 'pending_review' ||
    value === 'qualified' ||
    value === 'rejected'
  ) {
    return value;
  }

  return 'none';
}

function rowToStatus(row: ReferralRow | null): MercuryReferralStatus {
  if (!row) {
    return {
      referralUrl: MERCURY_REFERRAL_URL,
      status: 'none',
      clickCount: 0,
      firstClickedAt: null,
      lastClickedAt: null,
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
    premiumAccess: Boolean(premiumAccessGrantedAt),
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
        'pending_review',
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
          when mercury_referrals.status in ('qualified', 'rejected') then mercury_referrals.status
          else 'pending_review'
        end,
        updated_at = excluded.updated_at,
        deleted_at = null
    `);
  });

  return getMercuryReferralStatusForUser(authUserId);
}
