import { Redirect, useRouter } from 'expo-router';
import { HostedAuthGate } from '@/components/hosted-auth-gate';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { logRuntimeDiagnostic } from '@/services/runtime-diagnostics';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export default function SignInRoute() {
  const router = useRouter();
  const { dataMode, hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const startTour = useAuthUiStore((state) => state.startTour);

  if (!dataModeResolved) {
    logRuntimeDiagnostic('signInRoute.loading.pendingDataMode', {
      dataMode,
    });
    return <AppLoadingShell />;
  }

  if (!hostedMode) {
    logRuntimeDiagnostic(
      'signInRoute.localModeRedirect',
      {
        dataMode,
        destination: '/dashboard',
      },
      { level: 'warn' },
    );
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
