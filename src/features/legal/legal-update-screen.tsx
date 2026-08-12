import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import { useAuthUiStore } from '@/stores/auth-ui-store';

import { useAppTheme } from '../../theme/provider';
import { getReadableTextColor } from '../onboarding/onboarding-colors';
import {
  completeTime2PayOnboarding,
  loadTime2PayOnboardingGateSnapshot,
} from '../onboarding/onboarding-state';
import {
  useLegalUpdateGateSnapshot,
  type RequiredLegalDocument,
} from './legal-acceptance-adapter';
import { LegalDocumentModal } from './legal-document-modal';
import { getLegalDocument, type LegalDocumentId } from './legal-documents';

type StatusNotice = {
  message: string;
  tone: NoticeTone;
};

function LegalUpdateRow({
  document,
  saving,
  onOpen,
}: {
  document: RequiredLegalDocument;
  saving: boolean;
  onOpen: () => void;
}) {
  const theme = useAppTheme();
  const colors = theme.activeColors;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onOpen}
      style={[
        styles.documentCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.primary,
          borderRadius: theme.layout.radius,
        },
      ]}>
      <View style={styles.documentText}>
        <Text style={[styles.documentTitle, { color: colors.text }]}>{document.title}</Text>
        <Text style={[styles.documentMeta, { color: colors.text }]}>
          Version {document.acceptanceVersion}
        </Text>
        <Text style={[styles.documentSummary, { color: colors.text }]}>
          {document.changeSummary}
        </Text>
      </View>
      <Text style={[styles.documentAction, { color: colors.primary }]}>
        {saving ? 'Saving' : 'Review'}
      </Text>
    </Pressable>
  );
}

export default function LegalUpdateScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const colors = theme.activeColors;
  const primaryForeground = getReadableTextColor(colors.primary, theme.colors.light.text);
  const disabledForeground = getReadableTextColor(colors.surface, theme.colors.light.text);
  const [activeDocumentId, setActiveDocumentId] = useState<LegalDocumentId | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [status, setStatus] = useState<StatusNotice | null>(null);
  const { snapshot, refresh, acceptDocument, savingDocumentId } = useLegalUpdateGateSnapshot();
  const syncOnboardingGate = useAuthUiStore((state) => state.syncOnboardingGate);
  const setOnboardingGateError = useAuthUiStore((state) => state.setOnboardingGateError);
  const activeRequiredDocument = useMemo(
    () => snapshot.requiredDocuments.find((document) => document.documentId === activeDocumentId),
    [activeDocumentId, snapshot.requiredDocuments],
  );
  const hasRequiredDocuments = snapshot.requiredDocuments.length > 0;
  const isChecking = snapshot.status === 'checking';
  const isComplete = snapshot.status === 'complete';
  const canContinue = isComplete && !isChecking && !isCompleting;

  const closeModal = () => setActiveDocumentId(null);

  const acceptActiveDocument = async () => {
    if (!activeRequiredDocument) {
      closeModal();
      return;
    }

    setStatus(null);

    try {
      await acceptDocument(activeRequiredDocument);
      closeModal();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to save legal acceptance.';
      setStatus({ tone: 'error', message });
    }
  };

  const continueToApp = () => {
    if (!canContinue) {
      return;
    }

    setIsCompleting(true);
    setStatus(null);

    completeTime2PayOnboarding()
      .then(() => loadTime2PayOnboardingGateSnapshot())
      .then((nextSnapshot) => {
        syncOnboardingGate({
          status: nextSnapshot.status,
          completedStepIds: nextSnapshot.completedStepIds,
          missingLegalDocumentIds: nextSnapshot.missingDocumentIds,
        });
        router.replace('/dashboard');
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Failed to finish legal review.';
        setStatus({ tone: 'error', message });
        setOnboardingGateError(message);
      })
      .finally(() => setIsCompleting(false));
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: colors.primary }]}>Legal Update</Text>
        <Text
          style={[
            styles.title,
            {
              color: colors.text,
              fontFamily: theme.typography.fontTitle,
            },
          ]}>
          Review Time2Pay updates
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>
          Please review and accept the current Time2Pay legal documents before entering the app.
        </Text>
      </View>

      {snapshot.status === 'error' ? (
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.warning,
              borderRadius: theme.layout.radius,
            },
          ]}>
          <Text style={[styles.statusTitle, { color: colors.text }]}>
            Unable to check acceptance
          </Text>
          <Text style={[styles.statusBody, { color: colors.text }]}>
            {snapshot.error ?? 'Try again before continuing.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refresh()}
            style={[
              styles.secondaryButton,
              { borderColor: colors.primary, borderRadius: theme.layout.radius },
            ]}>
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {isChecking ? (
        <Text style={[styles.statusBody, { color: colors.text }]}>Checking legal acceptance...</Text>
      ) : null}

      {!isChecking && !hasRequiredDocuments && snapshot.status !== 'error' ? (
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.success,
              borderRadius: theme.layout.radius,
            },
          ]}>
          <Text style={[styles.statusTitle, { color: colors.text }]}>
            Legal documents are current
          </Text>
          <Text style={[styles.statusBody, { color: colors.text }]}>
            No required legal updates are waiting on this account.
          </Text>
        </View>
      ) : null}

      {hasRequiredDocuments ? (
        <View style={styles.stack}>
          {snapshot.requiredDocuments.map((document) => (
            <LegalUpdateRow
              document={document}
              key={`${document.documentId}-${document.acceptanceVersion}`}
              onOpen={() => setActiveDocumentId(document.documentId)}
              saving={savingDocumentId === document.documentId}
            />
          ))}
        </View>
      ) : null}

      {status ? <InlineNotice tone={status.tone} message={status.message} /> : null}

      <Pressable
        accessibilityRole="button"
        disabled={!canContinue}
        onPress={continueToApp}
        style={[
          styles.primaryButton,
          {
            backgroundColor: canContinue ? colors.primary : colors.surface,
            borderRadius: theme.layout.radius,
          },
        ]}>
        <Text
          style={[
            styles.primaryButtonText,
            { color: canContinue ? primaryForeground : disabledForeground },
          ]}>
          {isCompleting ? 'Saving acceptance...' : 'Continue to app'}
        </Text>
      </Pressable>

      {activeRequiredDocument ? (
        <LegalDocumentModal
          documentId={activeRequiredDocument.documentId}
          onClose={closeModal}
          onPrimaryAction={() => void acceptActiveDocument()}
          primaryActionLabel={`Accept ${getLegalDocument(activeRequiredDocument.documentId).title}`}
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
  documentSummary: {
    fontSize: 14,
    lineHeight: 20,
  },
  documentAction: {
    fontSize: 13,
    fontWeight: '900',
  },
  statusCard: {
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  statusBody: {
    fontSize: 14,
    lineHeight: 20,
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
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
  },
});
