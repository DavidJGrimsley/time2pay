import { getUserProfile, initializeDatabase, type UserProfile } from '@/database/db';

export type RequiredProfileField = 'full_name' | 'email' | 'phone';

export type ProfileCompletionResult = {
  isComplete: boolean;
  missingFields: RequiredProfileField[];
};

export const REQUIRED_PROFILE_FIELD_LABELS: Record<RequiredProfileField, string> = {
  full_name: 'full name',
  email: 'business email',
  phone: 'business phone',
};

function isNonEmptyTrimmed(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function evaluateProfileCompletion(
  profile: Pick<UserProfile, 'full_name' | 'email' | 'phone'>,
): ProfileCompletionResult {
  const missingFields: RequiredProfileField[] = [];

  if (!isNonEmptyTrimmed(profile.full_name)) {
    missingFields.push('full_name');
  }

  if (!isNonEmptyTrimmed(profile.email)) {
    missingFields.push('email');
  }

  if (!isNonEmptyTrimmed(profile.phone)) {
    missingFields.push('phone');
  }

  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

export async function getProfileCompletion(): Promise<ProfileCompletionResult> {
  await initializeDatabase();
  const profile = await getUserProfile();
  return evaluateProfileCompletion(profile);
}

export async function isProfileComplete(): Promise<boolean> {
  const completion = await getProfileCompletion();
  return completion.isComplete;
}
