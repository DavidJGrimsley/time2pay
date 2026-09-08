import {
  acceptHostedLegalDocument,
  completeHostedOnboarding,
  getHostedOnboardingGateSnapshot,
  recordHostedOnboardingStepCompleted,
  type HostedOnboardingGateSnapshot,
  type LegalDocumentRequirement,
  type Time2PayOnboardingStepId,
} from '@/database/hosted/onboarding';
import { getLegalDocument, type LegalDocumentId } from '@/features/legal/legal-documents';
import {
  clearPendingOnboardingStepIds,
  markPendingOnboardingStepCompleted,
  readPendingOnboardingStepIds,
} from '@/features/onboarding/pending-onboarding-progress';

export type { HostedOnboardingGateSnapshot, Time2PayOnboardingStepId };

export const requiredOnboardingLegalDocumentIds = ['terms', 'privacy'] as const satisfies readonly LegalDocumentId[];

export function getRequiredOnboardingLegalDocuments(): LegalDocumentRequirement[] {
  return requiredOnboardingLegalDocumentIds.map((documentId) => {
    const document = getLegalDocument(documentId);
    return {
      documentId,
      documentVersion: document.acceptanceVersion,
    };
  });
}

export function markPublicOnboardingStepCompleted(stepId: Time2PayOnboardingStepId): void {
  markPendingOnboardingStepCompleted(stepId);
}

export async function syncPendingTime2PayOnboardingProgress(): Promise<void> {
  const pendingStepIds = readPendingOnboardingStepIds();
  if (pendingStepIds.length === 0) {
    return;
  }

  const stepIdsToSync = [...pendingStepIds, 'auth'] as Time2PayOnboardingStepId[];
  for (const stepId of stepIdsToSync) {
    await recordHostedOnboardingStepCompleted(stepId, {
      source: pendingStepIds.includes(stepId) ? 'public-onboarding' : 'auth-handoff',
    });
  }
  clearPendingOnboardingStepIds();
}

export function loadTime2PayOnboardingGateSnapshot(): Promise<HostedOnboardingGateSnapshot> {
  return getHostedOnboardingGateSnapshot(getRequiredOnboardingLegalDocuments());
}

export async function acceptTime2PayLegalDocument(documentId: LegalDocumentId): Promise<void> {
  const document = getRequiredOnboardingLegalDocuments().find(
    (requirement) => requirement.documentId === documentId,
  );
  if (!document) {
    throw new Error(`Unknown legal document: ${documentId}`);
  }

  await acceptHostedLegalDocument(document);
}

export function completeTime2PayOnboarding(): Promise<void> {
  return completeHostedOnboarding(getRequiredOnboardingLegalDocuments());
}
