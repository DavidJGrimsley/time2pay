import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppLoadingShell } from '@/components/app-loading-shell';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import { useAuthUiStore } from '@/stores/auth-ui-store';
import { LegalDocumentModal } from '../legal/legal-document-modal';
import { getLegalDocument, type LegalDocumentId } from '../legal/legal-documents';
import { useAppTheme } from '../../theme/provider';
import { getReadableTextColor } from './onboarding-colors';
import { onboardingConfig } from './onboarding-config';
import {
  acceptTime2PayLegalDocument,
  completeTime2PayOnboarding,
  getRequiredOnboardingLegalDocuments,
  loadTime2PayOnboardingGateSnapshot,
} from './onboarding-state';

const requiredDocuments: LegalDocumentId[] = ['terms', 'privacy'];

type LegalAcceptanceRecord = Record<LegalDocumentId, boolean>;

type StatusNotice = {
  message: string;
  tone: NoticeTone;
};

const defaultAcceptedDocuments: LegalAcceptanceRecord = {
  terms: false,
  privacy: false,
};

function LegalRow({
  documentId,
  accepted,
  onOpen,
}: {
  documentId: LegalDocumentId;
  accepted: boolean;
  onOpen: () => void;
}) {
  const theme = useAppTheme();
  const colors = theme.activeColors;
  const document = getLegalDocument(documentId);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={[
        styles.documentCard,
        {
          backgroundColor: colors.surface,
          borderColor: accepted ? colors.success : colors.primary,
          borderRadius: theme.layout.radius,
        },
      ]}>
      <View style={styles.documentText}>
        <Text style={[styles.documentTitle, { color: colors.text }]}>{document.title}</Text>
        <Text style={[styles.documentMeta, { color: colors.text }]}>
          Version {document.acceptanceVersion}
        </Text>
      </View>
      <Text style={[styles.documentAction, { color: accepted ? colors.success : colors.primary }]}>
        {accepted ? 'Accepted' : 'Review'}
      </Text>
    </Pressable>
  );
}

