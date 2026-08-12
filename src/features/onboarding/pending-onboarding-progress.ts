import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from '@/services/browser-storage';
import {
  time2PayOnboardingStepIds,
  type Time2PayOnboardingStepId,
} from '@/database/hosted/onboarding';

const PENDING_ONBOARDING_STEPS_KEY = 'time2pay.onboarding.pending-step-ids';

function parsePendingStepIds(value: string | null): Time2PayOnboardingStepId[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((stepId): stepId is Time2PayOnboardingStepId =>
      time2PayOnboardingStepIds.includes(stepId as Time2PayOnboardingStepId),
    );
  } catch {
    return [];
  }
}

function uniqueStepIds(stepIds: Time2PayOnboardingStepId[]): Time2PayOnboardingStepId[] {
  return time2PayOnboardingStepIds.filter((stepId) => stepIds.includes(stepId));
}

export function readPendingOnboardingStepIds(): Time2PayOnboardingStepId[] {
  return parsePendingStepIds(readLocalStorageItem(PENDING_ONBOARDING_STEPS_KEY));
}

export function markPendingOnboardingStepCompleted(stepId: Time2PayOnboardingStepId): void {
  const nextStepIds = uniqueStepIds([...readPendingOnboardingStepIds(), stepId]);
  writeLocalStorageItem(PENDING_ONBOARDING_STEPS_KEY, JSON.stringify(nextStepIds));
}

export function clearPendingOnboardingStepIds(): void {
  removeLocalStorageItem(PENDING_ONBOARDING_STEPS_KEY);
}
