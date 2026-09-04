import { Redirect } from 'expo-router';
import { useEffect } from 'react';

import { AppLoadingShell } from '@/components/app-loading-shell';
import { HostedAuthGate } from '@/components/hosted-auth-gate';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { logRuntimeDiagnostic } from '@/services/runtime-diagnostics';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export default function OnboardingAuthScreen() {
  const { dataMode, hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const endTour = useAuthUiStore((state) => state.endTour);
  const resetForLocalMode = useAuthUiStore((state) => state.resetForLocalMode);

  // Reaching /onboarding/auth (e.g. via Get Started -> onboarding) must exit a
  // stuck tour, otherwise local mode silently redirects back to the read-only
  // tour dashboard instead of completing onboarding into real local data.
  useEffect(() => {
    if (!dataModeResolved || !tourModeEnabled) {
      return;
    }

    logRuntimeDiagnostic('onboardingAuthScreen.tourExit', {
      dataMode,
      hostedMode,
    });
    endTour();
    if (!hostedMode) {
      resetForLocalMode();
    }
  }, [dataMode, dataModeResolved, endTour, hostedMode, resetForLocalMode, tourModeEnabled]);

  if (!dataModeResolved) {
    return <AppLoadingShell />;
  }

  if (!hostedMode) {
    // Wait for the tour-exit effect above to flip tourModeEnabled to false before
    // redirecting, so /dashboard never mounts while still tour-flagged.
    if (tourModeEnabled) {
      return <AppLoadingShell />;
    }

    return <Redirect href="/dashboard" />;
  }

  return (
    <HostedAuthGate
      description="Use an email magic link or GitHub to create or open your Time2Pay account. After authentication, you will review the legal documents once and enter the app."
      githubLabel="Continue with GitHub"
      magicLinkLabel="Send account link"
      redirectPath="/onboarding/legal"
      shouldCreateUser
      title="Create or open your Time2Pay account"
    />
  );
}