export default function OnboardingLegalReviewScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const colors = theme.activeColors;
  const primaryForeground = getReadableTextColor(colors.primary, theme.colors.light.text);
  const [activeDocument, setActiveDocument] = useState<LegalDocumentId | null>(null);
  const [acceptedDocuments, setAcceptedDocuments] = useState<LegalAcceptanceRecord>(
    defaultAcceptedDocuments,
  );
  const [isLoadingAcceptance, setIsLoadingAcceptance] = useState(true);
  const [savingDocumentId, setSavingDocumentId] = useState<LegalDocumentId | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [status, setStatus] = useState<StatusNotice | null>(null);
  const authReady = useAuthUiStore((state) => state.authReady);
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const syncOnboardingGate = useAuthUiStore((state) => state.syncOnboardingGate);
  const setOnboardingGateError = useAuthUiStore((state) => state.setOnboardingGateError);

  const hasAcceptedRequiredDocuments = useMemo(
    () => requiredDocuments.every((documentId) => acceptedDocuments[documentId]),
    [acceptedDocuments],
  );

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!isAuthenticated) {
      router.replace('/onboarding/auth');
      return;
    }

    let isActive = true;
    setIsLoadingAcceptance(true);
    setStatus(null);

    loadTime2PayOnboardingGateSnapshot()
      .then((snapshot) => {
        if (!isActive) {
          return;
        }

        const requiredDocumentMap = new Map(
          getRequiredOnboardingLegalDocuments().map((document) => [
            document.documentId,
            `${document.documentId}@${document.documentVersion}`,
          ]),
        );
        const acceptedKeySet = new Set(snapshot.acceptedDocumentKeys);

        setAcceptedDocuments({
          terms: acceptedKeySet.has(requiredDocumentMap.get('terms') ?? ''),
          privacy: acceptedKeySet.has(requiredDocumentMap.get('privacy') ?? ''),
        });
        syncOnboardingGate({
          status: snapshot.status,
          completedStepIds: snapshot.completedStepIds,
          missingLegalDocumentIds: snapshot.missingDocumentIds,
        });

        if (snapshot.status === 'complete') {
          router.replace('/dashboard');
        }
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'Failed to load legal acceptance state.';
        setStatus({ tone: 'error', message });
        setOnboardingGateError(message);
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingAcceptance(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [authReady, isAuthenticated, router, setOnboardingGateError, syncOnboardingGate]);

  const closeModal = () => setActiveDocument(null);

  const acceptActiveDocument = () => {
    if (!activeDocument) {
      closeModal();
      return;
    }

    setSavingDocumentId(activeDocument);
    setStatus(null);

    acceptTime2PayLegalDocument(activeDocument)
      .then(() => {
        setAcceptedDocuments((current) => ({ ...current, [activeDocument]: true }));
        closeModal();
      })
      .catch((error: unknown) => {
        setStatus({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Failed to save legal acceptance.',
        });
      })
      .finally(() => setSavingDocumentId(null));
  };

  const completeOnboarding = () => {
    setIsCompleting(true);
    setStatus(null);

    completeTime2PayOnboarding()
      .then(() => loadTime2PayOnboardingGateSnapshot())
      .then((snapshot) => {
        syncOnboardingGate({
          status: snapshot.status,
          completedStepIds: snapshot.completedStepIds,
          missingLegalDocumentIds: snapshot.missingDocumentIds,
        });
        router.replace(onboardingConfig.completion.route);
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Failed to complete onboarding.';
        setStatus({ tone: 'error', message });
        setOnboardingGateError(message);
      })
      .finally(() => setIsCompleting(false));
  };

  if (!authReady || isLoadingAcceptance) {
    return <AppLoadingShell />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: colors.primary }]}>Legal</Text>
        <Text
          style={[
            styles.title,
            {
              color: colors.text,
              fontFamily: theme.typography.fontTitle,
            },
          ]}>
          {onboardingConfig.legal.title}
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>{onboardingConfig.legal.body}</Text>
      </View>

      <View style={styles.stack}>
        {requiredDocuments.map((documentId) => (
          <LegalRow
            accepted={acceptedDocuments[documentId]}
            documentId={documentId}
            key={documentId}
            onOpen={() => setActiveDocument(documentId)}
          />
        ))}
      </View>

      {status ? <InlineNotice tone={status.tone} message={status.message} /> : null}

      <Pressable
        accessibilityRole="button"
        disabled={!hasAcceptedRequiredDocuments || isCompleting || savingDocumentId !== null}
        onPress={completeOnboarding}
        style={[
          styles.primaryButton,
          {
            backgroundColor:
              hasAcceptedRequiredDocuments && !isCompleting ? colors.primary : colors.surface,
            borderRadius: theme.layout.radius,
          },
        ]}>
        <Text
          style={[
            styles.primaryButtonText,
            {
              color: hasAcceptedRequiredDocuments && !isCompleting ? primaryForeground : colors.text,
            },
          ]}>
          {isCompleting ? 'Saving acceptance...' : onboardingConfig.completion.label}
        </Text>
      </Pressable>

      {activeDocument ? (
        <LegalDocumentModal
          documentId={activeDocument}
          onClose={closeModal}
          onPrimaryAction={acceptActiveDocument}
          primaryActionLabel={
            savingDocumentId === activeDocument
              ? 'Saving...'
              : `Accept ${getLegalDocument(activeDocument).title}`
          }
          visible
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: 18,
    justifyContent: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'web' ? 84 : 28,
  },
  header: {
    gap: 8,
  },
  kicker: {
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 720,
  },
  stack: {
    gap: 12,
  },
  documentCard: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  documentText: {
    flex: 1,
    gap: 4,
  },
  documentTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  documentMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  documentAction: {
    fontSize: 13,
    fontWeight: '900',
  },
  primaryButton: {
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 15,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '900',
  },
});
