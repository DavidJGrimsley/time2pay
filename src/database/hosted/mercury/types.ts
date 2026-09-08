export const MERCURY_REFERRAL_STATUSES = [
  'not_started',
  'clicked',
  'application_started',
  'pending_qualification',
  'qualified',
  'failed',
  'expired',
  'existing_customer',
] as const;

export type MercuryReferralStatusValue = (typeof MERCURY_REFERRAL_STATUSES)[number];

export type MercuryReferralStatus = {
  referralUrl: string;
  status: MercuryReferralStatusValue;
  clickCount: number;
  firstClickedAt: string | null;
  lastClickedAt: string | null;
  applicationStartedAt: string | null;
  qualificationDeadlineAt: string | null;
  qualifiedAt: string | null;
  failedAt: string | null;
  expiredAt: string | null;
  verificationSource: string | null;
  premiumAccess: boolean;
  premiumAccessGrantedAt: string | null;
};