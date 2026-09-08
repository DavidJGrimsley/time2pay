import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { HostedAuthGate } from '@/components/hosted-auth-gate';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { logRuntimeDiagnostic } from '@/services/runtime-diagnostics';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export default function SignInRoute() {
  const router = useRouter();
  const { dataMode, hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const startTour = useAuthUiStore((state) => state.startTour);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const endTour = useAuthUiStore((state) => state.endTour);
  const resetForLocalMode = useAuthUiStore((state) => state.resetForLocalMode);

  useEffect(() => {
    if (!dataModeResolved) {
      logRuntimeDiagnostic('signInRoute.loading.pendingDataMode', {
        dataMode,
      });
    }
  }, [dataModeResolved, dataMode]);

  // Reaching /sign-in by any path (banner button, direct link) must always exit
  // a stuck tour so the user gets a real sign-in/local-data experience instead
  // of being bounced back onto the read-only tour dashboard.
  useEffect(() => {
    if (!dataModeResolved || !tourModeEnabled) {
      return;
    }

    logRuntimeDiagnostic('signInRoute.tourExit', {
      dataMode,
      hostedMode,
    });
    endTour();
    if (!hostedMode) {
      resetForLocalMode();
    }
  }, [dataMode, dataModeResolved, endTour, hostedMode, resetForLocalMode, tourModeEnabled]);

  useEffect(() => {
    if (dataModeResolved && !hostedMode) {
      logRuntimeDiagnostic(
        'signInRoute.localModeRedirect',
        {
          dataMode,
          destination: '/dashboard',
        },
        { level: 'warn' },
      );
    }
  }, [dataModeResolved, hostedMode, dataMode]);

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
      onTourExperience={() => {
        logRuntimeDiagnostic('signInRoute.tourStart', {
          dataMode,
          destination: '/dashboard',
        });
        startTour();
        router.replace('/dashboard');
      }}
    />
  );
}
