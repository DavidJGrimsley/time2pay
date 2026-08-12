import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  acceptTime2PayLegalDocument,
  getRequiredOnboardingLegalDocuments,
  loadTime2PayOnboardingGateSnapshot,
} from '@/features/onboarding/onboarding-state';

import { legalDocuments, type LegalDocument, type LegalDocumentId } from './legal-documents';

export type LegalGateStatus = 'checking' | 'needs-legal' | 'complete' | 'error';

export interface RequiredLegalDocument {
  documentId: LegalDocumentId;
  acceptanceVersion: string;
  title: string;
  changeSummary: string;
}

export interface LegalAcceptanceSnapshot {
  status: LegalGateStatus;
  requiredDocuments: RequiredLegalDocument[];
  acceptedDocumentKeys: string[];
  error?: string;
}

export interface LegalAcceptanceAdapter {
  loadRequiredLegalAcceptances(
    requiredDocuments: RequiredLegalDocument[],
  ): Promise<LegalAcceptanceSnapshot>;
  acceptLegalDocument(document: RequiredLegalDocument): Promise<void>;
}

function legalDocumentKey(document: RequiredLegalDocument): string {
  return `${document.documentId}@${document.acceptanceVersion}`;
}

function toRequiredLegalDocument(document: LegalDocument): RequiredLegalDocument {
  return {
    documentId: document.id,
    acceptanceVersion: document.acceptanceVersion,
    title: document.title,
    changeSummary: document.changeSummary,
  };
}

export function getRequiredMaterialLegalDocuments(): RequiredLegalDocument[] {
  return Object.values(legalDocuments)
    .filter((document) => document.requiresReacceptance)
    .map(toRequiredLegalDocument);
}

function filterRequiredDocuments(requiredDocuments: RequiredLegalDocument[]) {
  const onboardingRequirements = new Set(
    getRequiredOnboardingLegalDocuments().map((document) =>
      legalDocumentKey({
        documentId: document.documentId as LegalDocumentId,
        acceptanceVersion: document.documentVersion,
        title: legalDocuments[document.documentId as LegalDocumentId]?.title ?? document.documentId,
        changeSummary:
          legalDocuments[document.documentId as LegalDocumentId]?.changeSummary ?? '',
      }),
    ),
  );

  return requiredDocuments.filter((document) => onboardingRequirements.has(legalDocumentKey(document)));
}

export const time2PayLegalAcceptanceAdapter: LegalAcceptanceAdapter = {
  async loadRequiredLegalAcceptances(requiredDocuments) {
    const scopedRequiredDocuments = filterRequiredDocuments(requiredDocuments);
    const snapshot = await loadTime2PayOnboardingGateSnapshot();
    const acceptedDocumentKeys = new Set(snapshot.acceptedDocumentKeys);
    const missingDocuments = scopedRequiredDocuments.filter(
      (document) => !acceptedDocumentKeys.has(legalDocumentKey(document)),
    );

    return {
      status: missingDocuments.length > 0 ? 'needs-legal' : 'complete',
      requiredDocuments: missingDocuments,
      acceptedDocumentKeys: snapshot.acceptedDocumentKeys,
    };
  },

  async acceptLegalDocument(document) {
    await acceptTime2PayLegalDocument(document.documentId);
  },
};

let legalAcceptanceAdapter: LegalAcceptanceAdapter = time2PayLegalAcceptanceAdapter;

export function configureLegalAcceptanceAdapter(adapter: LegalAcceptanceAdapter): void {
  legalAcceptanceAdapter = adapter;
}

export function useLegalUpdateGateSnapshot(
  adapter: LegalAcceptanceAdapter = legalAcceptanceAdapter,
) {
  const requiredMaterialDocuments = useMemo(() => getRequiredMaterialLegalDocuments(), []);
  const [snapshot, setSnapshot] = useState<LegalAcceptanceSnapshot>({
    status: 'checking',
    requiredDocuments: requiredMaterialDocuments,
    acceptedDocumentKeys: [],
  });
  const [savingDocumentId, setSavingDocumentId] = useState<LegalDocumentId | null>(null);

  const refresh = useCallback(async () => {
    setSnapshot((current) => ({ ...current, status: 'checking', error: undefined }));
    try {
      const nextSnapshot = await adapter.loadRequiredLegalAcceptances(requiredMaterialDocuments);
      setSnapshot(nextSnapshot);
      return nextSnapshot;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to check legal acceptance.';
      const errorSnapshot: LegalAcceptanceSnapshot = {
        status: 'error',
        requiredDocuments: requiredMaterialDocuments,
        acceptedDocumentKeys: [],
        error: message,
      };
      setSnapshot(errorSnapshot);
      return errorSnapshot;
    }
  }, [adapter, requiredMaterialDocuments]);

  const acceptDocument = useCallback(
    async (document: RequiredLegalDocument) => {
      setSavingDocumentId(document.documentId);
      try {
        await adapter.acceptLegalDocument(document);
        return await refresh();
      } finally {
        setSavingDocumentId(null);
      }
    },
    [adapter, refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    snapshot,
    refresh,
    acceptDocument,
    savingDocumentId,
  };
}
