import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  MERCURY_AFFILIATE_LINK_DISCLOSURE,
  MercuryDisclosure,
  MercuryPoweredBy,
} from '@/components/mercury-disclosure';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import {
  getMercuryReferralStatus,
  MERCURY_REFERRAL_URL,
  trackMercuryReferralClick,
  type MercuryReferralStatus,
} from '@/services/mercury-referrals';
import { useAuthUiStore } from '@/stores/auth-ui-store';
import { getReadableTextColor } from '@/theme/color-utils';

import { useAppTheme } from '../../theme/provider';
import { onboardingConfig } from './onboarding-config';
import {
  completeTime2PayOnboarding,
  loadTime2PayOnboardingGateSnapshot,
  recordTime2PayMercuryOnboardingChoice,
  type MercuryOnboardingChoice,
} from './onboarding-state';

type StatusNotice = {
  message: string;
  tone: NoticeTone;
};

function readableReferralStatus(referral: MercuryReferralStatus | null): string | null {
  if (!referral || referral.status === 'not_started') {
    return null;
  }

  if (referral.status === 'clicked') {
    return 'The partner link click is recorded. Application and qualification updates are not automatic yet.';
  }

  return `Referral status: ${referral.status.replaceAll('_', ' ')}.`;
}

export default function MercuryOnboardingScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const colors = theme.activeColors;
  const primaryForeground = getReadableTextColor(colors.primary, theme.colors.light.text);
  const [choice, setChoice] = useState<MercuryOnboardingChoice | null>(null);
  const [referral, setReferral] = useState<MercuryReferralStatus | null>(null);
  const [isOpeningReferral, setIsOpeningReferral] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [status, setStatus] = useState<StatusNotice | null>(null);
  const authReady = useAuthUiStore((state) => state.authReady);
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const syncOnboardingGate = useAuthUiStore((state) => state.syncOnboardingGate);
  const setOnboardingGateError = useAuthUiStore((state) => state.setOnboardingGateError);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!isAuthenticated) {
      router.replace('/onboarding/auth');
      return;
    }

    let active = true;
    getMercuryReferralStatus()
      .then((nextReferral) => {
        if (active) {
          setReferral(nextReferral);
        }
      })
      .catch(() => {
        // Referral reporting is informational and must not block onboarding.
      });

    return () => {
      active = false;
    };
  }, [authReady, isAuthenticated, router]);

  const openMercuryPartnerPage = async () => {
    setIsOpeningReferral(true);
    setStatus(null);

    try {
      const trackingRequest = trackMercuryReferralClick();
      await Linking.openURL(MERCURY_REFERRAL_URL);
      const nextReferral = await trackingRequest;
      if (nextReferral) {
        setReferral(nextReferral);
      }
      setStatus({
        tone: 'success',
        message: nextReferral
          ? 'Mercury opened and the partner-link click was recorded.'
          : 'Mercury opened. The click was saved locally and will sync when hosted tracking is available.',
      });
    } catch (error: unknown) {
      setStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to open the Mercury partner page.',
      });
    } finally {
      setIsOpeningReferral(false);
    }
  };

  const finishOnboarding = async (selectedChoice: MercuryOnboardingChoice) => {
    setIsCompleting(true);
    setStatus(null);

    try {
      await recordTime2PayMercuryOnboardingChoice(selectedChoice);
      await completeTime2PayOnboarding();
      const snapshot = await loadTime2PayOnboardingGateSnapshot();
      if (snapshot.status !== 'complete') {
        throw new Error('Mercury setup was saved, but onboarding is not complete yet.');
      }
      syncOnboardingGate({
        status: snapshot.status,
        completedStepIds: snapshot.completedStepIds,
        missingLegalDocumentIds: snapshot.missingDocumentIds,
      });
      router.replace(onboardingConfig.completion.route);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to finish onboarding.';
      setStatus({ tone: 'error', message });
      setOnboardingGateError(message);
    } finally {
      setIsCompleting(false);
    }
  };

  const referralStatus = readableReferralStatus(referral);

  if (!authReady) {
    return <AppLoadingShell />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <MercuryPoweredBy />
        <Text
          style={[
            styles.title,
            {
              color: colors.text,
              fontFamily: theme.typography.fontTitle,
            },
          ]}>
          {onboardingConfig.mercury.title}
        </Text>
        <Text style={[styles.body, { color: colors.text }]}>{onboardingConfig.mercury.body}</Text>
      </View>

      <View accessibilityRole="radiogroup" style={styles.pathStack}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: choice === 'existing-customer' }}
          onPress={() => setChoice('existing-customer')}
          style={[
            styles.pathCard,
            {
              backgroundColor: colors.surface,
              borderColor: choice === 'existing-customer' ? colors.primary : colors.secondary,
              borderRadius: theme.layout.radius,
            },
          ]}>
          <View style={styles.pathHeadingRow}>
            <Text style={[styles.pathTitle, { color: colors.text }]}>
              {onboardingConfig.mercury.existingCustomerTitle}
            </Text>
            <Text style={[styles.selectionMark, { color: colors.primary }]}>
              {choice === 'existing-customer' ? 'Selected' : 'Choose'}
            </Text>
          </View>
          <Text style={[styles.pathBody, { color: colors.text }]}>
            {onboardingConfig.mercury.existingCustomerBody}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: choice === 'new-customer' }}
          onPress={() => setChoice('new-customer')}
          style={[
            styles.pathCard,
            {
              backgroundColor: colors.surface,
              borderColor: choice === 'new-customer' ? colors.primary : colors.secondary,
              borderRadius: theme.layout.radius,
            },
          ]}>
          <View style={styles.pathHeadingRow}>
            <Text style={[styles.pathTitle, { color: colors.text }]}>
              {onboardingConfig.mercury.newCustomerTitle}
            </Text>
            <Text style={[styles.selectionMark, { color: colors.primary }]}>
              {choice === 'new-customer' ? 'Selected' : 'Choose'}
            </Text>
          </View>
          <Text style={[styles.pathBody, { color: colors.text }]}>
            {onboardingConfig.mercury.newCustomerBody}
          </Text>
        </Pressable>
      </View>

      {choice === 'existing-customer' ? (
        <View
          testID="mercury-read-connection-panel"
          style={[
            styles.detailPanel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderRadius: theme.layout.radius,
            },
          ]}>
          <Text style={[styles.detailTitle, { color: colors.text }]}>Basic read access</Text>
          <Text style={[styles.pathBody, { color: colors.text }]}>
            Read-only OAuth access covers account and transaction visibility. It does not enable
            invoice creation or payment actions.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings/integrations')}
            style={[styles.secondaryButton, { borderColor: colors.primary }]}>
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Open Integrations</Text>
          </Pressable>
          <Text style={[styles.helperText, { color: colors.text }]}>
            You can continue now and connect later. Once connected, this step will recognize your
            Mercury status automatically.
          </Text>
        </View>
      ) : null}

      {choice === 'new-customer' ? (
        <View
          testID="mercury-referral-panel"
          style={[
            styles.detailPanel,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderRadius: theme.layout.radius,
            },
          ]}>
          <Text style={[styles.detailTitle, { color: colors.text }]}>Open the partner page</Text>
          <Text style={[styles.pathBody, { color: colors.text }]}>
            Use this link before starting an application. Time2Pay records the click, but Mercury
            application and qualification updates are not automatic yet.
          </Text>
          <Pressable
            accessibilityRole="link"
            disabled={isOpeningReferral}
            onPress={() => {
              openMercuryPartnerPage().catch(() => undefined);
            }}
            style={[
              styles.primaryButton,
              { backgroundColor: colors.primary, borderRadius: theme.layout.radius },
            ]}>
            <Text style={[styles.primaryButtonText, { color: primaryForeground }]}>
              {isOpeningReferral ? 'Opening Mercury...' : 'Open Mercury through Time2Pay'}
            </Text>
          </Pressable>
          <Text selectable style={[styles.helperText, { color: colors.text }]}>
            {MERCURY_AFFILIATE_LINK_DISCLOSURE}
          </Text>
          {referralStatus ? <Text style={[styles.helperText, { color: colors.text }]}>{referralStatus}</Text> : null}
        </View>
      ) : null}

      <View
        style={[
          styles.advancedPanel,
          {
            backgroundColor: colors.surface,
            borderColor: colors.secondary,
            borderRadius: theme.layout.radius,
          },
        ]}>
        <Text style={[styles.detailTitle, { color: colors.text }]}>
          {onboardingConfig.mercury.advancedAccessTitle}
        </Text>
        <Text style={[styles.pathBody, { color: colors.text }]}>
          {onboardingConfig.mercury.advancedAccessBody}
        </Text>
      </View>

      {status ? <InlineNotice tone={status.tone} message={status.message} /> : null}

      {choice ? (
        <Pressable
          accessibilityRole="button"
          disabled={isCompleting}
          onPress={() => {
            finishOnboarding(choice).catch(() => undefined);
          }}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary, borderRadius: theme.layout.radius },
          ]}>
          <Text style={[styles.primaryButtonText, { color: primaryForeground }]}>
            {isCompleting ? 'Finishing onboarding...' : onboardingConfig.completion.label}
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isCompleting}
        onPress={() => {
          finishOnboarding('not-now').catch(() => undefined);
        }}
        style={styles.skipButton}>
        <Text style={[styles.skipButtonText, { color: colors.primary }]}>Not now</Text>
      </Pressable>

      <View style={[styles.disclosure, { borderTopColor: colors.surface }]}>
        <MercuryDisclosure />
      </View>
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
    alignItems: 'flex-start',
    gap: 9,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 720,
  },
  pathStack: {
    gap: 10,
  },
  pathCard: {
    borderWidth: 2,
    gap: 7,
    padding: 17,
  },
  pathHeadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  pathTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
  },
  selectionMark: {
    fontSize: 12,
    fontWeight: '800',
  },
  pathBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  detailPanel: {
    borderLeftWidth: 4,
    borderWidth: 1,
    gap: 11,
    padding: 17,
  },
  advancedPanel: {
    borderWidth: 1,
    gap: 7,
    padding: 15,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.78,
  },
  primaryButton: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  skipButton: {
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  disclosure: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
});
